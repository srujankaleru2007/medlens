import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ documents: new Map<string, Record<string, unknown>>(), objects: new Map<string, Buffer>(), failSave: false, failCommit: false }));
// SDK boundary double: real service, validator, authorization and transaction logic run below.
vi.mock('@/lib/server/firebase', () => {
  function doc(path: string) { return { path, get: async () => ({ data: () => mock.documents.get(path) }), collection: (name: string) => collection(`${path}/${name}`) }; }
  function collection(path: string) { return { doc: (id: string) => doc(`${path}/${id}`) }; }
  const db = { collection, runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    get: async (ref: { path: string }) => ({ data: () => mock.documents.get(ref.path) }),
    set: (ref: { path: string }, data: Record<string, unknown>) => {
      if (mock.failCommit && data.processingStatus === 'UPLOADED') throw new Error('Firestore unavailable');
      mock.documents.set(ref.path, data);
    },
    update: (ref: { path: string }, data: Record<string, unknown>) => mock.documents.set(ref.path, { ...mock.documents.get(ref.path), ...data }),
  }) };
  return { database: () => db, reportBucket: () => ({ file: (path: string) => ({
    save: async (bytes: Buffer, options: { preconditionOpts: { ifGenerationMatch: number } }) => {
      if (mock.failSave) throw new Error('Storage unavailable');
      if (options.preconditionOpts.ifGenerationMatch !== 0) throw new Error('Missing immutable-write precondition');
      if (mock.objects.has(path)) throw { code: 412 };
      mock.objects.set(path, bytes);
    },
    download: async () => { const bytes = mock.objects.get(path); if (!bytes) throw new Error('Missing'); return [bytes]; },
  }) }) };
});
import { ingestReport, readReport } from './service';

async function fixture() { const pdf = await PDFDocument.create(); pdf.addPage(); return Buffer.from(await pdf.save()); }
describe('report ingestion and retrieval integration at SDK boundary', () => {
  beforeEach(() => { mock.documents.clear(); mock.objects.clear(); mock.failSave = false; mock.failCommit = false; mock.documents.set('patients/patient-a', { id: 'patient-a', ownerId: 'alice' }); });
  it('saves original bytes, returns metadata, detects duplicates and retrieves original', async () => {
    const bytes = await fixture(); const result = await ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf');
    expect(result.duplicate).toBe(false); expect(result.report.processingStatus).toBe('UPLOADED');
    expect(result.report).not.toHaveProperty('storagePath');
    expect((await ingestReport('alice', 'patient-a', bytes, 'renamed.pdf', 'application/pdf')).duplicate).toBe(true);
    expect(mock.objects.size).toBe(1);
    expect((await readReport('alice', 'patient-a', result.report.reportId)).bytes).toEqual(bytes);
  });
  it('denies cross-account upload and read and guessed patient/report IDs', async () => {
    const bytes = await fixture();
    await expect(ingestReport('bob', 'patient-a', bytes, 'a.pdf', 'application/pdf')).rejects.toMatchObject({ status: 404 });
    await expect(ingestReport('alice', 'missing', bytes, 'a.pdf', 'application/pdf')).rejects.toMatchObject({ status: 404 });
    const result = await ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf');
    await expect(readReport('bob', 'patient-a', result.report.reportId)).rejects.toMatchObject({ status: 404 });
    await expect(readReport('alice', 'patient-a', 'wrong-report')).rejects.toMatchObject({ status: 404 });
  });
  it('persists FAILED and recovers from storage failure', async () => {
    const bytes = await fixture(); mock.failSave = true;
    await expect(ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf')).rejects.toMatchObject({ status: 503 });
    expect(Array.from(mock.documents.values()).some(data => data.processingStatus === 'FAILED')).toBe(true);
    mock.failSave = false;
    expect((await ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf')).report.processingStatus).toBe('UPLOADED');
  });
  it('recovers a metadata failure without overwriting the stored original', async () => {
    const bytes = await fixture(); mock.failCommit = true;
    await expect(ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf')).rejects.toMatchObject({ status: 503 });
    expect(mock.objects.size).toBe(1); mock.failCommit = false;
    const result = await ingestReport('alice', 'patient-a', bytes, 'a.pdf', 'application/pdf');
    expect(result.report.processingStatus).toBe('UPLOADED'); expect(mock.objects.size).toBe(1);
    expect((await readReport('alice', 'patient-a', result.report.reportId)).bytes).toEqual(bytes);
  });
  it('rejects corrupted storage bytes on retrieval', async () => {
    const result = await ingestReport('alice', 'patient-a', await fixture(), 'a.pdf', 'application/pdf');
    mock.objects.set(Array.from(mock.objects.keys())[0], Buffer.from('changed'));
    await expect(readReport('alice', 'patient-a', result.report.reportId)).rejects.toMatchObject({ status: 503 });
  });
});
