import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  // This assertion is the core of #10. A run in a trusted workspace must
  // fail, even if the provider and command both happen to work.
  assert.equal(vscode.workspace.isTrusted, false,
    'Restricted Mode regression test MUST be in an actually untrusted workspace');

  const extension = vscode.extensions.getExtension('Chain-Frost.wkt-prj-formatter');
  assert.ok(extension, 'Formatter extension must be installed in Restricted Mode');
  assert.equal(extension.packageJSON.capabilities?.untrustedWorkspaces?.supported, true,
    'Extension must declare unconditional Restricted Mode support');

  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(folder, 'A new isolated untrusted workspace folder is required');
  const source = 'PROJCS["GDA94",GEOGCS["GDA94",DATUM["D"]],PARAMETER["x",500000]]';
  const expected4 = [
    'PROJCS["GDA94",',
    '    GEOGCS["GDA94",',
    '        DATUM["D"]],',
    '    PARAMETER["x",500000]]',
  ].join('\n');
  const file = vscode.Uri.file(join(folder, 'restricted.prj'));
  writeFileSync(file.fsPath, source);
  const document = await vscode.workspace.openTextDocument(file);
  assert.equal(document.languageId, 'wkt');
  const editor = await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
  for (let attempt = 0; attempt < 80 && !extension.isActive; attempt += 1) {
    await new Promise<void>(done => setTimeout(done, 50));
  }
  assert.ok(extension.isActive, 'Formatter must activate in Restricted Mode');

  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    'vscode.executeFormatDocumentProvider',
    document.uri,
    { tabSize: 4, insertSpaces: true },
  );
  assert.ok(edits && edits.length > 0, 'Format Document provider unavailable in Restricted Mode');
  const changes = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    changes.replace(document.uri, edit.range, edit.newText);
  }
  assert.ok(await vscode.workspace.applyEdit(changes));
  const lineEnding = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  assert.equal(document.getText(), expected4.replace(/\n/gu, lineEnding));
  assert.equal(vscode.workspace.isTrusted, false, 'Formatter must not promote workspace trust');

  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), source);

  editor.options = { tabSize: 2, insertSpaces: true };
  await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
  await vscode.commands.executeCommand('wktPrjFormatter.formatDocument');
  const expected2 = [
    'PROJCS["GDA94",',
    '  GEOGCS["GDA94",',
    '    DATUM["D"]],',
    '  PARAMETER["x",500000]]',
  ].join(lineEnding);
  assert.equal(document.getText(), expected2);
  assert.equal(vscode.workspace.isTrusted, false,
    'Explicit formatting command must not prompt for or grant trust');

  console.log('Restricted Mode verified: actual untrusted workspace, activation, provider, command, unchanged trust.');
}
