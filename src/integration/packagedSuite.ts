import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as vscode from 'vscode';
import { formatWkt } from '../formatter';

export async function run(): Promise<void> {
  const id = 'Chain-Frost.wkt-prj-formatter';
  const target = vscode.extensions.getExtension(id);
  assert.ok(target, 'VSIX-installed target extension is missing');
  const root = resolve(__dirname, '../..');
  assert.notEqual(resolve(target.extensionPath), root,
    'Smoke test must use installed target, never source development extension');
  const expectedVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string;
  assert.equal(target.packageJSON.version, expectedVersion);

  for (const path of ['out/extension.js', 'language-configuration.json',
    'syntaxes/wkt.tmLanguage.json', 'assets/icon.png',
    'assets/wkt-before-after.png']) {
    assert.ok(existsSync(join(target.extensionPath, path)), 'VSIX omitted ' + path);
  }

  // Validate that the VS Code extension Details page has a resolvable image
  // reference and that the packaged PNG files have the expected signatures.
  // VSIX packaging may normalize README.md to lowercase readme.md.
  const readmePath = ['README.md', 'readme.md']
    .map(name => join(target.extensionPath, name))
    .find(path => existsSync(path));
  assert.ok(readmePath, 'VSIX omitted README/readme markdown');
  const readme = readFileSync(readmePath, 'utf8');
  // vsce rewrites relative README images to absolute GitHub raw URLs in
  // the packaged readme; GitHub source uses the original relative form.
  assert.match(readme, /!\[[^\]]+\]\((?:assets\/|https:\/\/github\.com\/Chain-Frost\/WKT_PRJ-formatter\/raw\/HEAD\/assets\/)wkt-before-after\.png\)/u);
  for (const png of ['assets/icon.png', 'assets/wkt-before-after.png']) {
    const data: Buffer = readFileSync(join(target.extensionPath, png));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a',
      'Packaged asset is not a PNG: ' + png);
    assert.ok(data.readUInt32BE(16) >= 128 && data.readUInt32BE(20) >= 128,
      'Packaged PNG has unexpectedly small dimensions: ' + png);
  }
  for (const path of ['src', 'fixtures', 'out/test', 'out/integration', 'node_modules', 'scripts']) {
    assert.equal(existsSync(join(target.extensionPath, path)), false,
      'VSIX contains dev-only or source file ' + path);
  }

  const directory = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(directory, 'Smoke runner requires an isolated workspace');
  for (const name of ['reference.prj', 'reference.wkt', 'reference.wkt2']) {
    const sourceName = name.endsWith('.prj') ? 'gda94-mga-zone50.prj'
      : name.endsWith('.wkt2') ? 'gda94-mga-zone50.wkt2'
      : 'gda94-mga-zone50-ogc.wkt';
    const source = readFileSync(join(root, 'fixtures', sourceName), 'utf8');
    const uri = vscode.Uri.file(join(directory, name));
    writeFileSync(uri.fsPath, source);
    const document = await vscode.workspace.openTextDocument(uri);
    assert.equal(document.languageId, 'wkt', 'Missing language contribution for ' + name);
    await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
    if (!target.isActive) {
      for (let i = 0; i < 100 && !target.isActive; i += 1) {
        await new Promise<void>(done => setTimeout(done, 50));
      }
    }
    assert.ok(target.isActive, 'Installed extension did not activate');

    const providerEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider', uri, { insertSpaces: true, tabSize: 4 },
    );
    assert.ok(providerEdits && providerEdits.length > 0, 'No installed formatting provider: ' + name);
    const edit = new vscode.WorkspaceEdit();
    for (const value of providerEdits) {
      edit.replace(uri, value.range, value.newText);
    }
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.equal(document.getText(), formatWkt(source, { indent: '    ' }));
    assert.deepEqual((await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider', uri, { insertSpaces: true, tabSize: 4 })) ?? [], []);
  }

  const raw = 'PROJCS["GDA94",GEOGCS["GDA94",DATUM["B"]],PARAMETER["x",1]]';
  const commandUri = vscode.Uri.file(join(directory, 'explicit.prj'));
  writeFileSync(commandUri.fsPath, raw);
  const document = await vscode.workspace.openTextDocument(commandUri);
  const editor = await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
  editor.options = { insertSpaces: true, tabSize: 2 };
  await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  assert.equal(document.getText(), formatWkt(raw, { indent: '  ' }).replace(/\r\n|\n|\r/gu, eol));
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), raw, 'Installed explicit command must be undoable in one action');

  // Reformat once more after undo to create multiline nodes for folding.
  await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
  const folds = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
    'vscode.executeFoldingRangeProvider', document.uri,
  );
  assert.ok(folds && folds.length > 0, 'Installed bracket folding provider missing');
  console.log('Installed VSIX smoke tests passed (extension ID, version, assets, language, formatting, undo, folds).');
}
