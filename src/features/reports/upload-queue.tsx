"use client";
import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { MAX_REPORT_BYTES, type ReportView } from './types';

interface Entry { id: string; file: File; state: 'READY' | 'UPLOADING' | 'UPLOADED' | 'DUPLICATE' | 'FAILED'; message?: string; report?: ReportView; }
export function UploadQueue({ patientId, onUploaded, onView }: { patientId: string; onUploaded: () => void; onView: (report: ReportView) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const patch = (id: string, update: Partial<Entry>) => setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...update } : entry));
  function add(files: FileList | null) {
    if (!files || lock.current) return;
    const selected = Array.from(files);
    if (selected.length + entries.length > 20) { setNotice('Select up to 20 files per queue. Clear completed entries to add more.'); return; }
    setNotice('');
    setEntries(previous => [...previous, ...selected.map(file => ({ id: crypto.randomUUID(), file, state: 'READY' as const }))]);
  }
  function uploadMime(file: File) {
    if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') return file.type;
    const extension = file.name.toLowerCase().split('.').pop();
    return extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
  }
  async function upload(selected: Entry[]) {
    if (lock.current) return;
    lock.current = true; setWorking(true);
    for (const entry of selected) {
      patch(entry.id, { state: 'UPLOADING', message: 'Uploading and validating the original…' });
      try {
        if (!entry.file.size || entry.file.size > MAX_REPORT_BYTES) throw new Error('Choose a nonempty file of 10 MB or smaller.');
        const result = await api<{ report: ReportView; duplicate: boolean }>(`/api/patients/${patientId}/reports`, {
          method: 'POST', headers: { 'Content-Type': uploadMime(entry.file), 'X-Report-Filename': encodeURIComponent(entry.file.name) }, body: entry.file,
        });
        patch(entry.id, { state: result.duplicate ? 'DUPLICATE' : 'UPLOADED', report: result.report, message: result.duplicate ? 'Already stored. No second copy was created.' : 'Original stored. Extraction has not started.' });
      } catch (error) {
        patch(entry.id, { state: 'FAILED', message: error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The request timed out. Refresh or retry; the same file will not create a second copy.' });
      }
    }
    lock.current = false; setWorking(false); onUploaded();
  }
  return <div className="mt-6">
    <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); add(event.dataTransfer.files); }} className="rounded-2xl border-2 border-dashed border-teal/40 bg-mist p-6">
      <h3 className="font-bold">Add original reports</h3><p id="upload-help" className="mt-2 text-sm text-slate-600">Drop files here or choose files below. PDF, scanned PDF, JPG, JPEG, PNG · 10 MB per file · up to 200 PDF pages.</p>
      <label className="mt-4 block font-bold" htmlFor="report-files">Choose reports</label><input id="report-files" type="file" multiple disabled={working} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby="upload-help" onChange={event => { add(event.target.files); event.target.value = ''; }} className="mt-2 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-3 file:font-bold file:text-white" />
      <label htmlFor="camera-file" className="mt-5 block text-sm font-bold">Take a photo (on supported mobile devices)</label><input id="camera-file" type="file" disabled={working} accept="image/jpeg,image/png" capture="environment" onChange={event => { add(event.target.files); event.target.value = ''; }} className="mt-2 block max-w-full text-sm" />
    </div>
    <p role="status" className="mt-2 text-sm text-amber-900">{notice}</p>
    {entries.length > 0 && <><ul aria-label="Upload queue" className="mt-4 space-y-3">{entries.map(entry => <li key={entry.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><span className="break-all font-bold">{entry.file.name}</span><span className="text-xs font-bold">{entry.state}</span></div><p className="mt-2 text-sm text-slate-600" role="status">{entry.message || `${(entry.file.size / 1024).toFixed(0)} KB · Ready for upload`}</p><div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
      {entry.state === 'FAILED' && <button disabled={working} onClick={() => void upload([entry])} className="underline">Retry upload</button>}
      {entry.report && <button onClick={() => onView(entry.report!)} className="text-teal underline">{entry.state === 'DUPLICATE' ? 'View existing report' : 'View original'}</button>}
      <button disabled={working} onClick={() => setEntries(current => current.filter(item => item.id !== entry.id))} className="underline">{entry.state === 'READY' ? 'Cancel' : 'Dismiss'}</button>
    </div></li>)}</ul><button disabled={working || !entries.some(entry => entry.state === 'READY')} onClick={() => void upload(entries.filter(entry => entry.state === 'READY'))} className="mt-4 rounded-xl bg-teal px-5 py-3 font-bold text-white disabled:opacity-50">{working ? 'Uploading…' : 'Upload selected reports'}</button><p className="mt-2 text-xs text-slate-500">Dismissing an entry removes it from this queue only. Originals already stored remain in your report library.</p></>}
  </div>;
}
