export interface ConflictCandidate { field: string; first: string; second: string; firstSource: string; secondSource: string; message: 'POSSIBLE CONFLICT — REQUIRES REVIEW'; }
export function detectConflicts(entries: Array<{ field: string; value: string; sourceId: string }>): ConflictCandidate[] {
  const conflicts: ConflictCandidate[] = [];
  for (let index = 0; index < entries.length; index += 1) for (let next = index + 1; next < entries.length; next += 1) {
    const first = entries[index]; const second = entries[next];
    if (first.field === second.field && first.value.trim().toLowerCase() !== second.value.trim().toLowerCase()) conflicts.push({ field: first.field, first: first.value, second: second.value, firstSource: first.sourceId, secondSource: second.sourceId, message: 'POSSIBLE CONFLICT — REQUIRES REVIEW' });
  }
  return conflicts;
}

export interface CompletenessSignal { key: string; label: string; present: boolean; action: string; }
export function recordCompleteness(record: { profile: boolean; reports: number; verifiedReports: number; medications: number; allergies: number; conditions: number }): CompletenessSignal[] {
  return [
    { key: 'profile', label: 'Patient profile', present: record.profile, action: 'Complete your patient profile.' },
    { key: 'reports', label: 'Source reports', present: record.reports > 0, action: 'Add a medical report or use manual intake.' },
    { key: 'verified', label: 'Human-reviewed reports', present: record.verifiedReports > 0, action: 'Review an extracted report before relying on it.' },
    { key: 'medications', label: 'Medication list', present: record.medications > 0, action: 'Add current medications if relevant.' },
    { key: 'allergies', label: 'Allergy list', present: record.allergies > 0, action: 'Record allergies or explicitly confirm none are known.' },
    { key: 'conditions', label: 'Condition history', present: record.conditions > 0, action: 'Add known conditions or medical history.' },
  ];
}
