"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import type { PatientProfile } from '@/lib/types';
import type { ReportView } from './types';
import type { ExtractedDraft } from '@/features/extraction/types';
import { UploadQueue } from './upload-queue';
import { ReportViewer } from './report-viewer';

export function ReportWorkspace({ patient, enabled }: { patient: PatientProfile | null; enabled: boolean }) {
  const [reports, setReports] = useState<ReportView[]>([]);
  const [selected, setSelected] = useState<ReportView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ExtractedDraft>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const loadReports = useCallback(async (after?: string) => {
    if (!patient || !enabled) return;
    setLoading(true); setError('');
    try {
      const result = await api<{ reports: ReportView[]; nextCursor: string | null }>(`/api/patients/${patient.id}/reports${after ? `?cursor=${after}` : ''}`);
      setReports(previous => after ? [...previous, ...result.reports] : result.reports);
      setCursor(result.nextCursor);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Reports could not be loaded.'); }
    finally { setLoading(false); }
  }, [patient, enabled]);
  useEffect(() => { void loadReports(); }, [loadReports]);
  async function process(report: ReportView) {
    setProcessing(report.reportId); setError('');
    try { const result = await api<{ extraction: ExtractedDraft }>(`/api/patients/${report.patientId}/reports/${report.reportId}/process`, { method: 'POST' }); setDrafts(previous => ({ ...previous, [report.reportId]: result.extraction })); await loadReports(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Document processing failed.'); }
    finally { setProcessing(null); }
  }
  return <section ref={section} tabIndex={-1} id="reports" aria-label="Report library" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-teal">Report library</p><h2 className="mt-2 text-2xl font-bold">Original sources</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Upload a medical document to preserve its original bytes and metadata. Processing status will be visible as later phases add OCR and extraction.</p></div><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{reports.length} stored</span></div>
    {!patient ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Save the patient profile before uploading a report.</p> : !enabled ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Connect Firebase or start the local emulators to enable private report storage.</p> : <UploadQueue patientId={patient.id} onUploaded={() => void loadReports()} onView={setSelected} />}
    {loading && <p role="status" className="mt-5 text-sm text-slate-600">Loading report library…</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} <button onClick={() => void loadReports()} className="font-bold underline">Retry</button></p>}
    {reports.length > 0 && <div className="mt-8"><h3 className="font-bold">Stored reports</h3><ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">{reports.map(report => <li key={report.reportId} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="break-all font-bold">{report.originalFilename}</p><p className="mt-1 text-xs text-slate-500">{report.mimeType} · {(report.size / 1024).toFixed(0)} KB · {report.processingStatus}</p></div><div className="flex flex-wrap gap-3"><button onClick={() => setSelected(report)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">View original</button>{(report.processingStatus === 'UPLOADED' || report.processingStatus === 'FAILED') && <button disabled={processing !== null} onClick={() => void process(report)} className="rounded-lg bg-ink px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{processing === report.reportId ? 'Processing…' : report.processingStatus === 'FAILED' ? 'Retry Document AI' : 'Process with Document AI'}</button>}</div></div>{report.processingError && <p className="mt-2 text-sm text-amber-900">{report.processingError}</p>}{drafts[report.reportId] && <div className="mt-4 rounded-xl bg-mist p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">Draft extraction</p><span className="text-xs font-bold">{drafts[report.reportId].reportType} · {drafts[report.reportId].reportTypeConfidence} · NEEDS REVIEW</span></div><p className="mt-2 text-sm text-slate-600">{drafts[report.reportId].observations.length} observation(s), {drafts[report.reportId].medications.length} medication mention(s), {drafts[report.reportId].ocr.pages.length} OCR page(s), {drafts[report.reportId].ocr.tables.length} table(s).</p><p className="mt-2 text-xs text-slate-600">Draft only. Values retain report, page, source text, extraction method, and confidence metadata. No reference-range status was classified.</p></div>}</li>)}</ul></div>}
    {enabled && patient && <button disabled={loading} onClick={() => void loadReports()} className="mt-4 font-bold text-teal underline">Refresh reports</button>}
    {cursor && <button disabled={loading} onClick={() => void loadReports(cursor)} className="ml-4 mt-4 font-bold text-teal underline">Load more reports</button>}
    {selected && <ReportViewer key={selected.reportId} report={selected} onClose={() => { setSelected(null); section.current?.focus(); }} />}
    <p className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">If an upload fails, add the same file again to retry. Any stored original is preserved. You can also <a href="#patient-intake" className="font-bold text-teal underline">use manual intake</a>. OCR and extraction have not started.</p>
  </section>;
}
