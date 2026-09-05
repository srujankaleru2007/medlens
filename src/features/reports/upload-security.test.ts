import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { validateReport } from './validate';
import { MAX_REPORT_BYTES } from './types';

async function imageBytes(format: 'png' | 'jpeg') { return sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).toFormat(format).toBuffer(); }
describe('upload security and image coverage', () => {
  it.each([['png', 'png', 'image/png'], ['jpg', 'jpeg', 'image/jpeg'], ['jpeg', 'jpeg', 'image/jpeg']] as const)('decodes %s', async (extension, format, mime) => {
    expect((await validateReport(await imageBytes(format), `report.${extension}`, mime)).mimeType).toBe(mime);
  });
  it('accepts scanned PDF without extraction', async () => {
    const pdf = await PDFDocument.create(); const image = await pdf.embedPng(await imageBytes('png')); pdf.addPage().drawImage(image);
    expect((await validateReport(Buffer.from(await pdf.save()), 'scan.pdf', 'application/pdf')).pageCount).toBe(1);
  });
  it('rejects an executable renamed as PDF', async () => { await expect(validateReport(Buffer.from('MZ executable'), 'a.pdf', 'application/pdf')).rejects.toThrow(); });
  it('rejects empty and oversized files', async () => {
    await expect(validateReport(Buffer.alloc(0), 'a.pdf', 'application/pdf')).rejects.toThrow('Empty');
    await expect(validateReport(Buffer.alloc(MAX_REPORT_BYTES + 1), 'a.pdf', 'application/pdf')).rejects.toThrow('10 MB');
  });
  it('rejects a truncated image after recognizing its signature', async () => {
    await expect(validateReport((await imageBytes('png')).subarray(0, 30), 'a.png', 'image/png')).rejects.toThrow();
  });
  it('rejects active content within compressed PDF objects', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: 'JavaScript', JS: 'app.alert(1)' }));
    await expect(validateReport(Buffer.from(await pdf.save({ useObjectStreams: true })), 'a.pdf', 'application/pdf')).rejects.toThrow('active content');
  });
  it('rejects a document with no pages', async () => {
    const pdf = await PDFDocument.create();
    await expect(validateReport(Buffer.from(await pdf.save({ addDefaultPage: false })), 'a.pdf', 'application/pdf')).rejects.toThrow();
  });
});
