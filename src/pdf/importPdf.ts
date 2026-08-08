import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Chapter, Novel } from '../models/Novel';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const chapterHeadingPattern = /^(?:第[0-9０-９一二三四五六七八九十百千万]+(?:話|章|節|幕)(?:\s+.+)?|序章|終章|プロローグ|エピローグ|幕間|閑話|あとがき)(?:\s*[-―—:：].+)?$/;
const pageNumberPattern = /^(?:[-―—]\s*)?(?:\d+|[０-９]+)(?:\s*[-―—])?$/;

function makeNovelId(file: File): string {
  return `pdf:${file.name}:${file.size}:${file.lastModified}`;
}

function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim() || '読み込んだPDF';
}

function normalizeLines(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/\u0000/g, '').replace(/[ \t]+$/g, ''))
    .filter((line) => !pageNumberPattern.test(line.trim()));
}

function linesToParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current = '';

  const flush = () => {
    const value = current.trim();
    if (value) paragraphs.push(value);
    current = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }

    const startsNewParagraph = /^[　\t]/.test(line);
    if (startsNewParagraph && current.trim()) flush();

    current += line.trimStart();
  }

  flush();
  return paragraphs;
}

function splitIntoChapters(lines: string[]): Chapter[] {
  const chapters: Chapter[] = [];
  let currentTitle = '本文';
  let currentLines: string[] = [];

  const flush = () => {
    const paragraphs = linesToParagraphs(currentLines);
    if (paragraphs.length === 0) return;

    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: currentTitle,
      paragraphs,
    });
    currentLines = [];
  };

  for (const line of lines) {
    const candidate = line.trim();
    if (candidate && candidate.length <= 80 && chapterHeadingPattern.test(candidate)) {
      flush();
      currentTitle = candidate;
      continue;
    }

    currentLines.push(line);
  }

  flush();

  if (chapters.length > 0) return chapters;

  const paragraphs = linesToParagraphs(lines);
  return [
    {
      id: 'chapter-1',
      title: '本文',
      paragraphs: paragraphs.length > 0 ? paragraphs : ['本文を抽出できませんでした。'],
    },
  ];
}

export async function importPdfAsNovel(file: File): Promise<Novel> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('PDFファイルを選択してください。');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const extractedLines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let currentLine = '';

    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      currentLine += item.str;
      if (item.hasEOL) {
        extractedLines.push(currentLine);
        currentLine = '';
      }
    }

    if (currentLine) extractedLines.push(currentLine);
    extractedLines.push('');
  }

  const lines = normalizeLines(extractedLines);
  const chapters = splitIntoChapters(lines);

  return {
    id: makeNovelId(file),
    title: fileNameWithoutExtension(file.name),
    author: 'PDFから読み込み',
    description: `PDFからブラウザ内で読み込んだ作品です。現在はハーメルンPDF向けの解析を調整中です（${pdf.numPages}ページ）。`,
    chapters,
  };
}
