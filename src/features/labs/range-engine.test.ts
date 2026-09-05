import { describe, expect, it } from 'vitest';
import { classifyAgainstSourceRange, parseSourceRange } from './range-engine';
describe('source-report reference range engine', () => {
  it.each([[10, '12 - 15', 'LOW'], [13, '12 - 15', 'NORMAL'], [18, '12 - 15', 'HIGH'], [5, '<= 5', 'NORMAL'], [6, '<5', 'HIGH'], [5, '>= 5', 'NORMAL'], [4, '> 5', 'LOW']])('classifies %s against %s as %s', (value, range, expected) => expect(classifyAgainstSourceRange(value, range).status).toBe(expected));
  it('never substitutes an external range', () => expect(classifyAgainstSourceRange(10).status).toBe('RANGE_UNAVAILABLE'));
  it('handles malformed and incompatible ranges safely', () => { expect(parseSourceRange('not a range')).toBeNull(); expect(classifyAgainstSourceRange(10, '12-15', false).status).toBe('UNABLE_TO_CLASSIFY'); });
});
