/**
 * Layout-only formatter for standalone PROJ parameter strings.
 *
 * The lexical syntax and pipeline marker follow https://proj.org/. This is
 * deliberately NOT a geodetic validator, PROJ interpreter or WKT converter.
 * Parameter text, repetitions, flags, order and quoting are never rewritten.
 */
export class ProjFormatError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(message + ' at character ' + (offset + 1));
    this.name = 'ProjFormatError';
  }
}

export interface ProjFormatOptions {
  readonly indent?: string;
}

interface Parameter {
  readonly raw: string;
  readonly offset: number;
}

const PARAMETER = /^\+[A-Za-z_][A-Za-z_0-9]*(?:=.+)?$/u;

function tokenizeProj(source: string): Parameter[] {
  const tokens: Parameter[] = [];
  let offset = source.startsWith('\uFEFF') ? 1 : 0;
  while (offset < source.length) {
    if (/\s/u.test(source[offset] ?? '')) {
      offset += 1;
      continue;
    }
    const start = offset;
    let quote: '"' | "'" | undefined;
    while (offset < source.length) {
      const current = source[offset] ?? '';
      if (current === '\\') {
        if (offset + 1 >= source.length || /[\r\n]/u.test(source[offset + 1] ?? '')) {
          throw new ProjFormatError('Incomplete or unsupported backslash escape', offset);
        }
        offset += 2; // Preserve escaped spaces and quoted punctuation.
        continue;
      }
      if (current === '"' || current === "'") {
        if (quote === undefined) {
          quote = current;
        } else if (quote === current) {
          quote = undefined;
        }
        offset += 1;
        continue;
      }
      if (quote !== undefined && /[\r\n]/u.test(current)) {
        throw new ProjFormatError('Multiline quoted PROJ values are unsupported', offset);
      }
      if (quote === undefined && /\s/u.test(current)) {
        break;
      }
      offset += 1;
    }
    if (quote !== undefined) {
      throw new ProjFormatError('Unterminated quoted PROJ value', start);
    }
    const raw = source.slice(start, offset);
    if (!PARAMETER.test(raw)) {
      throw new ProjFormatError('Expected a +name or +name=value PROJ parameter', start);
    }
    tokens.push({ raw, offset: start });
  }
  if (tokens.length === 0) {
    throw new ProjFormatError('Empty PROJ parameter string', 0);
  }
  return tokens;
}

function checkStructure(tokens: readonly Parameter[]): boolean {
  const first = tokens[0];
  const firstProj = tokens.find(token => token.raw.startsWith('+proj='));
  if (firstProj === undefined) {
    throw new ProjFormatError('PROJ parameter string requires +proj=value', first?.offset ?? 0);
  }
  const pipeline = firstProj.raw === '+proj=pipeline';
  if (pipeline && tokens[0]?.raw !== '+proj=pipeline') {
    throw new ProjFormatError('Pipeline must begin with +proj=pipeline', firstProj.offset);
  }
  const otherPipeline = tokens.find(token =>
    token !== firstProj && token.raw === '+proj=pipeline');
  if (otherPipeline !== undefined) {
    throw new ProjFormatError('Nested or repeated +proj=pipeline is unsupported', otherPipeline.offset);
  }
  const steps = tokens.filter(token => token.raw === '+step');
  if (!pipeline && steps.length > 0) {
    throw new ProjFormatError('+step requires a +proj=pipeline definition', steps[0]?.offset ?? 0);
  }
  if (pipeline && steps.length === 0) {
    throw new ProjFormatError('Pipeline has no +step marker', firstProj.offset);
  }
  if (pipeline) {
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index]?.raw === '+step' &&
          (index + 1 === tokens.length || tokens[index + 1]?.raw === '+step')) {
        throw new ProjFormatError('Pipeline +step has no parameters', tokens[index]?.offset ?? 0);
      }
    }
  }
  return pipeline;
}

/**
 * Put each complete parameter on its own line. Pipeline step parameters are
 * indented and each +step remains at column zero, preserving step boundaries.
 */
export function formatProj(source: string, options: ProjFormatOptions = {}): string {
  const indent = options.indent ?? '    ';
  if (!/^(?: +|\t+)$/u.test(indent)) {
    throw new Error('Indent must contain spaces or tabs only');
  }
  const tokens = tokenizeProj(source);
  const pipeline = checkStructure(tokens);
  const eol = source.match(/\r\n|\n|\r/u)?.[0] ?? '\n';
  const finalNewline = source.match(/(?:\r\n|\n|\r)$/u)?.[0] ?? '';
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  let inStep = false;
  const lines = tokens.map(token => {
    if (token.raw === '+step') {
      inStep = true;
      return token.raw;
    }
    return pipeline && inStep ? indent + token.raw : token.raw;
  });
  return bom + lines.join(eol) + finalNewline;
}
