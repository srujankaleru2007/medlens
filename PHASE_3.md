# Phase 3 — Google Document Intelligence and structured extraction

Phase 3 adds a protected processing action for an uploaded report. Processing moves the report through `QUEUED` and `PROCESSING`, calls Google Cloud Document AI, normalizes OCR text, page layout and tables, creates a deterministic extracted draft, validates the complete draft with Zod, persists it under the patient-owned report space, and finishes at `NEEDS_REVIEW`. A failure moves the report to `FAILED` while the original source remains untouched.

The report library exposes `Process with Document AI` and `Retry Document AI` when a report is `UPLOADED` or `FAILED`. It shows the report type, classification confidence, OCR page/table counts, observation and medication counts, and the `DRAFT · NEEDS REVIEW` boundary. Extraction values keep report ID, page number, source text, extraction method and confidence. The UI states that no reference-range status has been classified.

## Implementation

- `src/lib/server/document-ai.ts` lazily calls the Google Document AI v1 `processDocument` API with the original bytes and report MIME type. The processor resource is formed from `DOCUMENT_AI_PROJECT_ID`, `DOCUMENT_AI_LOCATION`, and `DOCUMENT_AI_PROCESSOR_ID`. Credentials remain server-side through Application Default Credentials or the App Hosting service account.
- The normalizer maps Document AI full text anchors, page paragraphs, dimensions, table rows/cells, and polygon bounds into typed `OcrLayout` data. Bounding boxes are normalized to a small rectangle representation.
- `src/features/extraction/classification.ts` classifies using deterministic source-text terms. It returns `UNKNOWN`/`NEEDS_REVIEW` when no supported signal exists. Classification confidence is extraction/classification confidence, not clinical certainty.
- `src/features/extraction/pipeline.ts` turns OCR lines into draft laboratory and medication mentions. Values are never promoted to verified records. A source reference-range string is carried forward as text only; no low/normal/high decision is made.
- `src/features/extraction/schemas.ts` validates all draft output, nested provenance, bounds, confidence labels, page counts and collection sizes before persistence.
- `src/features/extraction/service.ts` rechecks ownership, validates stored-byte hash and size, updates persisted status, writes the extraction draft, and records `extractionId` and `processedAt` on the report. Errors are safe to users and never include raw report or provider content.

## API

- `POST /api/patients/{patientId}/reports/{reportId}/process` requires a verified Firebase ID token, patient ownership and the shared rate limit. It returns the validated draft when Document AI succeeds.
- `GET /api/patients/{patientId}/reports/{reportId}/process` returns the owner-scoped draft or `null`.

All report IDs are constrained by the existing resource ID validator. Direct Firestore and Storage rules remain denied; the route performs the authorization check before the Admin SDK call. The original report remains private and immutable.

## Configuration

Add these server-side values to `.env.local` or Firebase App Hosting secrets:

```text
DOCUMENT_AI_PROJECT_ID=your-google-project
DOCUMENT_AI_LOCATION=us
DOCUMENT_AI_PROCESSOR_ID=your-processor-id
```

Enable the Document AI API, create a processor in the same location, and grant the runtime service account only the Document AI processor invocation permission plus the already-required Firestore/Storage access. Do not place service-account JSON or private keys in source control. Without these values, the UI remains runnable and reports stay at `UPLOADED`; clicking processing returns a safe configuration error.

The local emulator suite cannot emulate Document AI. Use synthetic documents and a test Document AI processor for an end-to-end cloud test. The deterministic pipeline and normalization tests run without cloud credentials.

## Verification

`npm run typecheck`, `npm run lint`, and `npm test` pass. The unit suite covers supported classification, unknown classification, source-linked draft evidence, schema validation, and the existing Phase 1/2 checks. A real Document AI call remains a deployment-configured integration check because this workspace has no processor credentials.

## Manual checklist

1. Start the app on http://localhost:1234 with Firebase configured and a synthetic patient/report.
2. Set the three Document AI variables, enable the API, and grant the server runtime processor invocation permission.
3. Upload a digital PDF, scanned PDF, table-heavy PDF, JPG and PNG.
4. Select **Process with Document AI**. Confirm the status path `UPLOADED → QUEUED → PROCESSING → NEEDS_REVIEW` and that the report stays preserved.
5. Confirm the classification label and confidence are visible. For an unclear document, confirm `UNKNOWN · NEEDS_REVIEW`.
6. Confirm OCR pages and tables are counted, extracted observations retain source page/text metadata, and medications remain draft/low-confidence mentions.
7. Confirm no `LOW`, `NORMAL`, or `HIGH` reference-range status is shown. Reference-range intelligence starts in Phase 4.
8. Force a processor failure or remove processor configuration. Confirm `FAILED`, a safe retry message, and an unchanged original download.
9. Sign in as a second account and try the first report/process/extraction IDs. Expect `404`; unauthenticated requests expect `401`.
10. Confirm keyboard focus reaches process/retry controls, status text is announced, and the draft message is understandable at 200% zoom.

## Phase 4 boundary

The persisted draft and its evidence metadata are ready for the human verification workspace and Evidence Lens. No confirm/correct/reject workflow, verified-record promotion, deterministic range engine, or clinical interpretation is included in this phase.
