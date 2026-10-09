import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { formatWkt, WktFormatError } from '../formatter';

/**
 * Independent lexical oracle: do not use the production WKT tokenizer/parser.
 * Whitespace between tokens is disposable; every other character is data.
 */
function structuralTokens(source: string): string[] {
  const result: string[] = [];
  let offset = 0;
  while (offset < source.length) {
    const current = source[offset] ?? '';
    if (/\s/u.test(current)) {
      offset += 1;
      continue;
    }
    const start = offset;
    if (current === '"') {
      offset += 1;
      let finished = false;
      while (offset < source.length) {
        if (source[offset] === '"' && source[offset + 1] === '"') {
          offset += 2;
        } else if (source[offset] === '"') {
          offset += 1;
          finished = true;
          break;
        } else {
          offset += 1;
        }
      }
      assert.ok(finished, 'Oracle received unterminated quoted text');
    } else if ('[],()'.includes(current)) {
      offset += 1;
    } else {
      while (offset < source.length && !/[\s[\](),"]/u.test(source[offset] ?? '')) {
        offset += 1;
      }
      assert.ok(offset > start, 'Oracle could not advance');
    }
    result.push(source.slice(start, offset));
  }
  return result;
}

const esri = readFileSync(resolve(__dirname, '../../fixtures/gda94-mga-zone50.prj'), 'utf8').trimEnd();
const wkt2 = String.raw`PROJCRS["UTM \ ""quoted""",BASEGEOGCRS("WGS 84",DATUM["Équateur, [x]",ELLIPSOID["S",+6378137.0,2.98257223563E+2]]),CONVERSION["Projection",PARAMETER["Latitude",-.0003e-2]],AXIS["Easting",east]]`;
const mixed = String.raw`BOUNDCRS(SOURCECRS[GEOGCRS("backslash \ and ""quote""",DATUM("D"))],TARGETCRS[GEOGCRS("C")])`;

test('structural oracle detects substitutions, deletions and bracket changes', () => {
  const input = 'GEOGCRS["A",AXIS["X",north],ID["EPSG",4326]]';
  assert.notDeepEqual(structuralTokens(input), structuralTokens(input.replace('4326', '4327')));
  assert.notDeepEqual(structuralTokens(input), structuralTokens(input.replace('north', '')));
  assert.notDeepEqual(structuralTokens(input), structuralTokens(input.replace('AXIS[', 'AXIS(')));
  assert.deepEqual(structuralTokens(input), structuralTokens('GEOGCRS [ "A", AXIS ["X", north], ID ["EPSG",4326] ]'));
});

test('complete WKT1/WKT2 token sequences and literal strings survive formatting', () => {
  for (const source of [esri, wkt2, mixed,
    String.raw`GEOGCS["Spacing  inside ""strings""",PARAMETER["x", -1.23e+04],AXIS["Y",south]]`,
    'GEOGCRS["line one\nline two",DATUM["test"]]',
  ]) {
    for (const indent of ['  ', '    ', '\t']) {
      for (const tabSize of [2, 4, 8]) {
        for (const maxInlineLength of [40, 80, 100, 240]) {
          const options = { indent, tabSize, maxInlineLength };
          const formatted = formatWkt(source, options);
          assert.deepEqual(structuralTokens(formatted), structuralTokens(source),
            JSON.stringify(options) + ': ' + source.slice(0, 40));
          assert.equal(formatWkt(formatted, options), formatted);
        }
      }
    }
  }
});

test('configured tab size changes only visual width, never tab indentation', () => {
  const input = 'ROOT["project name",CHILD["abcdefghijklmn",1234567890],TAIL[0]]';
  const outputs = [2, 4, 8].map(tabSize =>
    formatWkt(input, { indent: '\t', tabSize, maxInlineLength: 40 }));
  assert.match(outputs[0] ?? '', /\n\tCHILD\["abcdefghijklmn", 1234567890\]/u);
  assert.match(outputs[1] ?? '', /\n\tCHILD\["abcdefghijklmn", 1234567890\]/u);
  assert.match(outputs[2] ?? '', /\n\tCHILD\[\n\t\t"abcdefghijklmn"/u);
  for (const output of outputs) {
    assert.deepEqual(structuralTokens(output), structuralTokens(input));
  }
  assert.equal(formatWkt(input, { indent: '\t', maxInlineLength: 40 }), outputs[1]);
  assert.equal(formatWkt(input, { indent: '\t', tabSize: 0, maxInlineLength: 40 }), outputs[1]);
  assert.equal(formatWkt(input, { indent: '\t', tabSize: NaN, maxInlineLength: 40 }), outputs[1]);
});

test('clamps widths and rejects invalid indentation without modifying tokens', () => {
  const input = 'ROOT["a long name",CHILD["a long child name",1],TAIL[2]]';
  for (const width of [-20, 0, 39, 40, 41, 100, 239, 240, 500, NaN, Infinity]) {
    const output = formatWkt(input, { maxInlineLength: width });
    assert.deepEqual(structuralTokens(output), structuralTokens(input));
    assert.equal(formatWkt(output, { maxInlineLength: width }), output);
  }
  assert.equal(formatWkt(input, { maxInlineLength: -20 }),
    formatWkt(input, { maxInlineLength: 40 }));
  assert.equal(formatWkt(input, { maxInlineLength: Infinity }), formatWkt(input));
  for (const indent of ['', ' \t', '\t ', 'xyz', '\n', '  x']) {
    assert.throws(() => formatWkt(input, { indent }), /Indent must contain spaces or tabs only/u);
  }
});

test('safe nesting boundary accepts depth 256 and rejects 257', () => {
  const atLimit = 'N['.repeat(257) + '"leaf"' + ']'.repeat(257);
  const overLimit = 'N['.repeat(258) + '"leaf"' + ']'.repeat(258);
  const output = formatWkt(atLimit, { maxInlineLength: 40 });
  assert.deepEqual(structuralTokens(output), structuralTokens(atLimit));
  assert.throws(() => formatWkt(overLimit), (error: unknown) =>
    error instanceof WktFormatError && /nesting exceeds safety limit/u.test(error.message));
});

test('retains BOM, quoted newlines and actual outer CRLF and trailing newline', () => {
  const input = '\uFEFFGEOGCRS["a\nb",\r\nDATUM["D",ELLIPSOID["E",6378137,298.257223563]]]\r\n';
  const output = formatWkt(input, { maxInlineLength: 40 });
  assert.ok(output.startsWith('\uFEFFGEOGCRS[\r\n'));
  assert.ok(output.includes('"a\nb"'));
  assert.ok(output.endsWith('\r\n'));
  assert.deepEqual(structuralTokens(output), structuralTokens(input));
  assert.equal(formatWkt(output, { maxInlineLength: 40 }), output);
  assert.ok(!formatWkt('GEOGCRS["No terminal newline"]').endsWith('\n'));
});

test('formats CRLF fixtures on real platform filesystem paths (Windows CI included)', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wkt formatter windows path '));
  try {
    const nested = join(directory, 'folder with spaces');
    mkdirSync(nested);
    const filename = join(nested, 'GDA94 MGA zone 50.wkt2');
    assert.ok(isAbsolute(filename));
    if (process.platform === 'win32') {
      assert.ok(filename.includes(sep)); // Real Windows path, not a synthetic win32 string.
    }
    const input = 'GEOGCRS["With spaces",\r\nDATUM["WGS 84",ELLIPSOID["WGS 84",6378137,298.257223563]]]\r\n';
    writeFileSync(filename, input, 'utf8');
    const output = formatWkt(readFileSync(filename, 'utf8'), { indent: '\t', tabSize: 8, maxInlineLength: 40 });
    writeFileSync(filename, output, 'utf8');
    const onDisk = readFileSync(filename, 'utf8');
    assert.ok(onDisk.startsWith('GEOGCRS[\r\n'));
    assert.ok(!/(?<!\r)\n/u.test(onDisk));
    assert.deepEqual(structuralTokens(onDisk), structuralTokens(input));
    assert.equal(formatWkt(onDisk, { indent: '\t', tabSize: 8, maxInlineLength: 40 }), onDisk);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
