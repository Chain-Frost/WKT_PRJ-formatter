import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const versions = process.env.VSCODE_TEST_VERSIONS?.split(',').map(s => s.trim()).filter(Boolean)
    ?? ['1.85.0', 'stable'];

  for (const version of versions) {
    const directory = mkdtempSync(join(tmpdir(), 'wkt-vscode-host-'));
    try {
      const workspace = join(directory, 'workspace');
      mkdirSync(workspace);
      const executable = await downloadAndUnzipVSCode(version);
      console.log('Running WKT Extension Host integration tests against VS Code ' + version);
      await runTests({
        vscodeExecutablePath: executable,
        extensionDevelopmentPath: resolve(__dirname, '../..'),
        extensionTestsPath: resolve(__dirname, 'suite'),
        launchArgs: [
          workspace,
          '--user-data-dir=' + join(directory, 'profile'),
          '--extensions-dir=' + join(directory, 'extensions'),
          '--disable-updates',
          '--skip-welcome',
          '--skip-release-notes',
        ],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
