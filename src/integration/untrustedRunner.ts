import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

/**
 * A distinct Extension Host session, profile and workspace is essential.
 * The --disable-workspace-trust switch MUST NOT be passed here: it would
 * turn off Restricted Mode and invalidate the test.
 */
async function main(): Promise<void> {
  const versions = process.env.VSCODE_TEST_VERSIONS?.split(',').map(s => s.trim()).filter(Boolean)
    ?? ['1.85.0', 'stable'];

  for (const version of versions) {
    const directory = mkdtempSync(join(tmpdir(), 'wkt-untrusted-workspace-'));
    try {
      const workspace = join(directory, 'untrusted-folder');
      const profile = join(directory, 'untrusted-profile');
      mkdirSync(workspace);
      mkdirSync(join(profile, 'User'), { recursive: true });
      // Do not trust the folder at startup, or allow the prompt to race with
      // the test. The suite still verifies the actual isTrusted state.
      writeFileSync(join(profile, 'User', 'settings.json'), JSON.stringify({
        'security.workspace.trust.enabled': true,
        'security.workspace.trust.startupPrompt': 'never',
      }));

      console.log('Verifying actual Restricted Mode using VS Code ' + version);
      const binary = await downloadAndUnzipVSCode(version);
      // @vscode/test-electron.runTests *always* adds
      // --disable-workspace-trust (microsoft/vscode-test lib/runTest.ts).
      // Launch the downloaded VS Code executable directly instead, using
      // the same extension development/test flags but leaving Workspace Trust
      // enabled. Never add --disable-workspace-trust here.
      const args = [
        workspace,
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--disable-updates',
        '--no-cached-data',
        '--skip-welcome',
        '--skip-release-notes',
        '--user-data-dir=' + profile,
        '--extensions-dir=' + join(directory, 'extensions'),
        '--extensionDevelopmentPath=' + resolve(__dirname, '../..'),
        '--extensionTestsPath=' + resolve(__dirname, 'untrustedSuite'),
      ];
      await new Promise<void>((resolveExit, reject) => {
        const processHandle = spawn(binary, args, { stdio: 'inherit', env: process.env });
        processHandle.once('error', reject);
        processHandle.once('close', (code, signal) => {
          if (code === 0) {
            resolveExit();
          } else {
            reject(new Error('Untrusted VS Code host exited ' + code + ', signal ' + signal));
          }
        });
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
