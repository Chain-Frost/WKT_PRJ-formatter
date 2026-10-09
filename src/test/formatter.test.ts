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

test('retains doubled quotes, commas, brackets and PROJ metadata inside strings', () => {
  const input = 'GEOGCS["A, [B] ""C""",EXTENSION["PROJ4","+proj=longlat +datum=WGS84"]]';
  const result = formatWkt(input);
  assert.match(result, /"A, \[B\] ""C"""/u);
  assert.match(result, /"\+proj=longlat \+datum=WGS84"/u);
  assert.equal(formatWkt(result), result);
});

test('treats a final reverse solidus inside a WKT2 string as literal', () => {
  const input = String.raw`GEOGCRS["Name ends with \",DATUM["D",ELLIPSOID["E",6378137,298.257223563]]]`;
  const output = formatWkt(input, { maxInlineLength: 50 });
  assert.ok(output.includes(String.raw`"Name ends with \"`));
  assert.match(output, /DATUM\[/u);
  assert.equal(formatWkt(output, { maxInlineLength: 50 }), output);
});

test('preserves reverse solidus beside doubled quotes within WKT2', () => {
  const input = String.raw`GEOGCRS["Path \ ""quoted"" \",DATUM["D",ELLIPSOID["E",6378137,298.257223563]]]`;
  const output = formatWkt(input);
  assert.ok(output.includes(String.raw`"Path \ ""quoted"" \"`));
  assert.equal(formatWkt(output), output);
});

test('supports literal reverse solidus in WKT1 strings', () => {
  const input = String.raw`GEOGCS["Datum \",DATUM["D",SPHEROID["S",6378137,298.257223563]],UNIT["Degree",0.0174532925199433]]`;
  const output = formatWkt(input);
  assert.ok(output.includes(String.raw`"Datum \"`));
  assert.equal(formatWkt(output), output);
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
  const input = 'PROJCS["Long projected CRS name",GEOGCS["Long geographic CRS name",DATUM["Long datum name"]]]';
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

/**
 * Compare the complete significant WKT character stream, rather than selected
 * substrings. Outside quoted strings only whitespace is ignored.
 */
function withoutFormattingWhitespace(source: string): string {
  let inString = false;
  let result = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (character === '"') {
      result += character;
      if (inString && source[index + 1] === '"') {
        result += '"';
        index += 1;
      } else {
        inString = !inString;
      }
    } else if (inString || !/\\s/u.test(character)) {
      result += character;
    }
  }
  assert.equal(inString, false, 'WKT fixture must end outside a quoted string');
  return result;
}

for (const [filename, root] of [
  ['gda94-mga-zone50.prj', 'PROJCS'],
  ['gda94-mga-zone50-ogc.wkt', 'PROJCS'],
  ['gda94-mga-zone50.wkt2', 'PROJCRS'],
] as const) {
  test('formats EPSG:28350 ' + filename + ' losslessly at multiple line widths', () => {
    const input = readFileSync(resolve(__dirname, '../../fixtures/' + filename), 'utf8');
    assert.ok(input.startsWith(root + '['));
    for (const maxInlineLength of [80, 100, 120]) {
      const output = formatWkt(input, { maxInlineLength });
      assert.equal(
        withoutFormattingWhitespace(output),
        withoutFormattingWhitespace(input),
        'all significant tokens must be preserved in ' + filename,
      );
      assert.equal(formatWkt(output, { maxInlineLength }), output);
      assert.ok(output.includes('0.9996'));
    }
  });
}

test('preserves unsupported EPSG:28350 PROJ.4 sample for future #14 coverage', () => {
  const input = readFileSync(
    resolve(__dirname, '../../fixtures/gda94-mga-zone50-proj4.prj'), 'utf8',
  );
  assert.match(input, /^\\+proj=utm \\+zone=50 \\+south /u);
  assert.throws(() => formatWkt(input), WktFormatError);
});
