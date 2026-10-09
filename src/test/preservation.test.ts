import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { formatWkt, WktFormatError } from '../formatter';

/**
 * Independent lexical oracle, not based on the production parser.
 * Discards only structural whitespace outside quoted strings and preserves
 * complete tokens, bracket types, scalar spelling and quoted content.
 */
function tokens(source: string): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < source.length) {
    const current = source[index] ?? '';
    if (/\s/u.test(current)) {
      index += 1;
      continue;
    }
    const start = index;
    if (current === '"') {
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '"' && source[index + 1] === '"') {
          index += 2;
        } else if (source[index] === '"') {
          index += 1;
          closed = true;
          break;
        } else {
          index += 1;
        }
      }
      assert.ok(closed, 'Unterminated test quote');
    } else if ('[],()'.includes(current)) {
      index += 1;
    } else {
      while (index < source.length && !/[\s[\](),"]/u.test(source[index] ?? '')) {
        index += 1;
      }
      assert.ok(index > start);
    }
    result.push(source.slice(start, index));
  }
  return result;
}

test('independent oracle detects all significant mutations', () => {
  const source = 'ROOT["north [2]" ,AXIS["x",north],ID["EPSG",4326]]';
  assert.notDeepEqual(tokens(source), tokens(source.replace('4326', '4327')));
  assert.notDeepEqual(tokens(source), tokens(source.replace('north,', 'south,')));
  assert.notDeepEqual(tokens(source), tokens(source.replace('AXIS[', 'AXIS(')));
  assert.deepEqual(tokens(source), tokens('ROOT["north [2]", AXIS["x",north], ID["EPSG",4326]]'));
});

test('complete ordered tokens are preserved under all supported indentation options', () => {
  const fixtureNames = ['gda94-mga-zone50.prj', 'gda94-mga-zone50-ogc.wkt',
    'gda94-mga-zone50.wkt2'];
  const samples = fixtureNames.map(name =>
    readFileSync(resolve(__dirname, '../../fixtures', name), 'utf8'));
  samples.push('GEOGCRS["A [ ] \\\\ ""quoted""",AXIS["X",east],ID("EPSG",4.326E+3)]');
  samples.push('GEOGCRS["line one\nline two",DATUM["☀ Équateur",SPHEROID["E",+6378137.0,2.98e+2]]]');
  for (const input of samples) {
    for (const indent of ['  ', '    ', '\t']) {
      const formatted = formatWkt(input, { indent });
      assert.deepEqual(tokens(formatted), tokens(input), input.slice(0, 60));
      assert.equal(formatWkt(formatted, { indent }), formatted);
    }
  }
});

test('deep nesting at safety boundary preserves tokens; beyond throws a typed error', () => {
  const valid = 'N['.repeat(257) + '"leaf"' + ']'.repeat(257);
  const invalid = 'N['.repeat(258) + '"leaf"' + ']'.repeat(258);
  const output = formatWkt(valid);
  assert.deepEqual(tokens(output), tokens(valid));
  assert.throws(() => formatWkt(invalid), (error: unknown) =>
    error instanceof WktFormatError && /nesting exceeds safety limit/u.test(error.message));
});

test('BOM and line endings outside quoted strings remain unchanged', () => {
  const input = '\uFEFFGEOGCRS["a\nb",\r\nDATUM["D",ELLIPSOID["E",6378137,298.257223563]]]\r\n';
  const output = formatWkt(input);
  assert.ok(output.startsWith('\uFEFFGEOGCRS["a\nb",\r\n'));
  assert.ok(output.endsWith('\r\n'));
  assert.ok(output.includes('"a\nb"'));
  assert.deepEqual(tokens(output), tokens(input));
  assert.equal(formatWkt(output), output);
});

test('CRLF and real Windows filesystem paths work without formatting drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'wkt format paths '));
  try {
    const folder = join(root, 'folder with spaces');
    mkdirSync(folder);
    const filename = join(folder, 'GDA94 MGA 50.wkt2');
    assert.ok(isAbsolute(filename));
    if (process.platform === 'win32') {
      assert.ok(filename.includes(sep));
    }
    const input = 'PROJCRS["WGS 84",\r\nBASEGEOGCRS["WGS 84",DATUM["D"]]]\r\n';
    writeFileSync(filename, input);
    const output = formatWkt(readFileSync(filename, 'utf8'), { indent: '\t' });
    writeFileSync(filename, output);
    assert.ok(output.includes('\r\n\tBASEGEOGCRS['));
    assert.ok(!/(?<!\r)\n/u.test(output));
    assert.deepEqual(tokens(output), tokens(input));
    assert.equal(formatWkt(readFileSync(filename, 'utf8'), { indent: '\t' }), output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('unbounded scalar-only leaves remain intact rather than being width wrapped', () => {
  const input = 'ROOT["a",PARAMETER["'+'very long value'.repeat(100)+'",+2.5E-7]]';
  const output = formatWkt(input);
  assert.equal(output.split('\n').length, 2);
  assert.deepEqual(tokens(output), tokens(input));
});
