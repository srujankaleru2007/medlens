export const MAX_REPORT_BYTES = 10 * 1024 * 1024;
export const REPORT_STATUSES = ['UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED'] as const;
export type ProcessingStatus = typeof REPORT_STATUSES[number];
export interface MedicalReport {
  reportId: string;
  patientId: string;
  ownerId: string;
  originalFilename: string;
  storagePath: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  size: number;
  hash: string;
  uploadedBy: string;
  uploadedAt: string;
  processingStatus: ProcessingStatus;
  pageCount: number;
  processedAt?: string;
  extractionId?: string;
  processingError?: string | null;
}
// Internal paths/owner details are not needed in the browser.
export type ReportView = Omit<MedicalReport, 'storagePath' | 'ownerId'>;
