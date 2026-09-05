# Phase 1 implementation notes

> Historical scaffold notes. Phase 2 corrected browser-only patient persistence and added trusted server authorization. See [PHASE_2.md](./PHASE_2.md) for the current security boundaries, setup and verified scope; the original Phase 1 summary did not establish complete production readiness.

Implemented the application shell, accessible intake workflow, provenance-aware patient profile, sign-in/sign-out flow, protected dashboard route behavior, validation, error/loading states, Firebase emulator configuration, and baseline Firestore/Storage rules.

The app runs in a local demo mode when Firebase environment variables are absent. The Firebase integration boundary is intentionally isolated in `src/lib/auth` and can be connected without changing domain components.

Prepared interfaces only (not implemented): report ingestion route/domain boundary, processing status model, extraction/evidence records, and AI provider adapter. Phase 2+ behavior is intentionally not active.
