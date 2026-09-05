import 'server-only';
import { createHash } from 'node:crypto';
import { database, reportBucket } from '@/lib/server/firebase';
import { HttpError } from '@/lib/server/http';
import { ownedPatient, resourceId } from '@/lib/server/patients';
import { draftFromOcr } from './pipeline';
import { documentAiConfigured, processWithGoogleDocumentAi } from '@/lib/server/document-ai';
import type { ExtractedDraft } from './types';
import type { MedicalReport } from '@/features/reports/types';
const reportRef = (patientId: string, reportId: string) => database().collection('patients').doc(patientId).collection('reports').doc(reportId);
const extractionRef = (patientId: string, reportId: string) => database().collection('patients').doc(patientId).collection('extractions').doc(reportId);
async function reportFor(uid: string, patientId: string, reportId: string) { await ownedPatient(uid, patientId); resourceId.parse(reportId); const report = (await reportRef(patientId, reportId).get()).data() as MedicalReport | undefined; if (!report || report.ownerId !== uid || report.patientId !== patientId || report.reportId !== reportId) throw new HttpError(404, 'Report not found.'); return report; }
async function original(report: MedicalReport) { const expected = `patients/${report.patientId}/reports/${report.reportId}/original`; if (report.storagePath !== expected) throw new HttpError(404, 'Report not found.'); const [bytes] = await reportBucket().file(expected).download(); if (bytes.length !== report.size || createHash('sha256').update(bytes).digest('hex') !== report.hash) throw new HttpError(503, 'Report integrity check failed.'); return bytes; }
export async function getExtraction(uid: string, patientId: string, reportId: string): Promise<ExtractedDraft | null> { await reportFor(uid, patientId, reportId); return ((await extractionRef(patientId, reportId).get()).data() as ExtractedDraft | undefined) ?? null; }
export async function processReport(uid: string, patientId: string, reportId: string): Promise<ExtractedDraft> {
  const report = await reportFor(uid, patientId, reportId); if (!documentAiConfigured()) throw new HttpError(503, 'Document AI is not configured. Add a processor before starting extraction.'); if (report.processingStatus === 'UPLOADING') throw new HttpError(409, 'The report upload is not complete yet.');
  const ref = reportRef(patientId, reportId); const extraction = extractionRef(patientId, reportId); await ref.update({ processingStatus: 'QUEUED', processingError: null });
  try { await ref.update({ processingStatus: 'PROCESSING' }); const ocr = await processWithGoogleDocumentAi(await original(report), report); const draft = draftFromOcr(report, ocr); await extraction.set(draft); await ref.update({ processingStatus: 'NEEDS_REVIEW', processedAt: new Date().toISOString(), extractionId: draft.extractionId, processingError: null }); return draft; }
  catch (error) { await ref.update({ processingStatus: 'FAILED', processingError: 'Document processing failed. The original source is preserved.' }); if (error instanceof HttpError) throw error; throw new HttpError(503, 'Document processing failed. The original source is preserved. Retry when the processor is available.'); }
}
