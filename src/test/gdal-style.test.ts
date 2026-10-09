import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { formatWkt } from '../formatter';

/** Exact layout requested in issue #16 comments, not the old width-based hybrid. */
const desired = [
  'PROJCS["GDA94 / MGA zone 50",',
  '    GEOGCS["GDA94",',
  '        DATUM["Geocentric_Datum_of_Australia_1994",',
  '            SPHEROID["GRS 1980",6378137,298.257222101,',
  '                AUTHORITY["EPSG","7019"]],',
  '            AUTHORITY["EPSG","6283"]],',
  '        PRIMEM["Greenwich",0],',
  '        UNIT["Degree",0.0174532925199433]],',
  '    PROJECTION["Transverse_Mercator"],',
  '    PARAMETER["false_easting",500000],',
  '    PARAMETER["scale_factor",1],',
  '    UNIT["metre",1,',
  '        AUTHORITY["EPSG","9001"]],',
  '    AXIS["Easting",EAST],',
  '    AXIS["Northing",NORTH]]',
].join('\n');

function flattenLayout(source: string): string {
  let quoted = false;
  let output = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    if (ch === '"') {
      output += ch;
      if (quoted && source[i + 1] === '"') {
        output += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (quoted || !/\s/u.test(ch)) {
      output += ch;
    }
  }
  return output;
}

test('matches precise GDAL/pyproj hierarchy and comma spacing requested by user', () => {
  const input = flattenLayout(desired);
  assert.equal(formatWkt(input), desired);
  assert.equal(formatWkt(desired), desired);
});

test('does not limit leaf line lengths or split scalar values', () => {
  const leaf = 'LEAF["' + 'long scalar value '.repeat(30) + '",1234567890]';
  const input = 'ROOT["x",' + leaf + ',CHILD["y"]]';
  const result = formatWkt(input);
  assert.ok(result.includes('    ' + leaf));
  assert.equal(formatWkt(result), result);
});

test('indentation settings adjust only hierarchy; style remains the same', () => {
  for (const indent of ['  ', '    ', '\t']) {
    const text = formatWkt(flattenLayout(desired), { indent });
    assert.ok(text.startsWith('PROJCS["GDA94 / MGA zone 50",\n' + indent + 'GEOGCS['));
    assert.ok(text.includes('\n' + indent.repeat(3) + 'SPHEROID['));
    assert.equal(formatWkt(text, { indent }), text);
  }
});

test('real EPSG:28350 ESRI/OGC WKT1 and WKT2 use the same lossless style', () => {
  for (const name of ['gda94-mga-zone50.prj', 'gda94-mga-zone50-ogc.wkt',
    'gda94-mga-zone50.wkt2']) {
    const input = readFileSync(resolve(__dirname, '../../fixtures', name), 'utf8');
    const output = formatWkt(input);
    assert.match(output, /^PROJ(?:CS|CRS)\["[^"\n\r]+",\r?\n/u);
    assert.equal(flattenLayout(output), flattenLayout(input));
    assert.equal(formatWkt(output), output);
  }
});

test('mixed bracket styles and WKT2 nested references retain original syntax', () => {
  const input = 'BOUNDCRS(SOURCECRS[GEOGCRS("A",DATUM["B"])],TARGETCRS(GEOGCRS["C",DATUM("D")]))';
  const formatted = formatWkt(input);
  assert.ok(formatted.includes('DATUM["B"])],'));
  assert.ok(formatted.includes('DATUM("D")]))'));
  assert.equal(flattenLayout(formatted), flattenLayout(input));
  assert.equal(formatWkt(formatted), formatted);
});
