import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { parseRawGrammar, Registry, type IGrammar, type IToken, type StateStack } from 'vscode-textmate';

const grammarFile = resolve(__dirname, '../../syntaxes/wkt.tmLanguage.json');

async function packagedGrammar(): Promise<IGrammar> {
  const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await loadWASM(Uint8Array.from(wasm).buffer);
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources: string[]) => new OnigScanner(sources),
      createOnigString: (source: string) => new OnigString(source),
    }),
    loadGrammar: async (scopeName: string) => scopeName === 'source.wkt'
      ? parseRawGrammar(readFileSync(grammarFile, 'utf8'), grammarFile)
      : null,
  });
  const grammar = await registry.loadGrammar('source.wkt');
  assert.ok(grammar, 'Actual shipped WKT grammar must load');
  return grammar;
}

function atToken(tokens: IToken[], text: string, position: number): IToken {
  const token = tokens.find(t => t.startIndex <= position && position < t.endIndex);
  assert.ok(token, 'Missing token at ' + position + ' in ' + text);
  return token;
}

function scoped(tokens: IToken[], text: string, needle: string, scope: string): void {
  const position = text.indexOf(needle);
  assert.ok(position >= 0, 'Missing test substring: ' + needle);
  const token = atToken(tokens, text, position);
  assert.ok(token.scopes.includes(scope), JSON.stringify({ needle, scopes: token.scopes }));
}

function notScoped(tokens: IToken[], text: string, needle: string, excluded: string[]): void {
  const position = text.indexOf(needle);
  assert.ok(position >= 0, 'Missing test substring: ' + needle);
  const token = atToken(tokens, text, position);
  for (const scope of excluded) {
    assert.ok(!token.scopes.includes(scope),
      JSON.stringify({ needle, unwantedScope: scope, scopes: token.scopes }));
  }
}

test('shipped grammar highlights names, numeric forms, directions and brackets', async () => {
  const grammar = await packagedGrammar();
  const input = 'PROJCRS["WGS 84",AXIS["X",north],PARAMETER["x",-.001e+2],ID("EPSG",+4326)]';
  const { tokens } = grammar.tokenizeLine(input, null);
  scoped(tokens, input, 'PROJCRS', 'entity.name.function.wkt');
  scoped(tokens, input, 'AXIS', 'entity.name.function.wkt');
  scoped(tokens, input, 'north', 'constant.language.wkt');
  scoped(tokens, input, '-.001e+2', 'constant.numeric.wkt');
  scoped(tokens, input, '+4326', 'constant.numeric.wkt');
  scoped(tokens, input, ']', 'punctuation.definition.wkt');
  scoped(tokens, input, '(', 'punctuation.definition.wkt');
  scoped(tokens, input, ',', 'punctuation.definition.wkt');
  scoped(tokens, input, 'WGS 84', 'string.quoted.double.wkt');
});

test('doubled quotes, raw backslashes, keyword/number/bracket text inside strings stay strings', async () => {
  const grammar = await packagedGrammar();
  const input = String.raw`GEOGCRS["north [AXIS(1e-2)] \\ ""east""",AXIS["Easting",east]]`;
  const { tokens } = grammar.tokenizeLine(input, null);
  for (const needle of ['north', '[AXIS(', '1e-2', 'east""', '\\']) {
    scoped(tokens, input, needle, 'string.quoted.double.wkt');
    notScoped(tokens, input, needle, [
      'entity.name.function.wkt', 'constant.numeric.wkt',
      'constant.language.wkt', 'punctuation.definition.wkt',
    ]);
  }
  scoped(tokens, input, 'AXIS["Easting"', 'entity.name.function.wkt');
  scoped(tokens, input, 'east]', 'constant.language.wkt');
});

test('formatted multiline WKT1 and WKT2 use the shipped grammar and stable scopes', async () => {
  const grammar = await packagedGrammar();
  const lines = [
    'PROJCS[',
    '  "GDA_1994_MGA_Zone_50",',
    '  GEOGCS["GCS_GDA_1994", DATUM["D_GDA_1994"]],',
    '  PARAMETER["False_Easting", 5.0E+05]',
    ']',
    'PROJCRS(',
    '  "Sample",',
    '  AXIS("Northing", north),',
    '  ID("EPSG", 32750)',
    ')',
  ];
  let stack: StateStack | null = null;
  for (const line of lines) {
    const result = grammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    if (line.includes('GEOGCS')) {
      scoped(result.tokens, line, 'GEOGCS', 'entity.name.function.wkt');
      scoped(result.tokens, line, 'GCS_GDA_1994', 'string.quoted.double.wkt');
    }
    if (line.includes('5.0E+05')) {
      scoped(result.tokens, line, '5.0E+05', 'constant.numeric.wkt');
    }
    if (line.includes('north')) {
      scoped(result.tokens, line, 'north', 'constant.language.wkt');
    }
    if (line.includes('32750')) {
      scoped(result.tokens, line, '32750', 'constant.numeric.wkt');
    }
    if (line === ']') {
      scoped(result.tokens, line, ']', 'punctuation.definition.wkt');
    }
    if (line === ')') {
      scoped(result.tokens, line, ')', 'punctuation.definition.wkt');
    }
  }
});

test('shipped grammar highlights standalone PROJ keys, numbers and quoted values', async () => {
  const grammar = await packagedGrammar();
  for (const input of [
    '+proj=utm +zone=50 +south +title="zone 50"',
    '    +k=0.9996 +note=\'two words\'',
  ]) {
    const { tokens } = grammar.tokenizeLine(input, null);
    const name = input.includes('+proj=') ? '+proj' : '+k';
    scoped(tokens, input, name, 'variable.parameter.proj.wkt');
    scoped(tokens, input, '=', 'keyword.operator.assignment.proj.wkt');
    if (input.includes('zone 50')) {
      scoped(tokens, input, 'zone 50', 'string.quoted.double.proj.wkt');
    } else {
      scoped(tokens, input, 'two words', 'string.quoted.single.proj.wkt');
    }
  }
});


test('PROJ DMS degree-minute-second punctuation is not treated as quoted text', async () => {
  const grammar = await packagedGrammar();
  const input = '+proj=longlat +pm=17d40\'W +lat_0=3d41\'14.55"W +title="quoted value" +note=\'two words\' +lon_0=90d';
  const { tokens } = grammar.tokenizeLine(input, null);
  for (const needle of ["17d40'W", "3d41'14.55\"W", '+lon_0']) {
    notScoped(tokens, input, needle, [
      'string.quoted.double.proj.wkt', 'string.quoted.single.proj.wkt',
    ]);
  }
  scoped(tokens, input, '+lon_0', 'variable.parameter.proj.wkt');
  scoped(tokens, input, 'quoted value', 'string.quoted.double.proj.wkt');
  scoped(tokens, input, 'two words', 'string.quoted.single.proj.wkt');
});

test('PROJ quoted escapes do not end the string prematurely', async () => {
  const grammar = await packagedGrammar();
  const input = String.raw`+proj=longlat +title="escaped \"quote\" inside" +zone=50`;
  const { tokens } = grammar.tokenizeLine(input, null);
  scoped(tokens, input, 'escaped ', 'string.quoted.double.proj.wkt');
  scoped(tokens, input, 'quote', 'string.quoted.double.proj.wkt');
  scoped(tokens, input, 'inside', 'string.quoted.double.proj.wkt');
  scoped(tokens, input, '+zone', 'variable.parameter.proj.wkt');
});

test('WKT multiline quoted values retain string scopes through closing quotation', async () => {
  const grammar = await packagedGrammar();
  const first = 'GEOGCRS["first line [AXIS(123)]';
  const second = 'north ""quoted"" text",DATUM["D"]]';
  const a = grammar.tokenizeLine(first, null);
  scoped(a.tokens, first, 'AXIS', 'string.quoted.double.wkt');
  notScoped(a.tokens, first, '123', ['constant.numeric.wkt']);
  const b = grammar.tokenizeLine(second, a.ruleStack);
  scoped(b.tokens, second, 'north', 'string.quoted.double.wkt');
  scoped(b.tokens, second, 'quoted', 'string.quoted.double.wkt');
  notScoped(b.tokens, second, 'north', ['constant.language.wkt']);
  scoped(b.tokens, second, 'DATUM', 'entity.name.function.wkt');
  scoped(b.tokens, second, '"D"', 'string.quoted.double.wkt');
});
