import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { normalizedFilename, UploadValidationError, validateReport } from './validate';

async function pdfBytes() { const pdf = await PDFDocument.create(); pdf.addPage(); return Buffer.from(await pdf.save()); }

describe('medical report upload validation', () => {
  it('accepts a valid PDF and records its page count and hash', async () => {
    const bytes = await pdfBytes();
    const result = await validateReport(bytes, 'cbc.pdf', 'application/pdf');
    expect(result).toMatchObject({ originalFilename: 'cbc.pdf', mimeType: 'application/pdf', pageCount: 1, size: bytes.length });
    expect(result.hash).toHaveLength(64);
  });
  it('rejects a spoofed MIME type and malformed PDF', async () => {
    await expect(validateReport(Buffer.from('%PDF-'), 'report.pdf', 'application/pdf')).rejects.toBeInstanceOf(UploadValidationError);
    await expect(validateReport(Buffer.from('not an image'), 'report.png', 'image/png')).rejects.toBeInstanceOf(UploadValidationError);
    await expect(validateReport(Buffer.from('%PDF-1.7\n%%EOF'), 'report.pdf', 'image/png')).rejects.toBeInstanceOf(UploadValidationError);
  });
  it('normalizes path traversal and unsafe filename characters', () => {
    expect(normalizedFilename('../../patient report<script>.pdf')).toBe('patient report_script_.pdf');
    expect(normalizedFilename('...')).toBe('report');
  });
});
