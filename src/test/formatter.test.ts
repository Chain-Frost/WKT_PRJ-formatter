import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { formatWkt, WktFormatError } from '../formatter';

const original = readFileSync(
  resolve(__dirname, '../../fixtures/gda94-mga-zone50.prj'), 'utf8',
).trimEnd();

const wkt2 = 'PROJCRS["WGS 84 / UTM zone 50S",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]]],CONVERSION["UTM zone 50S",METHOD["Transverse Mercator",ID["EPSG",9807]],PARAMETER["Longitude of natural origin",117,ANGLEUNIT["degree",0.0174532925199433]]],CS[Cartesian,2],AXIS["Easting (E)",east,ORDER[1],LENGTHUNIT["metre",1]],AXIS["Northing (N)",north,ORDER[2],LENGTHUNIT["metre",1]],ID["EPSG",32750]]';

test('formats supplied ESRI WKT1 PRJ without modifying literals', () => {
  const result = formatWkt(original);
  assert.match(result, /^PROJCS\[\n/u);
  assert.match(result, /SPHEROID\["GRS_1980", 6378137\.0, 298\.257222101\]/u);
  assert.match(result, /PARAMETER\["Central_Meridian", 117\.0\]/u);
  assert.match(result, /GEOGCS\[/u);
  assert.equal(formatWkt(result), result);
});

test('supports nested WKT2 projection definitions and ID, AXIS, ORDER', () => {
  const result = formatWkt(wkt2, { maxInlineLength: 85 });
  assert.match(result, /^PROJCRS\[\n/u);
  assert.match(result, /BASEGEOGCRS\[/u);
  assert.match(result, /ORDER\[2\]/u);
  assert.match(result, /ID\["EPSG", 32750\]/u);
  assert.match(result, /LENGTHUNIT\["metre", 1\]/u);
  assert.equal(formatWkt(result, { maxInlineLength: 85 }), result);
});

test('supports WKT2 BOUNDCRS, nested extensions, and parentheses', () => {
  const input = 'BOUNDCRS(SOURCECRS(GEOGCRS("A",DATUM("B"))),TARGETCRS(GEOGCRS("C",DATUM("D"))),ABRIDGEDTRANSFORMATION("Shift",METHOD("Geocentric translations"),PARAMETER("X",0.000)))';
  const result = formatWkt(input);
  assert.match(result, /^BOUNDCRS\(/u);
  assert.match(result, /PARAMETER\("X", 0\.000\)/u);
  assert.equal(formatWkt(result), result);
});

test('retains escaped quotes, commas, brackets and PROJ metadata inside strings', () => {
  const input = 'GEOGCS["A, [B] ""C""",EXTENSION["PROJ4","+proj=longlat +datum=WGS84"]]';
  const result = formatWkt(input);
  assert.match(result, /"A, \[B\] ""C"""/u);
  assert.match(result, /"\+proj=longlat \+datum=WGS84"/u);
  assert.equal(formatWkt(result), result);
});

test('preserves Windows newlines, UTF-8 BOM and an ending newline', () => {
  const input = '\uFEFF' + wkt2 + '\r\n';
  const result = formatWkt(input);
  assert.ok(result.startsWith('\uFEFFPROJCRS[\r\n'));
  assert.ok(result.endsWith('\r\n'));
  assert.ok(!/(?<!\r)\n/u.test(result));
  assert.equal(formatWkt(result), result);
});

test('indents with tabs or four spaces as selected', () => {
  const input = 'PROJCS["A",GEOGCS["B",DATUM["C"]]]';
  assert.match(formatWkt(input, { indent: '\t', maxInlineLength: 40 }), /\n\tGEOGCS\[/u);
  assert.match(formatWkt(input, { indent: '    ', maxInlineLength: 40 }), /\n {4}GEOGCS\[/u);
});

test('rejects non-WKT PROJ.4 strings rather than editing them', () => {
  assert.throws(() => formatWkt('+proj=utm +zone=50 +south +datum=WGS84'), WktFormatError);
});

test('rejects malformed WKT without attempting partial formatting', () => {
  for (const input of [
    '',
    'PROJCS["A"',
    'PROJCS["A",]',
    'PROJCS["A"] trailing',
    'PROJCS["unterminated]',
    'PROJCS["A",UNIT("metre",1]]',
    'PROJCS["A" "B"]',
    'PROJCS[]',
    'PROJCS["A",,UNIT["metre",1]]',
  ]) {
    assert.throws(() => formatWkt(input), WktFormatError, input);
  }
});

test('does not normalise quoted case, parameter numbers, or exponent notation', () => {
  const input = 'GEOGCRS["aBc",DATUM["d"],AXIS["x",north],ANGLEUNIT["degree",1.74532925199433E-2],ID["EPSG",4326]]';
  const result = formatWkt(input);
  assert.match(result, /1\.74532925199433E-2/u);
  assert.match(result, /"aBc"/u);
  assert.match(result, /north/u);
  assert.equal(formatWkt(result), result);
});
