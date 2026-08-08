import type { Novel } from '../models/Novel';

interface LibraryProps {
  novels: Novel[];
  onOpenNovel: (novel: Novel) => void;
}

export function Library({ novels, onOpenNovel }: LibraryProps) {
  return (
    <main className="library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">OPEN SOURCE NOVEL READER</p>
          <h1>NovelReader</h1>
          <p className="lead">
            読みたい文章を、落ち着いて読める形へ。ファイルは将来的にもブラウザ内で処理します。
          </p>
        </div>
        <button className="primary-button" type="button" disabled title="PDF取り込みは後のマイルストーンで実装します">
          ＋ PDFを追加
        </button>
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
        <span>PDFインポートは次の開発段階で追加予定です。</span>
        <a href="https://github.com/nononge555-stack/-NovelReader" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  );
}
