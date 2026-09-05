import { createHash } from 'node:crypto';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { MAX_REPORT_BYTES, type MedicalReport } from './types';

export class UploadValidationError extends Error {}
const fail = (message: string): never => { throw new UploadValidationError(message); };
export function normalizedFilename(name: string): string {
  const leaf = name.normalize('NFKC').split(/[\\/]/).pop() || 'report';
  return leaf.replace(/[^a-zA-Z0-9._ ()-]/g, '_').replace(/^\.+/, '').slice(-120) || 'report';
}
export async function validateReport(bytes: Buffer, filename: string, declaredMime: string) {
  if (!bytes.length) fail('Empty files cannot be uploaded.');
  if (bytes.length > MAX_REPORT_BYTES) fail('Each report must be 10 MB or smaller.');
  const name = normalizedFilename(filename);
  const extension = name.split('.').pop()?.toLowerCase();
  const expected: Record<string, MedicalReport['mimeType']> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  const mimeType = expected[extension ?? ''];
  if (!mimeType || mimeType !== declaredMime) fail('The file extension and MIME type must match PDF, JPG, JPEG, or PNG.');
  let pageCount = 1;
  try {
    if (mimeType === 'application/pdf') {
      if (bytes.subarray(0, 5).toString() !== '%PDF-' || !/%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1'))) fail('This PDF is incomplete or malformed.');
      const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false });
      pageCount = pdf.getPageCount();
      if (pageCount < 1 || pageCount > 200) fail('PDFs must contain between 1 and 200 pages.');
      if (pdf.isEncrypted) fail('Password-protected PDFs are not supported.');
      const forbidden = new Set(['JS', 'JavaScript', 'Launch', 'OpenAction', 'AA', 'EmbeddedFiles', 'EF', 'XFA', 'RichMedia', 'SubmitForm', 'ImportData', 'GoToR', 'URI']);
      // Inspect decoded object dictionaries, including compressed object streams.
      for (const [, object] of pdf.context.enumerateIndirectObjects()) {
        const serialized = object.toString();
        if (serialized.length > MAX_REPORT_BYTES * 2) fail('PDF object exceeds processing limits.');
        const names = serialized.match(/\/[^\s\[\]<>()/]+/g) || [];
        for (const token of names) {
          const decoded = token.slice(1).replace(/#([a-f0-9]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
          if (forbidden.has(decoded)) fail('This PDF contains active content or attachments. Upload a flattened PDF or image.');
        }
        if (object instanceof PDFDict && object.has(PDFName.of('Encrypt'))) fail('Encrypted PDFs are not supported.');
      }
    } else {
      const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if ((mimeType === 'image/png' && !png) || (mimeType === 'image/jpeg' && !jpeg)) fail('The file contents do not match the declared image format.');
      const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' });
      const meta = await image.metadata();
      if (!meta.width || !meta.height || (meta.pages ?? 1) !== 1) fail('Unsupported image dimensions or animation.');
      // Decode the entire image to detect truncation; keep the original bytes unchanged.
      await image.raw().toBuffer();
    }
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    fail('The document could not be read. It may be corrupted, encrypted, or unsupported.');
  }
  return { originalFilename: name, mimeType, pageCount, size: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') };
}
