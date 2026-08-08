import { useRef } from 'react';
import type { Novel } from '../models/Novel';

interface LibraryProps {
  novels: Novel[];
  isImportingPdf: boolean;
  pdfImportMessage: string | null;
  onImportPdf: (file: File) => Promise<void>;
  onOpenNovel: (novel: Novel) => void;
}

export function Library({
  novels,
  isImportingPdf,
  pdfImportMessage,
  onImportPdf,
  onOpenNovel,
}: LibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectPdf = () => {
    fileInputRef.current?.click();
  };

  return (
    <main className="library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">OPEN SOURCE NOVEL READER</p>
          <h1>NovelReader</h1>
          <p className="lead">
            まずはハーメルンから保存したPDFを、ブラウザ内で読み込んで快適に読めることを目指しています。
          </p>
          {pdfImportMessage && (
            <p className="lead" role="status" aria-live="polite">
              {pdfImportMessage}
            </p>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={isImportingPdf}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void onImportPdf(file);
            }}
          />
          <button className="primary-button" type="button" disabled={isImportingPdf} onClick={selectPdf}>
            {isImportingPdf ? 'PDFを解析中…' : '＋ PDFを追加'}
          </button>
        </div>
      </header>

      <section aria-labelledby="library-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIBRARY</p>
            <h2 id="library-heading">ライブラリ</h2>
          </div>
          <span className="muted">{novels.length} 作品</span>
        </div>

        <div className="book-grid">
          {novels.map((novel) => (
            <article className="book-card" key={novel.id}>
              <div className="book-cover" aria-hidden="true">
                <span>NR</span>
              </div>
              <div className="book-card-body">
                <p className="book-meta">{novel.chapters.length} 話</p>
                <h3>{novel.title}</h3>
                <p className="author">{novel.author}</p>
                <p className="description">{novel.description}</p>
                <button className="text-button" type="button" onClick={() => onOpenNovel(novel)}>
                  読む <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="library-footer">
        <span>PDFは端末内のブラウザで解析します。現在はハーメルンPDF対応を調整中です。</span>
        <a href="https://github.com/nononge555-stack/-NovelReader" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  );
}
