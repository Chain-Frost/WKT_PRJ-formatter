import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { formatWkt } from '../formatter';

/**
 * Optional Linux/Xvfb screenshot harness for actual VS Code themes and WKT
 * layout. Only runs when WKT_SCREENSHOT_DIR is explicitly set.
 */
export async function captureVisualEvidence(directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true });
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    throw new Error('Visual evidence requires an isolated Extension Host workspace');
  }
  const before = [
    'PROJCS["GDA94 / MGA zone 50",GEOGCS["GDA94",DATUM["GDA94",SPHEROID["GRS 1980",6378137,298.257222101]],',
    'PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],',
    'PARAMETER["false_easting",500000],UNIT["metre",1]]',
  ].join('');
  const formatted = formatWkt(before);
  const beforeFile = join(folder, 'before-formatting.prj');
  const afterFile = join(folder, 'after-formatting.prj');
  writeFileSync(beforeFile, before, 'utf8');
  writeFileSync(afterFile, formatted, 'utf8');

  const editorConfig = vscode.workspace.getConfiguration('editor');
  await editorConfig.update('fontSize', 15, vscode.ConfigurationTarget.Global);
  await editorConfig.update('wordWrap', 'on', vscode.ConfigurationTarget.Global);
  await editorConfig.update('minimap.enabled', false, vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');

  for (const [theme, file] of [
    ['Default Dark Modern', 'wkt-before-after-dark.png'],
    ['Default Light Modern', 'wkt-before-after-light.png'],
  ] as const) {
    await vscode.workspace.getConfiguration('workbench').update(
      'colorTheme', theme, vscode.ConfigurationTarget.Global,
    );
    const first = await vscode.workspace.openTextDocument(vscode.Uri.file(beforeFile));
    const second = await vscode.workspace.openTextDocument(vscode.Uri.file(afterFile));
    await vscode.window.showTextDocument(first, { viewColumn: vscode.ViewColumn.One, preview: false });
    await vscode.window.showTextDocument(second, { viewColumn: vscode.ViewColumn.Two, preview: false });
    await new Promise<void>(done => setTimeout(done, 1800));

    const path = join(directory, file);
    const result = spawnSync('import', ['-window', 'root', path], {
      encoding: 'utf8', timeout: 20000,
    });
    if (result.status !== 0) {
      throw new Error('Failed to capture real VS Code ' + theme + ' screenshot: ' +
        String(result.error ?? result.stderr));
    }
    console.log('Captured actual VS Code ' + theme + ' screenshot at ' + path);
  }
}
