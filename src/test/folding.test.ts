import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { findWktFolds } from '../folding';

test('folds nested bracketed and parenthesized WKT through closing lines', () => {
  const source = [
    'PROJCRS[',
    '  "Example",',
    '  BASEGEOGCRS(',
    '    "WGS 84",',
    '    DATUM["WGS 84"]',
    '  ),',
    '  AXIS[',
    '    "Easting",',
    '    east',
    '  ]',
    ']',
  ].join('\n');
  assert.deepEqual(findWktFolds(source), [
    { start: 0, end: 10 },
    { start: 2, end: 5 },
    { start: 6, end: 9 },
  ]);
});

test('ignores bracket characters, doubled quotes and literal backslashes in strings', () => {
  const source = [
    'GEOGCRS[',
    String.raw`  "string [ ( ) ] and "" quoted "" and \[",`,
    '  DATUM[',
    '    "Name ] ( [",',
    '    ELLIPSOID["Nested (single-line)", 6378137, 298.257223563]',
    '  ]',
    ']',
  ].join('\r\n');
  assert.deepEqual(findWktFolds(source), [
    { start: 0, end: 6 },
    { start: 2, end: 5 },
  ]);
});

test('single-line nodes are not folding regions', () => {
  assert.deepEqual(findWktFolds('DATUM["A",ELLIPSOID("B",1,2)]'), []);
});

test('handles mixed CRLF, LF and CR, plus literal newlines in strings', () => {
  const source = 'GEOGCRS[\r\n  "Two\nlines with ] and \\ ",\r  DATUM(\n    "D"\n  )\r\n]';
  assert.deepEqual(findWktFolds(source), [
    { start: 0, end: 6 },
    { start: 3, end: 5 },
  ]);
});

test('ignores mismatched, unclosed and unexpected delimiters without exceptions', () => {
  for (const input of ['[)', '][', 'GEOGCRS["unclosed [', '', '() )(', '[\n]', '[\n)\n]']) {
    assert.doesNotThrow(() => findWktFolds(input));
  }
  assert.deepEqual(findWktFolds('[\n)\n]'), []);
});

test('large WKT with many nested nodes has stable deterministic ranges', () => {
  const source = 'ROOT[\n' + '  INNER(\n'.repeat(300) + '"x"\n' + '  )\n'.repeat(300) + ']';
  const ranges = findWktFolds(source);
  assert.equal(ranges.length, 301);
  assert.deepEqual(ranges[0], { start: 0, end: 602 });
});
