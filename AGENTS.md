# AGENTS.md

## Project purpose

NovelReader is an open-source static web application for reading user-provided novel documents in a comfortable browser UI.

## Core principles

1. **Privacy first.** Imported documents and extracted text must remain on the user's device unless a future feature explicitly states otherwise.
2. **Static hosting first.** The application must remain deployable to GitHub Pages without a required backend.
3. **No bundled copyrighted novels.** Fixtures and sample content must be original, public-domain, or otherwise redistributable.
4. **Importer independence.** Reader/domain code must not depend directly on PDF.js or any one file format.
5. **Small modules.** Prefer focused components and services over large files with mixed responsibilities.
6. **Accessible UI.** Controls must be keyboard usable, labeled, responsive, and readable at large font sizes.

## Current scope

PDF import is intentionally deferred. Do not introduce PDF.js or PDF parsing until the PDF-import milestone is started.

The current implementation should focus on:

- library UI
- chapter reading UI
- reader settings
- reading progress
- GitHub Pages deployment
- clean model boundaries for future importers and IndexedDB storage

## Technology

- React
- TypeScript with strict type checking
- Vite
- Browser storage APIs
- GitHub Actions / GitHub Pages

Avoid adding dependencies when browser APIs or small local utilities are sufficient.

## Architecture

Suggested dependency direction:

```text
UI components
    ↓
application state / use-cases
    ↓
domain models
    ↓
storage and importer adapters
```

Importer-specific output should be normalized to domain models such as `Novel` and `Chapter` before the reader renders it.

## Storage

- `localStorage` is acceptable for small settings and prototype progress.
- Novel text and imported files should move to IndexedDB when real imports are implemented.
- Storage access should stay behind small helper/repository modules so implementation can be replaced later.

## Development rules

- Keep `npm run build` passing before merging.
- Prefer explicit TypeScript types at module boundaries.
- Do not use `any` unless interfacing with an unavoidable untyped API, and isolate it when necessary.
- Keep user-visible Japanese copy natural and concise.
- Do not silently upload document contents, analytics payloads containing text, or reading history.
- New persistence formats should include a version or migration strategy once IndexedDB is introduced.

## GitHub Pages

The app must work from a repository subpath. Vite uses a relative base so repository renames do not require changing asset paths.

## Documentation

Update `PLAN.md` when architecture or milestones change, and update `TASKS.md` as work is completed or reprioritized.
