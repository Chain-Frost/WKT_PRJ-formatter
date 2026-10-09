import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { verifyReleaseMetadata } from './check-release.mjs';

const notes = [
  '# Changelog',
  '## Unreleased',
  '- Next release',
  '',
  '## [0.2.0] - 2026-10-10',
  '### Added',
  '- Tested VSIX packaging.',
  '',
  '## [0.1.0]',
  '- Initial version',
  '',
].join('\n');

test('tag, package version and matching nonempty changelog section pass', () => {
  assert.match(verifyReleaseMetadata('v0.2.0', '0.2.0', notes), /Tested VSIX/u);
  assert.equal(verifyReleaseMetadata('v0.1.0', '0.1.0', notes), '- Initial version');
});

test('reject non-semver tags, prerelease tags, wrong versions and mismatch', () => {
  for (const tag of ['v0.2', 'v0.2.0-beta', 'v00.2.0', 'v0.02.0', 'v0.2.0.1',
    '0.2.0', 'v2.0.0', 'v0.2.0-other']) {
    assert.throws(() => verifyReleaseMetadata(tag, '0.2.0', notes), /Release tag/u, tag);
  }
});

test('refuse absent or empty release notes; do not take notes from other versions', () => {
  assert.throws(() => verifyReleaseMetadata('v0.3.0', '0.3.0', notes), /CHANGELOG/u);
  const empty = '## [0.3.0] - 2026-10-10\n\n## [0.2.0]\nSomething';
  assert.throws(() => verifyReleaseMetadata('v0.3.0', '0.3.0', empty), /not be empty/u);
});

test('accept both LF and CRLF changelogs, with exact headings only', () => {
  assert.match(verifyReleaseMetadata('v0.2.0', '0.2.0', notes.replace(/\n/gu, '\r\n')), /Added/u);
  assert.throws(() => verifyReleaseMetadata('v0.2.0', '0.2.0', '## [0.2.01]\nSomething'),
    /CHANGELOG/u);
});
