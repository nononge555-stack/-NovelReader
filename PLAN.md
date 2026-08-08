# Development Plan

## Product vision

Build a privacy-first open-source novel reader that runs entirely in the browser and can later import locally saved documents such as PDF files without uploading their contents to a server.

## Milestone 0 — Repository and deployable reader shell

Goal: establish an OSS foundation that can be deployed to GitHub Pages.

- React + TypeScript + Vite project
- MIT license and contribution docs
- GitHub Pages workflow
- responsive library screen
- sample novel reader
- basic reading settings
- chapter-level progress persistence

## Milestone 1 — Reader experience

Goal: make the app pleasant to use before implementing document import.

- chapter table of contents
- horizontal / vertical writing mode
- improved typography controls
- keyboard and touch navigation
- reading position within a chapter
- bookmarks
- focus and accessibility review

## Milestone 2 — Local library persistence

Goal: support real user libraries without a server.

- IndexedDB schema
- novel repository abstraction
- settings/progress migrations
- delete / rename / metadata editing
- storage usage display and recovery handling

## Milestone 3 — PDF importer

Goal: convert user-selected PDFs into the normalized `Novel` model locally in the browser.

- PDF.js adapter
- text extraction
- title / author metadata extraction where possible
- chapter-title detection
- paragraph reconstruction
- import preview and correction UI
- image/illustration strategy
- ruby/furigana investigation
- explicit handling for unsupported/scanned PDFs

PDF import must not upload files or extracted text to an external server.

## Milestone 4 — Offline and additional formats

- PWA installability
- offline app shell
- EPUB importer
- TXT importer
- HTML importer
- export / backup of local library metadata

## Non-goals for the initial releases

- hosting copyrighted novel files
- a cloud account system
- server-side document conversion
- DRM removal
- scraping or automatically downloading works from third-party novel sites
