/**
 * Conservative WKT1/WKT2 formatter.
 *
 * Preserve every input string and bare token, including number spelling,
 * identifiers and case. Only whitespace between structural tokens changes.
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
  /** One indentation level: spaces or tab(s). */
  readonly indent?: string;
  /** Maximum length of a node rendered on one line, including indentation. */
  readonly maxInlineLength?: number;
  /** Visual columns per indentation tab (defaults to 4 for standalone calls). */
  readonly tabSize?: number;
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

function compact(node: Node, maxWidth: number): string | undefined {
  if (maxWidth < 1) {
    return undefined;
  }
  let text = node.name + node.opener;

  for (let index = 0; index < node.arguments.length; index += 1) {
    const item = node.arguments[index];
    if (item === undefined) {
      throw new Error('Internal formatter error: missing WKT argument');
    }
    const remaining = maxWidth - text.length;
    const part = item.kind === 'scalar' ? item.raw : compact(item, remaining);
    if (part === undefined) {
      return undefined;
    }
    text += (index === 0 ? '' : ', ') + part;
    if (text.length + 1 > maxWidth) {
      return undefined;
    }
  }

  return text + (node.opener === '[' ? ']' : ')');
}

function indentationWidth(indent: string, tabSize: number): number {
  return Array.from(indent).reduce((width, character) => width + (character === '\t' ? tabSize : 1), 0);
}

function sourceLineEnding(source: string, tokens: readonly Token[]): string {
  // Prefer layout whitespace. A newline inside a quoted WKT name is data,
  // and may differ from the document's actual line-ending convention.
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

function render(
  node: Node, depth: number, indent: string, lineEnding: string, width: number, tabSize: number,
): string {
  const oneline = compact(node, width - depth * indentationWidth(indent, tabSize));
  if (oneline !== undefined) {
    return oneline;
  }

  const lines = node.arguments.map((value) => {
    const content = value.kind === 'scalar'
      ? value.raw
      : render(value, depth + 1, indent, lineEnding, width, tabSize);
    return indent.repeat(depth + 1) + content;
  });

  const closing = node.opener === '[' ? ']' : ')';
  return node.name + node.opener + lineEnding +
    lines.join(',' + lineEnding) + lineEnding +
    indent.repeat(depth) + closing;
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

  const indent = options.indent ?? '  ';
  if (!/^(?: +|\t+)$/u.test(indent)) {
    throw new Error('Indent must contain spaces or tabs only');
  }

  const requestedWidth = options.maxInlineLength ?? 100;
  const width = Number.isFinite(requestedWidth)
    ? Math.max(40, Math.min(240, Math.trunc(requestedWidth)))
    : 100;

  const requestedTabSize = options.tabSize ?? 4;
  const tabSize = Number.isSafeInteger(requestedTabSize) && requestedTabSize > 0
    ? requestedTabSize : 4;

  const lineEnding = sourceLineEnding(source, tokens);
  const finalNewline = source.match(/(?:\r\n|\n|\r)$/u)?.[0] ?? '';
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';

  return bom + render(tree, 0, indent, lineEnding, width, tabSize) + finalNewline;
}
