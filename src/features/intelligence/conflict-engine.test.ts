import { describe, expect, it } from 'vitest';
import { detectConflicts, recordCompleteness } from './conflict-engine';
describe('clinical information intelligence foundations', () => {
  it('flags disagreement without choosing a winner', () => { const result = detectConflicts([{ field: 'allergy', value: 'Penicillin', sourceId: 'a' }, { field: 'allergy', value: 'None known', sourceId: 'b' }]); expect(result[0].message).toBe('POSSIBLE CONFLICT — REQUIRES REVIEW'); expect(result[0].firstSource).toBe('a'); });
  it('does not flag identical facts', () => expect(detectConflicts([{ field: 'condition', value: 'Asthma', sourceId: 'a' }, { field: 'condition', value: 'asthma', sourceId: 'b' }])).toHaveLength(0));
  it('provides actionable completeness signals', () => expect(recordCompleteness({ profile: true, reports: 1, verifiedReports: 0, medications: 0, allergies: 0, conditions: 0 }).find(item => item.key === 'verified')?.present).toBe(false));
});
