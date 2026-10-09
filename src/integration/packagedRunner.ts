import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from '@vscode/test-electron';

async function main(): Promise<void> {
  const vsix = resolve(process.argv[2] ?? '');
  if (!process.argv[2] || !existsSync(vsix)) {
    throw new Error('Usage: node out/integration/packagedRunner.js path/to/validated.vsix');
  }
  const directory = mkdtempSync(join(tmpdir(), 'wkt-vsix-smoke-'));
  try {
    const extensions = join(directory, 'installed');
    const profile = join(directory, 'profile');
    const workspace = join(directory, 'workspace');
    const harness = join(directory, 'smoke-harness');
    for (const location of [extensions, profile, workspace, harness]) {
      mkdirSync(location);
    }
    writeFileSync(join(harness, 'package.json'), JSON.stringify({
      name: 'wkt-packaged-smoke-harness',
      displayName: 'WKT Packaged Smoke Harness',
      publisher: 'Chain-Frost',
      version: '0.0.1',
      engines: { vscode: '^1.85.0' },
      main: './extension.js',
      activationEvents: ['*'],
    }));
    writeFileSync(join(harness, 'extension.js'), 'exports.activate = () => {};\n');

    const version = process.env.VSCODE_PACKAGED_VERSION ?? 'stable';
    const binary = await downloadAndUnzipVSCode(version);
    await runVSCodeCommand([
      '--extensions-dir=' + extensions,
      '--user-data-dir=' + profile,
      '--install-extension', vsix,
      '--force',
    ], { version });

    // Unlike source tests, the development extension is a separate tiny
    // harness. The target formatter must load from the VSIX installation.
    await runTests({
      vscodeExecutablePath: binary,
      extensionDevelopmentPath: harness,
      extensionTestsPath: resolve(__dirname, 'packagedSuite'),
      launchArgs: [
        workspace,
        '--extensions-dir=' + extensions,
        '--user-data-dir=' + profile,
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
      ],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
