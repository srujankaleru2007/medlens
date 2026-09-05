export type RangeStatus = 'LOW' | 'NORMAL' | 'HIGH' | 'RANGE_UNAVAILABLE' | 'UNABLE_TO_CLASSIFY';
export type RangeOperator = '<' | '<=' | '>' | '>=' | 'BETWEEN';
export interface ParsedRange { operator: RangeOperator; lower?: number; upper?: number; raw: string; }
export interface RangeResult { status: RangeStatus; sourceRange?: string; reason?: string; }
const numberPattern = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const parseNumber = (value: string) => Number(value.replace(/,/g, ''));
export function parseSourceRange(raw?: string | null): ParsedRange | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/–|—/g, '-');
  const between = new RegExp(`^(${numberPattern})\\s*(?:-|to)\\s*(${numberPattern})$`, 'i').exec(text);
  if (between) { const lower = parseNumber(between[1]); const upper = parseNumber(between[2]); return lower <= upper ? { operator: 'BETWEEN', lower, upper, raw } : null; }
  const oneSided = new RegExp(`^(<=|>=|<|>)\\s*(${numberPattern})$`).exec(text);
  if (oneSided) return { operator: oneSided[1] as RangeOperator, lower: parseNumber(oneSided[2]), raw };
  return null;
}
export function classifyAgainstSourceRange(value: number | null | undefined, sourceRange?: string | null, unitCompatible = true): RangeResult {
  if (!sourceRange?.trim()) return { status: 'RANGE_UNAVAILABLE', reason: 'No usable reference range exists in the same source report.' };
  if (value === null || value === undefined || !Number.isFinite(value)) return { status: 'UNABLE_TO_CLASSIFY', sourceRange, reason: 'The result is not a finite numeric value.' };
  if (!unitCompatible) return { status: 'UNABLE_TO_CLASSIFY', sourceRange, reason: 'The source value and source range units are incompatible.' };
  const range = parseSourceRange(sourceRange);
  if (!range) return { status: 'UNABLE_TO_CLASSIFY', sourceRange, reason: 'The source report range is malformed.' };
  if (range.operator === 'BETWEEN') return { status: value < range.lower! ? 'LOW' : value > range.upper! ? 'HIGH' : 'NORMAL', sourceRange };
  if (range.operator === '<') return { status: value < range.lower! ? 'NORMAL' : 'HIGH', sourceRange };
  if (range.operator === '<=') return { status: value <= range.lower! ? 'NORMAL' : 'HIGH', sourceRange };
  if (range.operator === '>') return { status: value > range.lower! ? 'NORMAL' : 'LOW', sourceRange };
  return { status: value >= range.lower! ? 'NORMAL' : 'LOW', sourceRange };
}
