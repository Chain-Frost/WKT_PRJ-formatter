import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { formatDefinition } from '../definition';
import { formatProj, ProjFormatError } from '../proj-formatter';

const fixture = readFileSync(resolve(__dirname, '../../fixtures/gda94-mga-zone50-proj4.prj'), 'utf8');

function simpleParameters(source: string): string[] {
  // Independent oracle for fixtures without quoted whitespace.
  return source.trim().split(/\s+/u);
}

test('EPSG:28350 PROJ.4 PRJ fixture formats without changing ordered parameters', () => {
  const result = formatDefinition(fixture);
  const eol = fixture.match(/\r\n|\n|\r/u)?.[0] ?? '\n';
  assert.equal(result, simpleParameters(fixture).join(eol) + eol);
  assert.deepEqual(simpleParameters(result), simpleParameters(fixture));
  assert.equal(formatDefinition(result), result);
});

test('preserves flags, duplicates, spelling, precision and parameter order', () => {
  const source = '+proj=utm +Zone=050 +zone=50 +south +k=1.000000000000E-07 +zone=50 +no_defs';
  const output = formatProj(source);
  assert.equal(output, simpleParameters(source).join('\n'));
  assert.equal(formatProj(output), output);
});

test('quoted and escaped spaces, quotes and backslashes stay byte-identical', () => {
  const parameters = [
    '+proj=longlat',
    '+title="WGS 84 \\"label\\""',
    "+note='two words'",
    '+path=C:\\\\files\\\\folder',
    '+escaped=two\\ words',
  ];
  const input = parameters.join(' ');
  const output = formatProj(input);
  assert.equal(output, parameters.join('\n'));
  assert.equal(formatProj(output), output);
});

test('literal PROJ tokens inside WKT quoted strings are never transformed', () => {
  const source = 'GEOGCS["A",EXTENSION["PROJ4","+proj=utm +zone=50 +south"]]';
  const output = formatDefinition(source);
  assert.ok(output.includes('"+proj=utm +zone=50 +south"'));
  assert.equal(formatDefinition(output), output);
});

test('DMS apostrophe and second marks remain unquoted scalar data', () => {
  // Literal DMS punctuation documented by PROJ, not string quote delimiters.
  const source = "+proj=longlat +pm=17d40'W +lat_0=3d41'14.55\"W +lon_0=90d";
  const result = formatDefinition(source);
  assert.equal(result, simpleParameters(source).join('\n'));
  assert.equal(formatDefinition(result), result);
});

test('BOM, newline conventions and final-newline policy are stable', () => {
  for (const eol of ['\n', '\r\n', '\r']) {
    for (const terminal of ['', eol]) {
      const input = '\uFEFF+proj=utm' + eol + '+zone=50 +south' + terminal;
      const expected = '\uFEFF+proj=utm' + eol + '+zone=50' + eol + '+south' + terminal;
      assert.equal(formatDefinition(input), expected);
      assert.equal(formatDefinition(expected), expected);
    }
  }
});

test('long quoted values remain on one line, without a width heuristic', () => {
  const long = '+title="' + 'long scalar value '.repeat(100) + '"';
  const source = '+proj=merc ' + long + ' +datum=WGS84';
  const output = formatProj(source);
  assert.equal(output, '+proj=merc\n' + long + '\n+datum=WGS84');
  assert.equal(formatProj(output), output);
});

test('pipeline preserves global parameters and each step boundary in order', () => {
  const source = '+proj=pipeline +ellps=GRS80 +step +proj=merc +step +inv +proj=axisswap +order=2,1';
  for (const indent of ['  ', '    ', '\t']) {
    const expected = [
      '+proj=pipeline', '+ellps=GRS80',
      '+step', indent + '+proj=merc',
      '+step', indent + '+inv', indent + '+proj=axisswap', indent + '+order=2,1',
    ].join('\n');
    const result = formatDefinition(source, { indent });
    assert.equal(result, expected);
    assert.equal(formatDefinition(result, { indent }), result);
    assert.deepEqual(simpleParameters(result), simpleParameters(source));
  }
});

test('malformed or unsupported PROJ inputs fail closed with a typed explanation', () => {
  for (const input of [
    '', '+proj=', '+zone=50 +south', '+proj=utm bad=parameter',
    '+proj=utm +zone=50 garbage', '+proj=utm +title="unfinished',
    "+proj=utm +title='unfinished", '+proj=utm +bad=ok\\',
    '+proj=utm +bad=two words', '+proj=utm +step +proj=merc',
    '+proj=pipeline', '+proj=pipeline +step', '+proj=pipeline +step +step +proj=merc',
    '+proj=merc +proj=pipeline +step +proj=utm',
    '+proj=utm\n+title="line\nbreak"',
  ]) {
    assert.throws(() => formatProj(input), ProjFormatError, input);
  }
});

test('WKT still uses the independent WKT parser', () => {
  assert.equal(formatDefinition('ROOT["a",NESTED["b"]]'), 'ROOT["a",\n    NESTED["b"]]');
  assert.throws(() => formatDefinition('ROOT["a",]'));
});

test('PROJ respects the WKT indentation-setting contract', () => {
  for (const indent of ['', ' \t', '\t ', 'x', '\n']) {
    assert.throws(() => formatProj('+proj=utm +zone=50', { indent }), /Indent must contain/u);
  }
});


/**
 * Independent PROJ lexical preservation oracle. Unlike the production parser,
 * it only discovers parameter boundaries without interpreting projection
 * operations, pipeline grouping or the validity of individual keys.
 */
function independentProjParameters(source: string): string[] {
  const parameters: string[] = [];
  let index = source.startsWith('\uFEFF') ? 1 : 0;
  while (index < source.length) {
    if (/\s/u.test(source[index] ?? '')) {
      index += 1;
      continue;
    }
    const start = index;
    let quoted: '"' | "'" | undefined;
    while (index < source.length) {
      const character = source[index] ?? '';
      if (character === '\\' && index + 1 < source.length) {
        index += 2;
        continue;
      }
      if (character === '"' || character === "'") {
        if (quoted === character) {
          quoted = undefined;
        } else if (quoted === undefined && source[index - 1] === '=') {
          quoted = character;
        }
      }
      if (quoted === undefined && /\s/u.test(character)) {
        break;
      }
      index += 1;
    }
    parameters.push(source.slice(start, index));
  }
  return parameters;
}

test('complete PROJ tokens survive formatting with quoted and escaped values, DMS and duplicates', () => {
  const input = "+proj=longlat +title=\"A B \\\"label\\\"\" +note='two words' +escaped=two\\ words +pm=17d40'W +lat_0=3d41'14.55\"W +zone=050 +zone=050";
  const expected = independentProjParameters(input);
  assert.equal(expected.length, 9);
  for (const indent of ['  ', '    ', '\t']) {
    const formatted = formatDefinition(input, { indent });
    assert.deepEqual(independentProjParameters(formatted), expected);
    assert.equal(formatted, expected.join('\n'));
    assert.equal(formatDefinition(formatted, { indent }), formatted);
  }
});

test('complete pipeline parameter tokens survive step indentation and CRLF', () => {
  const input = '\uFEFF+proj=pipeline\r\n+ellps=GRS80 +step +proj=merc +title="two words"' +
    '\r\n+step +inv +proj=axisswap +order=2,1\r\n';
  const before = independentProjParameters(input);
  const formatted = formatDefinition(input, { indent: '\t' });
  assert.deepEqual(independentProjParameters(formatted), before);
  assert.ok(formatted.includes('\r\n+step\r\n\t+proj=merc'));
  assert.equal(formatDefinition(formatted, { indent: '\t' }), formatted);
});
