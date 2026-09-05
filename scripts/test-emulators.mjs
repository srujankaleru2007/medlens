import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { emulatorEnv } from './emulator-env.mjs';

// This test runner can only use the explicitly named local demo emulators.
const base = 'http://127.0.0.1:1234';
try { await fetch(base, { signal: AbortSignal.timeout(1000) }); throw new Error('Port 1234 is in use. Stop the development server before integration tests.'); }
catch (error) { if (error.message.startsWith('Port 1234')) throw error; }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '1234'], {
  env: { ...process.env, ...emulatorEnv, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
server.stdout.on('data', chunk => { output = (output + chunk).slice(-5000); });
server.stderr.on('data', chunk => { output = (output + chunk).slice(-5000); });
async function request(path, token, options = {}) {
  return fetch(`${base}${path}`, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, signal: AbortSignal.timeout(90000) });
}
async function account(label) {
  const result = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${label}-${Date.now()}@example.test`, password: 'Synthetic-Only-Password-1!', returnSecureToken: true }),
  });
  assert.equal(result.status, 200); return (await result.json()).idToken;
}
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Wait for startup. */ }
    if (server.exitCode !== null) throw new Error(output);
    await setTimeout(1000);
  }
  assert.ok(ready, `Application did not start: ${output}`);
  const alice = await account('alice'); const bob = await account('bob');
  const intake = { displayName: 'Synthetic Patient', dateOfBirth: '1990-04-12', sex: 'NOT_DISCLOSED', symptoms: '', conditions: '', allergies: '', medications: '', surgeries: '', familyHistory: '' };
  let patient;
  await check('anonymous and forged credentials denied', async () => {
    assert.equal((await request('/api/patients')).status, 401);
    assert.equal((await request('/api/patients', 'forged')).status, 401);
  });
  await check('patient creation and persistent read', async () => {
    const result = await request('/api/patients', alice, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(intake) });
    assert.equal(result.status, 201, await result.clone().text()); patient = (await result.json()).patient;
    assert.equal(patient.fieldProvenance.displayName.sourceType, 'USER_PROVIDED');
    assert.ok((await (await request('/api/patients', alice)).json()).patients.some(value => value.id === patient.id));
    assert.equal((await (await request('/api/patients', bob)).json()).patients.length, 0);
  });
  await check('patient update retains provenance and rejects other account', async () => {
    const options = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...intake, symptoms: 'Patient-provided synthetic note' }) };
    assert.equal((await request(`/api/patients/${patient.id}`, bob, options)).status, 404);
    const result = await request(`/api/patients/${patient.id}`, alice, options); assert.equal(result.status, 200);
    assert.equal((await result.json()).patient.fieldProvenance.displayName.createdAt, patient.fieldProvenance.displayName.createdAt);
  });
  const prefix = `/api/patients/${patient.id}/reports`;
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
  const jpeg = await sharp(png).jpeg().toBuffer();
  const pdf = await PDFDocument.create(); pdf.addPage().drawText('Synthetic document - no clinical information'); pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const scanned = await PDFDocument.create(); const image = await scanned.embedPng(png); scanned.addPage().drawImage(image);
  async function upload(data, name, mime, token = alice, path = prefix) { return request(path, token, { method: 'POST', headers: { 'Content-Type': mime, 'X-Report-Filename': encodeURIComponent(name) }, body: data }); }
  let report;
  await check('PDF, scanned PDF, JPEG and PNG originals persist', async () => {
    for (const [data, name, mime] of [[bytes, 'synthetic.pdf', 'application/pdf'], [Buffer.from(await scanned.save()), 'scan.pdf', 'application/pdf'], [png, 'image.png', 'image/png'], [jpeg, 'image.jpg', 'image/jpeg']]) {
      const result = await upload(data, name, mime); assert.equal(result.status, 201, await result.clone().text());
      const uploaded = (await result.json()).report;
      assert.equal(uploaded.processingStatus, 'UPLOADED'); assert.equal(uploaded.storagePath, undefined);
      const download = await request(`${prefix}/${uploaded.reportId}/file`, alice);
      assert.equal(download.status, 200, await download.clone().text());
      assert.equal(download.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), data);
      if (name.endsWith('synthetic.pdf')) report = uploaded;
    }
    assert.equal((await (await request(prefix, alice)).json()).reports.length, 4);
  });
  await check('duplicate warning preserves the original and does not create a copy', async () => {
    const response = await upload(bytes, 'renamed.pdf', 'application/pdf'); assert.equal(response.status, 200);
    const duplicate = await response.json(); assert.equal(duplicate.duplicate, true); assert.equal(duplicate.report.reportId, report.reportId);
    assert.equal((await (await request(prefix, alice)).json()).reports.length, 4);
  });
  await check('cross-account, wrong patient, wrong report and unauthenticated reads denied', async () => {
    assert.equal((await request(prefix, bob)).status, 404);
    assert.equal((await upload(bytes, 'a.pdf', 'application/pdf', bob)).status, 404);
    assert.equal((await request(`${prefix}/${report.reportId}/file`, bob)).status, 404);
    assert.equal((await request(`${prefix}/${report.reportId}/file`)).status, 401);
    assert.equal((await request(`${prefix}/missing/file`, alice)).status, 404);
    assert.equal((await request(`/api/patients/missing/reports/${report.reportId}/file`, alice)).status, 404);
  });
  await check('spoofed, malformed, empty and oversized documents rejected', async () => {
    assert.equal((await upload(Buffer.from('MZ executable'), 'a.pdf', 'application/pdf')).status, 422);
    assert.equal((await upload(bytes, 'a.pdf', 'image/png')).status, 422);
    assert.equal((await upload(bytes.subarray(0, 40), 'broken.pdf', 'application/pdf')).status, 422);
    assert.equal((await upload(Buffer.alloc(0), 'empty.pdf', 'application/pdf')).status, 422);
    assert.equal((await upload(Buffer.alloc(10 * 1024 * 1024 + 1), 'large.pdf', 'application/pdf')).status, 413);
  });
  await check('direct Firestore and Storage SDK access denied by rules', async () => {
    const firestore = await fetch(`http://127.0.0.1:8080/v1/projects/demo-medlens/databases/(default)/documents/patients/${patient.id}`, { headers: { Authorization: `Bearer ${alice}` } });
    assert.equal(firestore.status, 403);
    const path = encodeURIComponent(`patients/${patient.id}/reports/${report.reportId}/original`);
    const storage = await fetch(`http://127.0.0.1:9199/v0/b/demo-medlens.appspot.com/o/${path}?alt=media`, { headers: { Authorization: `Bearer ${alice}` } });
    assert.equal(storage.status, 403);
  });
  console.log(`${passed} emulator integration scenarios passed.`);
} catch (error) { console.error(error); console.error(output); process.exitCode = 1; }
finally { server.kill('SIGTERM'); }
