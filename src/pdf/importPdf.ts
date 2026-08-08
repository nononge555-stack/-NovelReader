import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Novel } from '../models/Novel';
import { parseHamelnVerticalPdf } from './hamelnVerticalPdf';
import { looksLikeNarouPdf, parseNarouPdf } from './narouPdf';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function makeNovelId(file: File): string {
  return `pdf:${file.name}:${file.size}:${file.lastModified}`;
}

export async function importPdfAsNovel(file: File): Promise<Novel> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('PDFファイルを選択してください。');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pageCount = pdf.numPages;

  try {
    if (await looksLikeNarouPdf(pdf, file.name)) {
      const parsed = await parseNarouPdf(pdf, file.name);
      const ncodeText = parsed.ncode ? ` / ${parsed.ncode}` : '';

      return {
        id: makeNovelId(file),
        title: parsed.title,
        author: parsed.author,
        description: `小説家になろうのPDFからブラウザ内で読み込んだ作品です（${pageCount}ページ${ncodeText}）。`,
        chapters: parsed.chapters,
      };
    }

    const parsed = await parseHamelnVerticalPdf(pdf, file.name);
    return {
      id: makeNovelId(file),
      title: parsed.title,
      author: parsed.author,
      description: `ハーメルンの縦書きPDF（文庫・特殊タグ一部あり）からブラウザ内で読み込んだ作品です（${pageCount}ページ）。`,
      chapters: parsed.chapters,
    };
  } finally {
    await pdf.destroy();
  }
}
