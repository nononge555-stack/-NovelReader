# AGENTS.md

## Project purpose

NovelReader is an open-source static web application for importing user-provided web-novel PDFs and reading the extracted content in a comfortable browser UI.

## Core principles

1. **Privacy first.** Imported documents and extracted text must remain on the user's device unless a future feature explicitly states otherwise.
2. **Static hosting first.** The application must remain deployable to GitHub Pages without a required backend.
3. **No bundled copyrighted novels.** Fixtures and sample content must be original, public-domain, or otherwise redistributable. Real copyrighted PDFs used for manual verification must not be committed.
4. **Importer independence.** Reader/domain code must not depend directly on PDF.js or any one site/file format.
5. **Site-specific parsers.** Do not force different PDF layouts into one heuristic parser. Keep Hameln, Narou, and future layouts behind focused importer modules that normalize to the same domain model.
6. **No work-specific hacks.** A symbol, scene break, wording pattern, or layout quirk from one novel must not be treated as a site-wide rule without evidence from the site's output format.
7. **Small modules.** Prefer focused components and services over large files with mixed responsibilities.
8. **Accessible UI.** Controls must be keyboard usable, labeled, responsive, and readable at large font sizes.

## Current scope

PDF import is active and is the primary development focus.

Currently supported / under active verification:

- Hameln vertical bunko PDF with some special tags
- Shosetsuka ni Narou PDF format represented by the `N0921ED.pdf` sample
- drag-and-drop and file-picker import
- browser-only PDF.js extraction
- IndexedDB persistence of normalized novel data
- toast feedback for imports

Do not expand to URL scraping, EPUB, TXT, HTML, or additional PDF layouts until the currently supported PDF formats are stable unless the user explicitly reprioritizes the project.

## Technology

- React
- TypeScript with strict type checking
- Vite
- Mozilla PDF.js (`pdfjs-dist`)
- IndexedDB / localStorage
- GitHub Actions / GitHub Pages

Avoid adding dependencies when browser APIs or small local utilities are sufficient.

## Architecture

Dependency direction:

```text
UI components
    ↓
application state / use-cases
    ↓
domain models (Novel / Chapter)
    ↑
storage adapters       importer adapters
                        ├─ Hameln PDF
                        └─ Narou PDF
```

Importer-specific output must be normalized to domain models before the reader renders it. Site-specific coordinate rules, heading detection, ruby recovery, and PDF cleanup belong under `src/pdf/` and must not leak into Reader components.

## PDF parsing rules

- Prefer PDF text coordinates over raw extraction order for vertical PDFs.
- Detect headings from reproducible layout rules when possible; do not assume every episode title uses `第○話`.
- Preserve reading order first. Paragraph recovery and decorative formatting are secondary to correct text order.
- Keep preface / body / afterword association explicit when a source format exposes it.
- Page numbers, running heads, colophons, and source-format placeholder tags should not become novel body text.
- Ruby recovery is currently allowed to normalize into `本文（ルビ）`; future structured `<ruby>` support should be implemented at the domain/rendering boundary rather than with HTML strings in parser output.
- Large PDFs must be processed in bounded batches; avoid unbounded `Promise.all` over every page.

## Storage

- Reader settings and small progress values may use `localStorage`.
- Imported normalized `Novel` / `Chapter` data is stored in IndexedDB.
- Do not persist or upload the original PDF unless a future requirement explicitly calls for it.
- Storage access stays behind helper/repository modules.
- New persistence formats should include a version or migration strategy when the schema changes.

## Development rules

- Keep `npm run build` passing before considering a change complete.
- Prefer explicit TypeScript types at module boundaries.
- Do not use `any` unless interfacing with an unavoidable untyped API, and isolate it when necessary.
- Keep user-visible Japanese copy natural and concise.
- Do not silently upload document contents, analytics payloads containing text, or reading history.
- When a real user PDF is used to derive a parser rule, document the reusable layout rule rather than the novel's actual content.

## GitHub Pages

The app must work from a repository subpath. Vite uses a relative base so repository renames do not require changing asset paths.

## Documentation

Update `PLAN.md` when architecture or milestones change, and update `TASKS.md` as work is completed or reprioritized.
