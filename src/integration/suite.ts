import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import * as vscode from 'vscode';
import { formatWkt } from '../formatter';

const extensionId = 'Chain-Frost.wkt-prj-formatter';

async function openFixture(filename: string, override?: string): Promise<vscode.TextEditor> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(folder, 'The runner must open a separate temporary workspace');
  const source = override ?? readFileSync(resolve(__dirname, '../../fixtures', filename), 'utf8');
  const target = join(folder, basename(filename));
  writeFileSync(target, source, 'utf8');
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
  assert.equal(doc.languageId, 'wkt', filename + ' must use the contributed language');
  return vscode.window.showTextDocument(doc);
}

async function waitForNaturalActivation(): Promise<void> {
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, 'Development extension must be installed in Extension Host');
  for (let tries = 0; tries < 100 && !extension.isActive; tries += 1) {
    await new Promise<void>(resolveTimeout => setTimeout(resolveTimeout, 50));
  }
  assert.ok(extension.isActive, 'Opening a WKT document must activate the extension');
}

async function providerEdits(document: vscode.TextDocument, tabSize = 4, insertSpaces = true):
Promise<vscode.TextEdit[]> {
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    'vscode.executeFormatDocumentProvider', document.uri, { tabSize, insertSpaces },
  );
  return edits ?? [];
}

async function applyProvider(document: vscode.TextDocument, tabSize = 4, insertSpaces = true):
Promise<void> {
  const edits = await providerEdits(document, tabSize, insertSpaces);
  const changes = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    changes.replace(document.uri, edit.range, edit.newText);
  }
  assert.equal(await vscode.workspace.applyEdit(changes), true);
}

export async function run(): Promise<void> {
  console.log('Integration: actual WKT file extensions, activation and formatting');
  for (const filename of [
    'gda94-mga-zone50.prj', 'gda94-mga-zone50-ogc.wkt', 'gda94-mga-zone50.wkt2',
  ]) {
    const editor = await openFixture(filename);
    await waitForNaturalActivation();
    const original = editor.document.getText();
    const expected = formatWkt(original, { indent: '    ' });
    await applyProvider(editor.document);
    assert.equal(editor.document.getText(), expected, 'Provider output differs: ' + filename);
    assert.deepEqual(await providerEdits(editor.document), [], 'Provider must be idempotent');
  }

  console.log('Integration: editor tabs and spaces, explicit command and undo');
  const raw = 'PROJCS["GDA94",GEOGCS["GDA94",DATUM["datum"]],PARAMETER["east",500000]]';
  const editor = await openFixture('two-space.wkt', raw);
  editor.options = { insertSpaces: true, tabSize: 2 };
  await vscode.window.showTextDocument(editor.document, { preserveFocus: false, preview: false });
  assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), editor.document.uri.toString(),
    'The command requires a visible active WKT editor');
  await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
  assert.equal(editor.document.getText(), formatWkt(raw, { indent: '  ' }));
  await vscode.commands.executeCommand('undo');
  assert.equal(editor.document.getText(), raw, 'One undo must restore original WKT');

  editor.options = { insertSpaces: false, tabSize: 8 };
  await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
  assert.equal(editor.document.getText(), formatWkt(raw, { indent: '\t' }));
  assert.deepEqual(await providerEdits(editor.document, 8, false), []);

  console.log('Integration: malformed and unsupported inputs stay unchanged');
  for (const unsupported of ['+proj=utm +zone=50 +south', 'GEOGCS["unterminated]']) {
    const malformed = await openFixture('invalid.prj', unsupported);
    assert.deepEqual(await providerEdits(malformed.document), []);
    await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
    assert.equal(malformed.document.getText(), unsupported);
  }

  console.log('Integration: bracket folding provider for nested WKT');
  const nested = await openFixture('fold.wkt2', raw);
  const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
    'vscode.executeFoldingRangeProvider', nested.document.uri,
  );
  assert.ok(ranges && ranges.some(r => r.start === 0 && r.end >= 1), 'WKT folding not registered');

  console.log('Integration: format on save in isolated temporary workspace');
  const config = vscode.workspace.getConfiguration('editor', nested.document.uri);
  await config.update('defaultFormatter', extensionId, vscode.ConfigurationTarget.Workspace);
  await config.update('formatOnSave', true, vscode.ConfigurationTarget.Workspace);
  const saved = await openFixture('format-on-save.wkt', raw);
  await saved.edit(edit => edit.insert(saved.document.positionAt(saved.document.getText().length), ' '));
  assert.equal(await saved.document.save(), true);
  assert.equal(saved.document.getText(), formatWkt(raw, { indent: '    ' }));
  console.log('WKT Extension Host tests passed.');
}
