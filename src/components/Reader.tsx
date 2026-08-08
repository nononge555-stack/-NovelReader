import { useState, type CSSProperties } from 'react';
import type { Novel, ReaderSettings } from '../models/Novel';
import { SettingsPanel } from './SettingsPanel';

interface ReaderProps {
  novel: Novel;
  chapterIndex: number;
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
  onChapterChange: (chapterIndex: number) => void;
  onBack: () => void;
}

export function Reader({
  novel,
  chapterIndex,
  settings,
  onSettingsChange,
  onChapterChange,
  onBack,
}: ReaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chapter = novel.chapters[chapterIndex];
  const isFirst = chapterIndex === 0;
  const isLast = chapterIndex === novel.chapters.length - 1;

  const readerStyle = {
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': String(settings.lineHeight),
    '--reader-width': `${settings.contentWidth}px`,
  } as CSSProperties;

  return (
    <div className={`reader-page theme-${settings.theme}`} style={readerStyle}>
      <header className="reader-toolbar">
        <button className="toolbar-button" type="button" onClick={onBack}>
          ← ライブラリ
        </button>
        <div className="reader-title-block">
          <span>{novel.title}</span>
          <strong>{chapter.title}</strong>
        </div>
        <button className="toolbar-button" type="button" onClick={() => setSettingsOpen(true)}>
          Aa 設定
        </button>
      </header>

      <main className="reader-main">
        <article className="reader-article">
          <header className="chapter-header">
            <p className="chapter-count">
              {chapterIndex + 1} / {novel.chapters.length}
            </p>
            <h1>{chapter.title}</h1>
          </header>

          <div className="chapter-body">
            {chapter.paragraphs.map((paragraph, index) => (
              <p key={`${chapter.id}-${index}`}>{paragraph}</p>
            ))}
          </div>

          <nav className="chapter-navigation" aria-label="章ナビゲーション">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onChapterChange(chapterIndex - 1)}
            >
              <span aria-hidden="true">←</span> 前の話
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onChapterChange(chapterIndex + 1)}
            >
              次の話 <span aria-hidden="true">→</span>
            </button>
          </nav>
        </article>
      </main>

      {settingsOpen ? (
        <>
          <button className="settings-backdrop" type="button" aria-label="設定を閉じる" onClick={() => setSettingsOpen(false)} />
          <SettingsPanel settings={settings} onChange={onSettingsChange} onClose={() => setSettingsOpen(false)} />
        </>
      ) : null}
    </div>
  );
}
