import 'server-only';
import { z } from 'zod';
import { database } from '@/lib/server/firebase';
import { HttpError } from '@/lib/server/http';
import { ownedPatient, resourceId } from '@/lib/server/patients';
import { extractedDraftSchema } from '@/features/extraction/schemas';
import type { ExtractedDraft } from '@/features/extraction/types';

export const verificationInputSchema = z.object({ action: z.enum(['CONFIRM', 'REJECT', 'CORRECT']), observationId: z.string().min(1).max(200).optional(), textualValue: z.string().max(500).optional(), numericValue: z.number().finite().optional(), unit: z.string().max(80).optional(), referenceRangeText: z.string().max(200).optional() }).superRefine((value, ctx) => { if (value.action === 'CORRECT' && !value.observationId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['observationId'], message: 'An observation is required for correction.' }); });
const ref = (patientId: string, reportId: string) => database().collection('patients').doc(patientId).collection('extractions').doc(reportId);
const reportRef = (patientId: string, reportId: string) => database().collection('patients').doc(patientId).collection('reports').doc(reportId);
export async function verifyExtraction(uid: string, patientId: string, reportId: string, input: unknown): Promise<ExtractedDraft> {
  await ownedPatient(uid, patientId); resourceId.parse(reportId);
  const data = verificationInputSchema.parse(input); const snapshot = await ref(patientId, reportId).get(); const draft = snapshot.data() as ExtractedDraft | undefined;
  if (!draft || draft.ownerId !== uid || draft.patientId !== patientId || draft.reportId !== reportId || draft.status !== 'DRAFT') throw new HttpError(404, 'Extraction draft not found.');
  const updated: ExtractedDraft = structuredClone(draft); const now = new Date().toISOString();
  if (data.action === 'CORRECT') { const observation = updated.observations.find(item => item.id === data.observationId); if (!observation) throw new HttpError(404, 'Observation not found.'); if (data.textualValue !== undefined) observation.textualValue = data.textualValue; if (data.numericValue !== undefined) observation.numericValue = data.numericValue; if (data.unit !== undefined) observation.unit = data.unit; if (data.referenceRangeText !== undefined) observation.referenceRangeText = data.referenceRangeText; observation.provenance = { ...observation.provenance, confidence: 'HIGH', sourceText: data.textualValue ?? observation.provenance.sourceText }; }
  updated.updatedAt = now; await ref(patientId, reportId).set(extractedDraftSchema.parse(updated));
  if (data.action === 'CONFIRM') await reportRef(patientId, reportId).update({ processingStatus: 'VERIFIED', verifiedAt: now, verifiedBy: uid });
  if (data.action === 'REJECT') await reportRef(patientId, reportId).update({ processingStatus: 'FAILED', processingError: 'Extraction rejected during human review.', rejectedAt: now, rejectedBy: uid });
  return updated;
}
