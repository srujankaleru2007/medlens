"use client";
import { useRef, useState } from 'react';
import type { PatientProfile } from '@/lib/types';
import { patientInputSchema, type PatientInput } from '@/lib/validation/patient';

const blank: PatientInput = { displayName: '', dateOfBirth: '', sex: 'NOT_DISCLOSED', bloodGroup: '', symptoms: '', conditions: '', allergies: '', medications: '', surgeries: '', familyHistory: '', lifestyle: '', emergencyNotes: '', additionalNotes: '' };
const details: Array<[keyof PatientInput, string]> = [['symptoms', 'Symptoms'], ['conditions', 'Known conditions'], ['allergies', 'Allergies'], ['medications', 'Medications'], ['surgeries', 'Previous surgeries'], ['familyHistory', 'Family history'], ['lifestyle', 'Lifestyle information'], ['emergencyNotes', 'Emergency notes'], ['additionalNotes', 'Additional notes']];
const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3';
export function PatientForm({ patient, onSave }: { patient: PatientProfile | null; onSave: (input: PatientInput) => Promise<void> }) {
  const [form, setForm] = useState<PatientInput>(() => patient ? patientInputSchema.parse(patient) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const update = (field: keyof PatientInput, value: string) => { setStatus(''); setForm(previous => ({ ...previous, [field]: value })); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus('');
    const result = patientInputSchema.safeParse(form);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      requestAnimationFrame(() => errorRef.current?.focus()); return;
    }
    setErrors({}); setBusy(true);
    try { await onSave(result.data); setStatus('Patient profile saved. These fields remain patient provided and unverified.'); }
    catch (error) { setErrors({ save: error instanceof Error ? error.message : 'Could not save. Try again.' }); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { setBusy(false); }
  }
  const errorProps = (name: string) => ({ 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  const fieldError = (name: string) => errors[name] && <p id={`${name}-error`} className="mt-1 text-sm text-red-800">{errors[name]}</p>;
  return <section id="patient-intake" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-2xl font-bold">Patient profile & manual intake</h2><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Patient provided · Unverified</span></div>
    <p className="mt-3 text-sm text-slate-600">You can record information here if a report cannot be uploaded. Leave unknown details blank; missing information is not a normal result.</p>
    <form onSubmit={submit} noValidate className="mt-6">
      {Object.keys(errors).length > 0 && <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">Please correct the highlighted fields. {errors.save}</div>}
      <fieldset disabled={busy} className="grid min-w-0 gap-5 md:grid-cols-2"><legend className="sr-only">Patient intake information</legend>
        <label htmlFor="displayName"><span className="font-bold">Name (required)</span><input id="displayName" required maxLength={200} value={form.displayName} onChange={e => update('displayName', e.target.value)} className={inputClass} {...errorProps('displayName')} />{fieldError('displayName')}</label>
        <label htmlFor="dateOfBirth"><span className="font-bold">Date of birth (required)</span><input id="dateOfBirth" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} className={inputClass} {...errorProps('dateOfBirth')} />{fieldError('dateOfBirth')}</label>
        <label htmlFor="sex"><span className="font-bold">Sex</span><select id="sex" value={form.sex} onChange={e => update('sex', e.target.value)} className={inputClass}><option value="NOT_DISCLOSED">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="INTERSEX">Intersex</option></select></label>
        <label htmlFor="bloodGroup"><span className="font-bold">Blood group (optional)</span><input id="bloodGroup" maxLength={20} value={form.bloodGroup ?? ''} onChange={e => update('bloodGroup', e.target.value)} className={inputClass} {...errorProps('bloodGroup')} />{fieldError('bloodGroup')}</label>
        {details.map(([name, label]) => <label key={name} htmlFor={name}><span className="font-bold">{label}</span><textarea id={name} maxLength={2000} rows={3} value={form[name] ?? ''} onChange={e => update(name, e.target.value)} className={inputClass} {...errorProps(name)} />{fieldError(name)}</label>)}
      </fieldset>
      <button disabled={busy} className="mt-6 rounded-xl bg-teal px-6 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : patient ? 'Save changes' : 'Save patient profile'}</button>
      <p role="status" className="mt-3 text-sm text-teal">{status}</p>
    </form>
  </section>;
}
