export const EXTRACTION_STATUSES = ['NOT_STARTED', 'QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'FAILED'] as const;
export type ExtractionStatus = typeof EXTRACTION_STATUSES[number];
export const REPORT_TYPES = ['CBC', 'LIPID_PROFILE', 'LIVER_FUNCTION', 'KIDNEY_FUNCTION', 'THYROID', 'GLUCOSE', 'URINE', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'RADIOLOGY', 'PATHOLOGY', 'GENERAL_LABORATORY_REPORT', 'UNKNOWN'] as const;
export type ReportType = typeof REPORT_TYPES[number];
export type Confidence = 'HIGH' | 'MODERATE' | 'LOW' | 'NEEDS_REVIEW';
export interface BoundingBox { x: number; y: number; width: number; height: number; }
export interface OcrPage { pageNumber: number; text: string; width?: number; height?: number; }
export interface OcrTable { pageNumber: number; rows: string[][]; boundingBox?: BoundingBox; }
export interface OcrLayout { text: string; pages: OcrPage[]; tables: OcrTable[]; processedAt: string; extractionMethod: 'GOOGLE_DOCUMENT_AI'; }
export interface SourceEvidence { reportId: string; pageNumber?: number; sourceText: string; boundingBox?: BoundingBox; extractionMethod: 'GOOGLE_DOCUMENT_AI'; confidence: Confidence; createdAt: string; }
export interface ExtractedLabResult { id: string; testName: string; textualValue: string; numericValue?: number; unit?: string; referenceRangeText?: string; confidence: Confidence; provenance: SourceEvidence; }
export interface ExtractedMedication { id: string; medication: string; strength?: string; frequency?: string; confidence: Confidence; provenance: SourceEvidence; }
export interface ExtractedDraft { extractionId: string; reportId: string; patientId: string; ownerId: string; reportType: ReportType; reportTypeConfidence: Confidence; reportDate?: string; laboratoryName?: string; observations: ExtractedLabResult[]; medications: ExtractedMedication[]; conditions: string[]; symptoms: string[]; notes: string[]; ocr: OcrLayout; status: 'DRAFT' | 'FAILED'; createdAt: string; updatedAt: string; }
