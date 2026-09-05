import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { database, reportBucket } from '@/lib/server/firebase';
import { HttpError } from '@/lib/server/http';
import { ownedPatient, resourceId } from '@/lib/server/patients';
import { validateReport } from './validate';
import type { MedicalReport, ReportView } from './types';

function publicReport(report: MedicalReport): ReportView {
  return { reportId: report.reportId, patientId: report.patientId,
    originalFilename: report.originalFilename, mimeType: report.mimeType, size: report.size,
    hash: report.hash, uploadedBy: report.uploadedBy, uploadedAt: report.uploadedAt,
    processingStatus: report.processingStatus, pageCount: report.pageCount, processedAt: report.processedAt, extractionId: report.extractionId, processingError: report.processingError };
}
const reports = (patientId: string) => database().collection('patients').doc(patientId).collection('reports');

export async function listReports(uid: string, patientId: string, cursor?: string) {
  await ownedPatient(uid, patientId);
  if (cursor) resourceId.parse(cursor);
  const base = reports(patientId).orderBy(FieldPath.documentId()).limit(51);
  const result = await (cursor ? base.startAfter(cursor) : base).get();
  const docs = result.docs.slice(0, 50);
  return { reports: docs.map(doc => publicReport(doc.data() as MedicalReport)), nextCursor: result.size > 50 ? docs[49].id : null };
}

export async function ingestReport(uid: string, patientId: string, bytes: Buffer, filename: string, mime: string) {
  await ownedPatient(uid, patientId);
  const validated = await validateReport(bytes, filename, mime);
  // A content hash is scoped to this patient's collection. Concurrent copies share one reservation.
  const ref = reports(patientId).doc(validated.hash);
  const lease = randomUUID();
  const now = new Date().toISOString();
  const candidate: MedicalReport = { ...validated, reportId: validated.hash, patientId, ownerId: uid,
    storagePath: `patients/${patientId}/reports/${validated.hash}/original`, uploadedBy: uid,
    uploadedAt: now, processingStatus: 'UPLOADING' };
  const duplicate = await database().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.data();
    if (existing && existing.processingStatus !== 'FAILED' && existing.processingStatus !== 'UPLOADING') return publicReport(existing as MedicalReport);
    if (existing?.processingStatus === 'UPLOADING' && Number(existing.leaseUntil) > Date.now()) throw new HttpError(409, 'This file is already uploading. Refresh the list shortly, or retry in five minutes if the upload was interrupted.');
    tx.set(ref, { ...candidate, lease, leaseUntil: Date.now() + 300000 });
    return null;
  });
  if (duplicate) return { report: duplicate, duplicate: true };
  try {
    const file = reportBucket().file(candidate.storagePath);
    try {
      await file.save(bytes, { resumable: false, validation: 'crc32c', preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: validated.mimeType, cacheControl: 'private, no-store', metadata: { sha256: validated.hash } } });
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 412)) throw error;
      // Recover a previous successful object write whose metadata commit failed. Never replace it.
      const [original] = await file.download();
      if (createHash('sha256').update(original).digest('hex') !== validated.hash) throw new Error('Stored object integrity mismatch');
    }
    const report: MedicalReport = { ...candidate, processingStatus: 'UPLOADED' };
    await database().runTransaction(async tx => {
      if ((await tx.get(ref)).data()?.lease !== lease) throw new Error('Upload reservation changed');
      tx.set(ref, report);
    });
    return { report: publicReport(report), duplicate: false };
  } catch {
    // Best-effort failure state. If Firestore is unavailable the lease allows later recovery.
    try { await database().runTransaction(async tx => {
      if ((await tx.get(ref)).data()?.lease === lease) tx.update(ref, { processingStatus: 'FAILED', leaseUntil: 0 });
    }); } catch { /* Original object is retained for retry. */ }
    throw new HttpError(503, 'Upload could not be completed. Any saved original is preserved. Retry with the same file.');
  }
}

export async function readReport(uid: string, patientId: string, reportId: string) {
  await ownedPatient(uid, patientId);
  resourceId.parse(reportId);
  const data = (await reports(patientId).doc(reportId).get()).data() as MedicalReport | undefined;
  if (!data || data.ownerId !== uid || data.patientId !== patientId || data.reportId !== reportId) throw new HttpError(404, 'Report not found.');
  if (data.processingStatus === 'UPLOADING') throw new HttpError(409, 'The upload is not complete yet.');
  // FAILED can still have a preserved original from an interrupted commit.
  const expectedPath = `patients/${patientId}/reports/${reportId}/original`;
  if (data.storagePath !== expectedPath) throw new HttpError(404, 'Report not found.');
  const [bytes] = await reportBucket().file(expectedPath).download();
  if (bytes.length !== data.size || createHash('sha256').update(bytes).digest('hex') !== data.hash) throw new HttpError(503, 'Report integrity check failed. The original is preserved; contact the administrator.');
  return { report: publicReport(data), bytes };
}
