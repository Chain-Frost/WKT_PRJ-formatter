import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { formatWkt, WktFormatError } from '../formatter';

const esri = readFileSync(resolve(__dirname, '../../fixtures/gda94-mga-zone50.prj'), 'utf8').trimEnd();
const wkt2 = readFileSync(resolve(__dirname, '../../fixtures/gda94-mga-zone50.wkt2'), 'utf8').trimEnd();

test('GDAL-style WKT1 retains literal numbers and leaf elements', () => {
  const result = formatWkt(esri);
  assert.match(result, /^PROJCS\["GDA_1994_MGA_Zone_50",\n/u);
  assert.ok(result.includes('SPHEROID["GRS_1980",6378137.0,298.257222101]'));
  assert.ok(result.includes('PARAMETER["Central_Meridian",117.0]'));
  assert.equal(formatWkt(result), result);
});

test('GDAL-style WKT2 nests elements while preserving scalar spelling', () => {
  const output = formatWkt(wkt2);
  assert.match(output, /^PROJCRS\["GDA94 \/ MGA zone 50",\n/u);
  assert.ok(output.includes('ID["EPSG",32750]'));
  assert.ok(output.includes('SCALEUNIT["unity",1]'));
  assert.ok(output.includes('BBOX[-38.53,114,-12.06,120.01]'));
  assert.equal(formatWkt(output), output);
});

test('mixed parentheses and square brackets retain their delimiter types', () => {
  const input = 'BOUNDCRS(SOURCECRS(GEOGCRS("A",DATUM("B"))),TARGETCRS[GEOGCRS("C",DATUM("D"))])';
  const output = formatWkt(input);
  assert.ok(output.startsWith('BOUNDCRS(\n'));
  assert.ok(output.includes('DATUM("B")))'));
  assert.ok(output.includes('DATUM("D"))])'));
  assert.equal(formatWkt(output), output);
});

test('quoted commas, brackets, doubled quotes and literal backslashes are data', () => {
  const input = 'GEOGCS["A, [B] ""C"" \\",EXTENSION["PROJ4","+proj=longlat +datum=WGS84"]]';
  const output = formatWkt(input);
  assert.ok(output.includes('"A, [B] ""C"" \\"'));
  assert.ok(output.includes('"+proj=longlat +datum=WGS84"'));
  assert.equal(formatWkt(output), output);
});

test('LF, CRLF, BOM and final-newline choices survive unchanged', () => {
  for (const eol of ['\n', '\r\n', '\r']) {
    for (const terminal of ['', eol]) {
      const input = '\uFEFFGEOGCRS["a",'+eol+'DATUM["b"]]'+terminal;
      const output = formatWkt(input);
      assert.ok(output.startsWith('\uFEFFGEOGCRS["a",'+eol));
      assert.ok(output.endsWith('DATUM["b"]]'+terminal));
      assert.equal(formatWkt(output), output);
    }
  }
});

test('newline inside a quoted scalar does not override document line endings', () => {
  const input = 'GEOGCRS["first\nsecond",\r\nDATUM["D"]]\r\n';
  const output = formatWkt(input);
  assert.ok(output.startsWith('GEOGCRS["first\nsecond",\r\n'));
  assert.ok(output.endsWith('DATUM["D"]]\r\n'));
  assert.equal(formatWkt(output), output);
});

test('respects two-space, four-space and tab indentation', () => {
  const input = 'ROOT["first",NESTED["child",SUB["leaf"]]]';
  for (const indent of ['  ', '    ', '\t']) {
    const options = { indent };
    const result = formatWkt(input, options);
    assert.ok(result.includes('\n'+indent+'NESTED['));
    assert.ok(result.includes('\n'+indent.repeat(2)+'SUB['));
    assert.equal(formatWkt(result, options), result);
  }
});

test('malformed WKT and unsupported PROJ.4 fail closed with WktFormatError', () => {
  for (const input of ['', '+proj=utm +zone=50', 'ROOT[]', 'ROOT["x"', 'ROOT["x",]',
    'ROOT["x"] extra', 'ROOT["unterminated]', 'ROOT["x",UNIT("m",1]]']) {
    assert.throws(() => formatWkt(input), WktFormatError, input);
  }
  const proj = readFileSync(resolve(__dirname, '../../fixtures/gda94-mga-zone50-proj4.prj'), 'utf8');
  assert.throws(() => formatWkt(proj), WktFormatError);
});

test('safe nesting limit is explicit rather than a call stack overflow', () => {
  const limit = 'N['.repeat(257) + '"x"' + ']'.repeat(257);
  const exceeds = 'N['.repeat(258) + '"x"' + ']'.repeat(258);
  assert.ok(formatWkt(limit).startsWith('N[\n'));
  assert.throws(() => formatWkt(exceeds), (error: unknown) =>
    error instanceof WktFormatError && /nesting exceeds safety limit/u.test(error.message));
});

test('invalid indentation is rejected', () => {
  for (const indent of ['', '\t ', ' \t', 'x', '\n']) {
    assert.throws(() => formatWkt('ROOT["a"]', { indent }), /Indent must contain/u);
  }
});
