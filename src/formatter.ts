/**
 * Conservative WKT1/WKT2 formatter.
 *
 * Preserve every input string and bare token, including number spelling,
 * identifiers and case. Uses a GDAL/pyproj-like hierarchical presentation.
 * Only whitespace between structural tokens changes. No line-width heuristic.
 * This is a structural formatter, not a CRS validator or WKT dialect converter.
 */

export class WktFormatError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(message + ' at character ' + (offset + 1));
    this.name = 'WktFormatError';
  }
}

type TokenKind = 'atom' | 'string' | 'open' | 'close' | 'comma';

interface Token {
  readonly kind: TokenKind;
  readonly raw: string;
  readonly offset: number;
}

interface Scalar {
  readonly kind: 'scalar';
  readonly raw: string;
}

interface Node {
  readonly kind: 'node';
  readonly name: string;
  readonly opener: '[' | '(';
  readonly arguments: readonly Value[];
}

type Value = Node | Scalar;

export interface FormatOptions {
  /** One indentation level (spaces or tabs). Defaults to four spaces. */
  readonly indent?: string;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z_0-9]*$/u;
const OPENERS = new Set(['[', '(']);
const CLOSERS = new Set([']', ')']);
const MAX_DEPTH = 256;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    if (/\s/u.test(source[index] ?? '')) {
      index += 1;
      continue;
    }

    const start = index;
    const current = source[index] ?? '';

    if (current === '"') {
      index += 1;
      let closed = false;

      while (index < source.length) {
        const character = source[index];
        if (character === '"' && source[index + 1] === '"') {
          index += 2; // WKT1/WKT2: embedded quotes are doubled, not backslash-escaped.
          continue;
        }
        if (character === '"') {
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }

      if (!closed) {
        throw new WktFormatError('Unterminated quoted string', start);
      }
      tokens.push({ kind: 'string', raw: source.slice(start, index), offset: start });
      continue;
    }

    if (OPENERS.has(current) || CLOSERS.has(current) || current === ',') {
      tokens.push({
        kind: current === ',' ? 'comma' : OPENERS.has(current) ? 'open' : 'close',
        raw: current,
        offset: start,
      });
      index += 1;
      continue;
    }

    while (index < source.length) {
      const character = source[index] ?? '';
      if (/\s/u.test(character) || character === '"' || character === ',' ||
          OPENERS.has(character) || CLOSERS.has(character)) {
        break;
      }
      index += 1;
    }

    tokens.push({ kind: 'atom', raw: source.slice(start, index), offset: start });
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  private peek(ahead = 0): Token | undefined {
    return this.tokens[this.index + ahead];
  }

  private consume(): Token {
    const token = this.peek();
    if (token === undefined) {
      const last = this.tokens[this.tokens.length - 1];
      throw new WktFormatError('Unexpected end of WKT', last === undefined ? 0 : last.offset + last.raw.length);
    }
    this.index += 1;
    return token;
  }

  parse(): Node {
    if (this.tokens.length === 0) {
      throw new WktFormatError('Empty WKT definition', 0);
    }
    const root = this.node(0);
    const trailing = this.peek();
    if (trailing !== undefined) {
      throw new WktFormatError('Unexpected content after WKT root', trailing.offset);
    }
    return root;
  }

  private node(depth: number): Node {
    if (depth > MAX_DEPTH) {
      throw new WktFormatError('WKT nesting exceeds safety limit', this.peek()?.offset ?? 0);
    }

    const name = this.consume();
    if (name.kind !== 'atom' || !IDENTIFIER.test(name.raw)) {
      throw new WktFormatError('Expected WKT element name', name.offset);
    }

    const open = this.consume();
    if (open.kind !== 'open' || (open.raw !== '[' && open.raw !== '(')) {
      throw new WktFormatError('Expected opening bracket after element name', open.offset);
    }

    const closer = open.raw === '[' ? ']' : ')';
    const args: Value[] = [];

    while (true) {
      const next = this.peek();
      if (next === undefined) {
        throw new WktFormatError('Unclosed WKT element ' + name.raw, open.offset);
      }
      if (next.kind === 'close') {
        throw new WktFormatError('Missing value before closing bracket', next.offset);
      }
      if (next.kind === 'comma' || next.kind === 'open') {
        throw new WktFormatError('Expected WKT argument', next.offset);
      }

      if (next.kind === 'atom' && this.peek(1)?.kind === 'open') {
        args.push(this.node(depth + 1));
      } else {
        const value = this.consume();
        args.push({ kind: 'scalar', raw: value.raw });
      }

      const separator = this.consume();
      if (separator.kind === 'close') {
        if (separator.raw !== closer) {
          throw new WktFormatError('Mismatched closing bracket', separator.offset);
        }
        break;
      }
      if (separator.kind !== 'comma') {
        throw new WktFormatError('Expected comma between WKT arguments', separator.offset);
      }
    }

    return { kind: 'node', name: name.raw, opener: open.raw, arguments: args };
  }
}

function sourceLineEnding(source: string, tokens: readonly Token[]): string {
  // Prefer structural whitespace, not line breaks inside quoted WKT strings.
  let previousEnd = 0;
  for (const token of tokens) {
    const separator = source.slice(previousEnd, token.offset).match(/\r\n|\n|\r/u);
    if (separator !== null) {
      return separator[0];
    }
    previousEnd = token.offset + token.raw.length;
  }
  return source.slice(previousEnd).match(/\r\n|\n|\r/u)?.[0] ??
    source.match(/\r\n|\n|\r/u)?.[0] ?? '\n';
}

/**
 * GDAL/pyproj-style hierarchy. Scalers share their parent's line without
 * extra spacing; child elements start on their own indented lines. Brackets
 * close immediately after the last argument, even when it is a child node.
 *
 * No maximum line width: breaking a scalar-only leaf is not part of this style.
 * This function changes layout only; lexical data is never normalized.
 */
function render(node: Node, depth: number, indent: string, lineEnding: string): string {
  let text = node.name + node.opener;
  for (const [index, value] of node.arguments.entries()) {
    if (index > 0) {
      text += ',';
    }
    if (value.kind === 'node') {
      text += lineEnding + indent.repeat(depth + 1) +
        render(value, depth + 1, indent, lineEnding);
    } else {
      text += value.raw;
    }
  }
  return text + (node.opener === '[' ? ']' : ')');
}

/**
 * Return pretty-printed WKT or throw WktFormatError.
 *
 * A PROJ.4 parameters string is not WKT and is intentionally rejected.
 * The original newline style, optional BOM, terminal newline, strings and
 * scalar spelling are retained. Formatting twice yields identical output.
 */
export function formatWkt(source: string, options: FormatOptions = {}): string {
  const tokens = tokenize(source);
  const tree = new Parser(tokens).parse();

  const indent = options.indent ?? '    ';
  if (!/^(?: +|\t+)$/u.test(indent)) {
    throw new Error('Indent must contain spaces or tabs only');
  }

  const lineEnding = sourceLineEnding(source, tokens);
  const finalNewline = source.match(/(?:\r\n|\n|\r)$/u)?.[0] ?? '';
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';

  return bom + render(tree, 0, indent, lineEnding) + finalNewline;
}
