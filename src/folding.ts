/** Bracket-aware folding ranges for WKT1 and WKT2.
 *
 * Indentation-only folding stops at a closing delimiter aligned with the
 * opener and can leave that delimiter visible. A range covering both
 * delimiter lines makes complete CRS subtrees collapsible.
 *
 * Brackets within double-quoted WKT strings are literal, even when strings
 * contain doubled quotes, backslashes or line breaks.
 */
export interface WktFold {
  readonly start: number;
  readonly end: number;
}

type Opening = { readonly char: '[' | '('; readonly line: number };

export function findWktFolds(source: string): WktFold[] {
  const open: Opening[] = [];
  const ranges: WktFold[] = [];
  let line = 0;
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '\r') {
      if (source[index + 1] === '\n') {
        index += 1;
      }
      line += 1;
      continue;
    }
    if (char === '\n') {
      line += 1;
      continue;
    }

    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        index += 1; // Doubled double-quotes are WKT escaped quote characters.
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (quoted) {
      continue;
    }
    if (char === '[' || char === '(') {
      open.push({ char, line });
    } else if (char === ']' || char === ')') {
      const opening = open.pop();
      if (opening === undefined || (opening.char === '[' ? char !== ']' : char !== ')')) {
        // Malformed WKT: do not guess at a new nesting structure.
        open.length = 0;
        continue;
      }
      if (line > opening.line) {
        ranges.push({ start: opening.line, end: line });
      }
    }
  }

  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}
