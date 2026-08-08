# NovelReader

NovelReader is an open-source, browser-based reader for enjoying locally imported novels in a comfortable reading UI.

> **Current status:** the first milestone focuses on the reader experience and GitHub Pages deployment. PDF import is intentionally deferred to a later milestone.

## Goals

- Run entirely as a static web app on GitHub Pages.
- Keep imported documents and extracted novel text on the user's device.
- Provide a clean, responsive reading experience on desktop and mobile.
- Stay format-agnostic so PDF, EPUB, TXT, HTML, and other importers can be added later.
- Never bundle or distribute copyrighted novels with this repository.

## Current prototype

The initial prototype includes:

- A small library screen with a built-in sample novel.
- Chapter navigation.
- Reading progress saved in `localStorage`.
- Reader settings for theme, font size, line height, and text width.
- Responsive styling for desktop and mobile.
- GitHub Pages deployment through GitHub Actions.

PDF parsing, IndexedDB persistence, vertical writing, bookmarks, and PWA support are planned but are **not implemented yet**.

## Tech stack

- React
- TypeScript
- Vite
- GitHub Pages / GitHub Actions

## Local development

Requirements: Node.js 22 or newer is recommended.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## GitHub Pages

The repository contains `.github/workflows/deploy-pages.yml`.

In GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Pushes to `main` will then build and deploy the `dist` directory.

## Privacy and content policy

NovelReader itself does not provide or distribute novels. Future import features are intended to process user-selected documents locally in the browser. Users are responsible for ensuring they have the right to use documents they import.

## Roadmap

See [PLAN.md](./PLAN.md) for milestones and [TASKS.md](./TASKS.md) for the working task list.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT License. See [LICENSE](./LICENSE).
