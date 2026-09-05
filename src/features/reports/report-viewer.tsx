"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '@/lib/api-client';
import type { ReportView } from './types';

export function ReportViewer({ report, onClose }: { report: ReportView; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setUrl(''); setError(''); heading.current?.focus();
    async function load() {
      try {
        const response = await authorizedFetch(`/api/patients/${report.patientId}/reports/${report.reportId}/file`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Preview unavailable. Retry or download later.'); }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [report.patientId, report.reportId, attempt]);
  return <section aria-labelledby="viewer-heading" className="mt-6 rounded-2xl border border-teal/30 bg-mist p-5">
    <div className="flex flex-wrap justify-between gap-3"><h3 ref={heading} tabIndex={-1} id="viewer-heading" className="break-all text-xl font-bold">{report.originalFilename}</h3><button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold">Close viewer</button></div>
    <p className="mt-2 text-sm">Original source · {report.processingStatus} · Not extracted or verified</p>
    <dl className="my-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Uploaded</dt><dd>{new Date(report.uploadedAt).toLocaleString()}</dd></div><div><dt className="text-slate-500">Format / size</dt><dd>{report.mimeType} · {(report.size / 1024).toFixed(0)} KB</dd></div><div><dt className="text-slate-500">Pages</dt><dd>{report.pageCount}</dd></div></dl>
    <details className="my-4 text-sm"><summary className="cursor-pointer font-bold">Source integrity metadata</summary><p className="mt-2 break-all">SHA-256: {report.hash}</p><p className="mt-2 break-all">Uploaded by account: {report.uploadedBy}</p></details>
    {error ? <div role="alert">{error} <button onClick={() => setAttempt(value => value + 1)} className="font-bold underline">Retry preview</button></div> : !url ? <p role="status">Loading private original…</p> : <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {report.mimeType === 'application/pdf' && <><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">Previous page</button><span role="status">Page {page} of {report.pageCount}</span><button disabled={page === report.pageCount} onClick={() => setPage(value => value + 1)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">Next page</button></>}
        <label className="text-sm font-bold">Zoom <select value={zoom} onChange={event => setZoom(Number(event.target.value))} className="rounded-lg border bg-white p-2">{[50,75,100,125,150,200].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
        <a href={url} download={report.originalFilename} className="font-bold text-teal underline">Download original</a>
      </div>
      {report.mimeType === 'application/pdf' ? <><iframe key={`${page}-${zoom}`} title={`Original report, page ${page}`} src={`${url}#page=${page}&zoom=${zoom}`} className="h-[65vh] w-full rounded-xl border bg-white" /><p className="mt-2 text-xs text-slate-600">Preview requires a browser with PDF support. If the preview or page controls are unavailable, download the original. Scanned documents have no extracted text yet.</p></> : <div className="max-h-[65vh] overflow-auto rounded-xl border bg-white">{/* Blob URLs cannot use Next image optimization. */}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Original uploaded report: ${report.originalFilename}. No text extraction is available yet.`} style={{ width: `${zoom}%`, maxWidth: 'none' }} /></div>}
    </>}
  </section>;
}
