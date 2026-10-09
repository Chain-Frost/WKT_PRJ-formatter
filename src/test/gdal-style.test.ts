import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { formatWkt } from '../formatter';

const sample = 'PROJCS["GDA_1994_MGA_Zone_50",GEOGCS["GCS_GDA_1994",DATUM["D_GDA_1994",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],UNIT["Meter",1.0]]';

test('GDAL-style hierarchical layout is the only default; nested closing brackets follow child', () => {
  const expected = [
    'PROJCS["GDA_1994_MGA_Zone_50",',
    '    GEOGCS["GCS_GDA_1994",',
    '        DATUM["D_GDA_1994",',
    '            SPHEROID["GRS_1980", 6378137.0, 298.257222101]],',
    '        PRIMEM["Greenwich", 0.0],',
    '        UNIT["Degree", 0.0174532925199433]],',
    '    PROJECTION["Transverse_Mercator"],',
    '    PARAMETER["False_Easting", 500000.0],',
    '    UNIT["Meter", 1.0]]',
  ].join('\n');
  assert.equal(formatWkt(sample), expected);
  assert.equal(formatWkt(expected), expected);
});

test('indentation and tab size follow editor choices, without altering bracket placement', () => {
  for (const indent of ['  ', '    ', '\t']) {
    for (const tabSize of [2, 4, 8]) {
      const options = { indent, tabSize, maxInlineLength: 100 };
      const output = formatWkt(sample, options);
      assert.ok(output.startsWith('PROJCS["GDA_1994_MGA_Zone_50",\n' + indent + 'GEOGCS['));
      assert.ok(output.endsWith('UNIT["Meter", 1.0]]'));
      assert.equal(formatWkt(output, options), output);
    }
  }
});

test('line width keeps short leaves together and wraps long scalar-only leaves', () => {
  const input = 'ROOT["Root",CHILD["a rather long value",1234567890],TAIL["z"]]';
  const narrow = formatWkt(input, { maxInlineLength: 40 });
  const wide = formatWkt(input, { maxInlineLength: 100 });
  assert.match(narrow, /CHILD\["a rather long value",\n {8}1234567890\]/u);
  assert.match(wide, /CHILD\["a rather long value", 1234567890\]/u);
  assert.equal(formatWkt(narrow, { maxInlineLength: 40 }), narrow);
  assert.equal(formatWkt(wide, { maxInlineLength: 100 }), wide);
});

test('handles mixed WKT1/WKT2 brackets, parent-child endings and quoted delimiters', () => {
  const input = String.raw`BOUNDCRS(SOURCECRS[GEOGCRS("A ] \\ ""quote""",DATUM["B"])],TARGETCRS(GEOGCRS["C",DATUM("D")]))`;
  const output = formatWkt(input, { maxInlineLength: 80 });
  assert.ok(output.startsWith('BOUNDCRS(\n'));
  assert.match(output, /DATUM\["B"\]\)\],/u);
  assert.match(output, /DATUM\("D"\)\]\)\)/u);
  assert.equal(formatWkt(output, { maxInlineLength: 80 }), output);
});

test('real EPSG:28350 ESRI WKT1, OGC WKT1 and WKT2 use hierarchical output', () => {
  for (const filename of [
    'gda94-mga-zone50.prj',
    'gda94-mga-zone50-ogc.wkt',
    'gda94-mga-zone50.wkt2',
  ]) {
    const source = readFileSync(resolve(__dirname, '../../fixtures', filename), 'utf8');
    const output = formatWkt(source, { indent: '    ', maxInlineLength: 100 });
    assert.match(output, /^PROJ(?:CS|CRS)\["[^"\r\n]+",\r?\n/u);
    assert.ok(output.split(/\r?\n/u).length > 5, filename);
    assert.equal(formatWkt(output, { indent: '    ', maxInlineLength: 100 }), output);
  }
});
