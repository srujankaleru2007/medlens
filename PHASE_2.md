# Phase 2 — Secure medical report ingestion

## Scope

PDF/scanned PDF, JPG/JPEG and PNG uploads; file picker, drag/drop, mobile camera input, per-file queue and retry; private originals; duplicate detection; metadata and processing state; authorized preview and download; PDF page/zoom controls and image zoom; manual intake fallback.

Successful ingestion stops at `UPLOADED`. `QUEUED`, `PROCESSING`, `NEEDS_REVIEW`, and `VERIFIED` are reserved states. No OCR, extraction, reference classification, clinical interpretation, or AI has been implemented.

## Foundation correction

The original Phase 1 scaffold used localStorage for patient records and a client-side identity check. It was not a secure Firebase-backed patient store despite the earlier completion summary. Phase 2 adds Firebase ID-token verification with revocation checks, server-generated patient ownership/provenance, Firestore persistence, actual Firebase sign-out, and authenticated patient APIs. Browser cached identity is never authorization. Demo intake remains browser-only and is explicitly labeled for synthetic data; uploads cannot use demo identity.

Account deletion, reviewer grants, and the remaining unimplemented Phase 1 items are not claimed by this phase. Report access is currently owner-only, including for users with reviewer/admin labels.

## Architecture

- `src/lib/server`: lazy Admin SDK initialization using ADC, verified identity, safe errors, bounded request bodies, shared Firestore rate limits, patient ownership checks.
- `src/app/api/patients`: patient creation/read/update and nested report routes. Patient and report identity never comes from a user-supplied owner field.
- `src/features/reports/validate.ts`: extension/MIME agreement, magic bytes, complete image decode, PDF parse, rejection of encrypted/active-content PDFs, filename normalization, SHA-256.
- `src/features/reports/service.ts`: patient-scoped hash reservation in a transaction, create-only Cloud Storage writes, metadata completion and failure recovery.
- `src/features/reports`: upload queue, source library, private viewer. Binary responses become temporary browser blob URLs, revoked when the viewer closes or changes.

Limits: 10 MB per report, 200 PDF pages, 25 million image pixels, 20 files per queue, 20 upload attempts per account per minute. List responses are paginated in groups of 50. All limits are informational/technical; none imply clinical quality.

Original bytes are never rewritten. Storage writes use `ifGenerationMatch: 0`. If the object write succeeds but metadata completion fails, retry validates the stored object's hash and completes the metadata. An interrupted reservation expires after five minutes. Failed originals are retained; the same file can be selected again. Downloads compare size and SHA-256 before returning bytes.

## Local use

`npm run dev` and `npm start` always default to port **1234**. Production startup requires `npm run build` first.

Without Firebase configuration, the app runs the synthetic intake demo. To exercise uploads locally:

1. Install Java 21+ and run `npm install`.
2. In terminal one run `npm run emulators`.
3. In terminal two run `npm run dev:emulators`.
4. Open http://localhost:1234 and create an email/password account. The launcher sets a `demo-medlens` project and all local emulator addresses. No cloud resources are used.

If using the task's portable runtime on Windows, add `C:\PROJECT-S\MedLens\.tools\java21\jdk-21.0.12.1+1-jre\bin` to PATH in the emulator terminal. This runtime is ignored by Git and is not installed system-wide.

Emulator data is temporary unless separately exported. Never use real medical information in local emulator tests.

## Cloud configuration

Populate `.env.local` from `.env.example`, enable Google and email/password providers, authorize the development domain, and provide ADC to the local server (`gcloud auth application-default login`). In App Hosting use its service account; do not ship service-account keys to the browser or repository. Set the Firebase project and bucket environment values on the server.

Deploy `firestore.rules` and `storage.rules` to your chosen Firebase project before using real records. Both deny direct client access; all record access passes through authorized server routes. Admin SDK bypasses rules, so route tests are required as well as rule tests.

Configure the bucket with uniform bucket-level access and public access prevention. Remove any `allUsers` / `allAuthenticatedUsers` IAM grants. Grant the server only the database, object read/create, and Auth verification access it needs. Security Rules do not override public Google Cloud IAM grants. No deployment or IAM mutation is performed by this implementation.

Validation is not an antivirus service. The PDF validator rejects active content/attachments and malformed files but does not claim universal malware detection. Browser PDF previews depend on native PDF support; the authorized download is the fallback. A user who downloads a report controls that local copy.

## Verification commands

```text
npm run typecheck
npm run lint
npm test
npm run test:emulators
npm run build
```

Run typecheck and build sequentially because Next.js regenerates `.next/types`. `test:emulators` starts temporary Auth/Firestore/Storage services and a Next.js server on port 1234. Stop other servers using that port first. Tests use synthetic documents only. The SDK-boundary tests also inject storage and metadata failures to exercise retry recovery.

## Manual checklist

1. Create account A in the local emulator app; save a patient with synthetic intake fields. Refresh and verify the patient persists.
2. Select a PDF, scanned PDF, JPG, JPEG and PNG together. Upload; each should show `UPLOADED` and remain after refresh.
3. Use drag/drop. On a supported mobile browser use the camera input. Cancel a queued file before starting and verify it was not uploaded.
4. Upload the same bytes with another filename. Expect a duplicate notice and **View existing report**, with no second stored copy.
5. Open a multi-page PDF, change pages and zoom, then download. Compare the downloaded file's SHA-256 with the original. Test image zoom and close the viewer with keyboard controls.
6. Submit an empty file, >10 MB file, corrupted PDF, executable renamed as PDF, and mismatched MIME/extension. Expect rejection without a stored valid report.
7. Disconnect the network for an upload, then restore it and retry. Other queued files must still be handled separately. For an interrupted reservation, wait five minutes before retrying the same file.
8. Sign out. Confirm dashboard redirects to sign-in and unauthenticated report API requests return 401. Sign in as account B: A's patient/report identifiers must return 404, and no A records appear.
9. Try direct Firestore/Storage SDK access as either client account; expect permission denied. Test public cloud bucket access separately after deployment.
10. Use only Tab, Shift+Tab, Enter and Space for intake, file picker, queue controls and viewer. Check focus after errors and viewer closure, 200% browser zoom, narrow viewport, and reduced-motion settings. Native file picker/PDF/camera behavior needs browser/device verification.
11. For a rejected document, follow **manual intake**, save the information, and verify it is labeled patient provided and unverified.

## Phase 3 boundary

Preserved originals, source metadata, page count, hashes and reserved processing states are available to a future Document AI worker. No worker is scheduled and no extraction result is fabricated.

## Verification record

- 27 unit/component/SDK-boundary tests passed, including the original patient validation tests.
- Eight full emulator scenarios passed through Next.js, Auth, Firestore and Storage: authentication rejection, patient creation and update, all four source formats, duplicate handling, cross-account/guessed-ID denial, invalid upload rejection, and direct SDK access denial.
- Next.js was updated from 14 to 15.5.25, with async route parameters, and compatible PostCSS/glob security overrides applied. The latest install audit reports zero high/critical advisories; 13 moderate advisories remain across the dependency tree. No forced SDK downgrade was applied.
- Production build, standalone typecheck and lint passed. A browser smoke test confirmed the landing and sign-in screens render in local emulator mode on port 1234. Cloud IAM, a deployed environment, and physical mobile camera/screen-reader behavior are separate manual checks; emulator results do not establish those.
