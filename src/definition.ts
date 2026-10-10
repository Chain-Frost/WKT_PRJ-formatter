/** Dispatch standalone PROJ parameter strings and WKT separately. */
import { formatWkt, type FormatOptions } from './formatter';
import { formatProj } from './proj-formatter';

export function formatDefinition(source: string, options: FormatOptions = {}): string {
  const start = source.replace(/^\uFEFF/u, '').trimStart();
  return start.startsWith('+') ? formatProj(source, options) : formatWkt(source, options);
}
