# MedLens — Technical Requirements Document

## 1. Product

**Name:** MedLens

**Description:** AI-powered clinical information intelligence platform that transforms fragmented medical information into structured, understandable, traceable and reviewable patient records.

---

# 2. Core Technical Principles

MedLens SHALL:

* store structured records rather than only LLM responses;
* preserve the original source;
* retain provenance;
* separate extracted and verified information;
* only classify reference-range status using ranges from source reports;
* expose uncertainty;
* support human correction;
* avoid diagnosis and treatment advice;
* implement server-side authorization;
* protect medical documents;
* be keyboard and screen-reader usable;
* provide safe fallbacks when AI fails.

---

# 3. Technology Stack

## Application

* Next.js
* React
* TypeScript
* Node.js
* Tailwind CSS

## Google/Firebase Platform

### Authentication

Firebase Authentication

### Primary Database

Cloud Firestore

### Document Storage

Firebase Storage / Google Cloud Storage

### Document Processing

Google Cloud Document AI

### Hosting

Firebase App Hosting

### Background Compute

Google Cloud Run / Cloud Run Functions where required

### Asynchronous Processing

Google Cloud Tasks and/or Pub/Sub where useful

### Secrets

Google Secret Manager

### Application Protection

Firebase App Check

### Bot/Abuse Protection

Google reCAPTCHA where appropriate

### Logs

Google Cloud Logging

### Monitoring

Google Cloud Monitoring

### Performance

Firebase Performance Monitoring

### Product Analytics

Firebase Analytics / Google Analytics

No protected medical content should be inserted into ordinary analytics events.

### Optional Privacy Tooling

Google Cloud Sensitive Data Protection

---

# 4. External Dependency

Only the generative AI API may be non-Google.

The application SHALL abstract this behind:

```ts
interface AIProvider {
  extractStructuredData(input: AIExtractionInput): Promise<AIExtractionResult>;
  generatePatientSummary(input: SummaryInput): Promise<SummaryResult>;
  generateClarifications(input: ClarificationInput): Promise<ClarificationResult>;
}
```

Changing providers must not require modifying core business logic.

---

# 5. High-Level Architecture

```text
Browser
   │
   ▼
Next.js Application
   │
   ├──────── Firebase Authentication
   │
   ├──────── Firebase App Check
   │
   ▼
Server/API Layer
   │
   ├──────── Authorization
   ├──────── Zod Validation
   ├──────── Rate Limiting
   │
   ├──────── Firestore
   │
   ├──────── Cloud Storage
   │
   └──────── Processing Pipeline
                 │
                 ├── Document AI
                 │
                 ├── Structured Parser
                 │
                 ├── External LLM
                 │
                 ├── Schema Validator
                 │
                 ├── Confidence Engine
                 │
                 ├── Reference Range Engine
                 │
                 ├── Conflict Engine
                 │
                 └── Provenance Engine
```

---

# 6. Medical Information Lifecycle

```text
ORIGINAL SOURCE
        ↓
RAW EXTRACTION
        ↓
STRUCTURED DRAFT
        ↓
SCHEMA VALIDATION
        ↓
HUMAN REVIEW
        ↓
VERIFIED RECORD
        ↓
DERIVED INFORMATION
        ↓
SAFE SUMMARY
```

Derived information must always remain distinguishable from source facts.

---

# 7. Firestore Data Model

Recommended top-level model:

```text
users/
patients/
reports/
extractions/
labResults/
medications/
conditions/
allergies/
observations/
conflicts/
clarifications/
summaries/
auditEvents/
shareGrants/
```

Alternative patient-subcollection organization is acceptable if security rules remain manageable.

---

# 8. Patient

Required logical fields:

```ts
Patient {
  id
  ownerId

  displayName
  dateOfBirth
  sex
  bloodGroup?

  symptoms[]
  conditions[]
  allergies[]
  medications[]

  surgeries[]
  familyHistory[]
  lifestyle?
  emergencyNotes?
  additionalNotes?

  createdAt
  updatedAt
}
```

---

# 9. Medical Report

```ts
MedicalReport {
  id
  patientId
  ownerId

  originalFilename
  storagePath
  mimeType
  fileSize
  sha256

  reportType
  reportTypeConfidence?

  reportDate?
  laboratoryName?

  processingStatus

  uploadedBy
  uploadedAt
  processedAt?
}
```

---

# 10. Lab Result

```ts
LabResult {
  id
  patientId
  reportId

  testName
  textualValue
  numericValue?

  unit?

  referenceRangeText?
  referenceLow?
  referenceHigh?
  referenceOperator?

  rangeStatus:
    | "LOW"
    | "NORMAL"
    | "HIGH"
    | "RANGE_UNAVAILABLE"
    | "UNABLE_TO_CLASSIFY"

  extractionConfidence?

  verificationStatus:
    | "UNVERIFIED"
    | "VERIFIED"
    | "CORRECTED"
    | "REJECTED"
    | "UNCERTAIN"

  provenance

  createdAt
  updatedAt
}
```

---

# 11. Provenance

```ts
Provenance {
  sourceType:
    | "USER_PROVIDED"
    | "REPORT_EXTRACTED"
    | "AI_GENERATED"
    | "HUMAN_CORRECTED"
    | "REVIEWER_VERIFIED"

  reportId?
  pageNumber?
  sourceText?
  boundingBox?
  extractionMethod?

  createdBy?
  createdAt
}
```

---

# 12. Reference Range Engine

This SHALL be deterministic application logic.

The LLM SHALL NOT determine reference-range status.

Pseudo-code:

```ts
if (!sourceReferenceRange) {
  return "RANGE_UNAVAILABLE";
}

if (!isCompatible(value, sourceReferenceRange)) {
  return "UNABLE_TO_CLASSIFY";
}

if (belowSourceRange(value, sourceReferenceRange)) {
  return "LOW";
}

if (aboveSourceRange(value, sourceReferenceRange)) {
  return "HIGH";
}

return "NORMAL";
```

Requirements:

* preserve exact original range;
* support common range syntax;
* reject ambiguous comparisons;
* never introduce an external clinical reference range.

---

# 13. Conflict Engine

The engine may identify contradictions.

It SHALL NOT choose the medically correct value.

Example result:

```ts
Conflict {
  id
  patientId

  type
  severity

  sourceA
  sourceB

  description

  status:
    | "OPEN"
    | "RESOLVED"
    | "DISMISSED"

  resolvedBy?
  resolvedAt?
}
```

---

# 14. AI Safety Requirements

The model must not output definitive:

* diagnoses
* disease claims
* treatment plans
* medication recommendations
* dosage modifications
* instructions to stop/start medication
* unsupported clinical claims

AI outputs must be:

1. schema validated;
2. checked against source data;
3. passed through safety validation;
4. labeled as AI generated.

Unsafe output must not be rendered.

---

# 15. Prompt Injection Defense

Medical reports are untrusted data.

Text contained within uploaded reports must NEVER become system instructions.

The processing system SHALL treat report content exclusively as data.

Model prompts must clearly separate:

SYSTEM POLICY

from:

UNTRUSTED REPORT CONTENT

Any instructions found in the document must be ignored as instructions.

---

# 16. Authorization

Every sensitive operation must verify:

```text
authenticated user
        AND
authorized patient/report relationship
```

Protect:

* patients
* reports
* lab results
* medications
* summaries
* exports
* audit history
* shares

A guessed document ID must never grant access.

---

# 17. Storage Security

Medical reports:

* private by default;
* never publicly enumerable;
* retrieved through authorized workflows;
* protected by Firebase/Google Cloud rules.

---

# 18. Application Security

Implement:

* Firebase Auth
* Firestore Security Rules
* Storage Security Rules
* App Check
* server-side authorization
* schema validation
* input sanitization
* upload restrictions
* secure headers
* rate limiting
* least privilege
* secret isolation
* safe logging
* dependency updates
* error sanitization

Never:

* store secrets in Git
* expose external model API keys client-side
* log full medical documents unnecessarily
* put patient medical information in URLs

---

# 19. Secrets

Store:

* external model API credentials
* server credentials
* other sensitive configuration

in Google Secret Manager or secure Firebase App Hosting secret configuration.

---

# 20. Auditability

Audit events include:

```ts
AuditEvent {
  id
  patientId?
  reportId?

  actorId
  action
  targetType
  targetId

  timestamp

  metadata
}
```

Medical contents should not be unnecessarily duplicated into audit logs.

---

# 21. Accessibility Requirements

UI SHALL support:

* keyboard navigation
* logical tab order
* visible focus
* screen readers
* semantic headings
* accessible forms
* field instructions
* error announcements
* accessible tables
* accessible charts
* textual status labels
* 200% zoom
* touch-friendly interactions
* reduced motion

Color cannot be the sole status indicator.

---

# 22. Reliability

Every external operation must have:

* timeout
* error handling
* retry strategy where appropriate
* processing-state persistence
* human-readable failure UI
* manual fallback

A model failure must not corrupt verified patient data.

---

# 23. Background Processing

Long-running document processing should not depend on an open browser request.

Recommended architecture:

Upload

→ create processing job

→ asynchronous Google Cloud worker

→ Document AI

→ structured extraction

→ database update

→ client receives status

Possible Google components:

* Cloud Tasks
* Pub/Sub
* Cloud Run

---

# 24. Search

Support normalized indexes for:

* report type
* date
* test
* medication
* verification status
* reference status

Do not expose other patients' records through global search.

---

# 25. Export

Exports must include provenance.

Patient export:

* readable
* simple
* concise

Review export:

* structured values
* ranges
* provenance
* verification
* unresolved conflicts

Generated files must inherit authorization controls.

---

# 26. Performance Targets

Target:

* responsive initial interface
* incremental processing status
* paginated large histories
* lazy-loaded report previews
* background OCR
* no blocking UI during model processing

---

# 27. Observability

Use Google-native observability.

Track:

* processing duration
* extraction failures
* API failures
* unauthorized attempts
* upload failures
* job failures
* performance

Do not use patient medical information as metric labels.

---

# 28. Testing Strategy

## Unit

Test:

* reference engine
* range parser
* conflict rules
* validators
* authorization helpers
* provenance transformations

## Integration

Test:

* auth
* uploads
* Firestore rules
* Storage rules
* processing pipeline
* Document AI
* external AI adapter

## E2E

Test:

Patient creation
→ report
→ extraction
→ verification
→ evidence
→ summary
→ export.

## Security

Test:

* IDOR
* unauthorized Firestore reads
* unauthorized Storage reads
* forged requests
* malformed upload
* prompt injection
* API-key exposure

## Accessibility

Test:

* keyboard
* screen reader
* automated accessibility tooling
* zoom
* mobile
* reduced motion

---

# 29. Critical Non-Negotiable Rules

### RULE 1

Never invent reference ranges.

### RULE 2

Never diagnose.

### RULE 3

Never recommend treatment.

### RULE 4

Never recommend dosage changes.

### RULE 5

Never convert uncertain extraction into confirmed medical fact.

### RULE 6

Never discard provenance.

### RULE 7

Never silently overwrite verified information.

### RULE 8

Never expose medical files publicly.

### RULE 9

Never rely exclusively on client-side authorization.

### RULE 10

Never allow uploaded report text to control model instructions.

---

# 30. Product Definition of Done

MedLens is complete when a new user can:

Sign up

→ create their patient profile

→ upload medical reports

→ securely process them

→ review structured extraction

→ inspect original evidence

→ verify/correct fields

→ see source-based range status

→ compare reports

→ inspect trends

→ resolve conflicts

→ answer clarification questions

→ receive a safe patient-friendly summary

→ search their history

→ view uncertainties

→ access an audit timeline

→ export their information

→ delete their information

without MedLens acting as a diagnostic or treatment system.
