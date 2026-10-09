import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyReleaseMetadata(tag, version, changelog) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag)) {
    throw new Error('Release tag must be vMAJOR.MINOR.PATCH; received: ' + tag);
  }
  if (tag !== 'v' + version) {
    throw new Error('Release tag ' + tag + ' must match package.json version ' + version);
  }
  const expectedHeader = '## [' + version + ']';
  const lines = changelog.replace(/\r\n|\r/gu, '\n').split('\n');
  const start = lines.findIndex(line => line === expectedHeader ||
    line.startsWith(expectedHeader + ' - '));
  if (start < 0) {
    throw new Error('CHANGELOG.md needs a heading ' + expectedHeader + ' (optional date suffix)');
  }
  const nextHeading = lines.findIndex((line, index) => index > start && /^## /u.test(line));
  const contents = lines.slice(start + 1, nextHeading < 0 ? undefined : nextHeading).join('\n').trim();
  if (!contents || !/\S/u.test(contents)) {
    throw new Error('Release notes section ' + expectedHeader + ' must not be empty');
  }
  return contents;
}

const isEntrypoint = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  try {
    const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    verifyReleaseMetadata(tag, version, changelog);
    process.stdout.write('Validated release metadata for ' + tag + '\n');
  } catch (error) {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 1;
  }
}
