import type { Chapter } from '../models/Novel';

interface TextItemLike {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
}

interface TextContentLike {
  items: unknown[];
}

interface PdfViewportLike {
  width: number;
  height: number;
  transform: number[];
}

interface PdfPageLike {
  getViewport(options: { scale: number }): PdfViewportLike;
  getTextContent(): Promise<TextContentLike>;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

interface PositionedTextItem {
  text: string;
  dir: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  height: number;
  isRuby?: boolean;
}

interface TextColumn {
  x: number;
  items: PositionedTextItem[];
  yMin: number;
  yMax: number;
}

interface PageExtraction {
  heading: string | null;
  bodyText: string;
  isColophon: boolean;
}

export interface HamelnVerticalPdfResult {
  title: string;
  author: string;
  chapters: Chapter[];
}

const chapterHeadingPattern = /^第[0-9０-９一二三四五六七八九十百千]+話$/;

const verticalCharacterMap: Record<string, string> = {
  '﹁': '「',
  '﹂': '」',
  '﹃': '『',
  '﹄': '』',
  '︑': '、',
  '︒': '。',
  '︙': '…',
  '︰': '…',
  '︱': '―',
  '︵': '（',
  '︶': '）',
  '︷': '｛',
  '︸': '｝',
  '︹': '〔',
  '︺': '〕',
};

function isTextItem(value: unknown): value is TextItemLike {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<TextItemLike>;
  return (
    typeof item.str === 'string' &&
    typeof item.dir === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.width === 'number' &&
    typeof item.height === 'number'
  );
}

function multiplyTransforms(first: number[], second: number[]): number[] {
  return [
    first[0] * second[0] + first[2] * second[1],
    first[1] * second[0] + first[3] * second[1],
    first[0] * second[2] + first[2] * second[3],
    first[1] * second[2] + first[3] * second[3],
    first[0] * second[4] + first[2] * second[5] + first[4],
    first[1] * second[4] + first[3] * second[5] + first[5],
  ];
}

function normalizeVerticalCharacters(text: string): string {
  let normalized = '';
  for (const character of text.replace(/\u0000/g, '')) {
    normalized += verticalCharacterMap[character] ?? character;
  }
  return normalized;
}

function median(values: number[]): number {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function positionTextItem(item: TextItemLike, viewport: PdfViewportLike): PositionedTextItem {
  const transformed = multiplyTransforms(viewport.transform, item.transform);
  const horizontalScale = Math.hypot(transformed[0], transformed[1]);
  const verticalScale = Math.hypot(transformed[2], transformed[3]);
  const fontSize = Math.max(1, Math.min(Math.max(horizontalScale, verticalScale), 80));

  // Horizontal Latin/numeric runs embedded in vertical text use their left edge as x.
  // Moving to their visual center makes them attach to the surrounding vertical column reliably.
  const x = item.dir === 'ttb' ? transformed[4] : transformed[4] + Math.abs(item.width) / 2;

  return {
    text: normalizeVerticalCharacters(item.str),
    dir: item.dir,
    x,
    y: transformed[5],
    fontSize,
    width: Math.abs(item.width),
    height: Math.abs(item.height),
  };
}

function clusterColumns(items: PositionedTextItem[], tolerance: number): TextColumn[] {
  const columns: TextColumn[] = [];

  for (const item of [...items].sort((a, b) => b.x - a.x)) {
    let column = columns.find((candidate) => Math.abs(candidate.x - item.x) <= tolerance);

    if (!column) {
      column = {
        x: item.x,
        items: [],
        yMin: item.y,
        yMax: item.y,
      };
      columns.push(column);
    }

    column.items.push(item);
    column.x = column.items.reduce((sum, value) => sum + value.x, 0) / column.items.length;
    column.yMin = Math.min(column.yMin, item.y);
    column.yMax = Math.max(column.yMax, item.y);
  }

  return columns.sort((a, b) => b.x - a.x);
}

function nearestColumn(
  item: PositionedTextItem,
  columns: TextColumn[],
  maxDistance: number,
): TextColumn | null {
  const candidates = columns
    .map((column) => ({ column, distance: Math.abs(column.x - item.x) }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  return candidates[0]?.column ?? null;
}

function splitRubyGroups(items: PositionedTextItem[], xTolerance: number, yGap: number): PositionedTextItem[][] {
  const xGroups: PositionedTextItem[][] = [];

  for (const item of [...items].sort((a, b) => b.x - a.x || a.y - b.y)) {
    let group = xGroups.find((candidate) => Math.abs(candidate[0].x - item.x) <= xTolerance);
    if (!group) {
      group = [];
      xGroups.push(group);
    }
    group.push(item);
  }

  const rubyGroups: PositionedTextItem[][] = [];
  for (const xGroup of xGroups) {
    const sorted = [...xGroup].sort((a, b) => a.y - b.y);
    let current: PositionedTextItem[] = [];

    for (const item of sorted) {
      const previous = current[current.length - 1];
      if (previous && item.y - previous.y > yGap) {
        rubyGroups.push(current);
        current = [];
      }
      current.push(item);
    }

    if (current.length > 0) rubyGroups.push(current);
  }

  return rubyGroups;
}

function attachRuby(columns: TextColumn[], rubyItems: PositionedTextItem[], bodyFontSize: number): void {
  const groups = splitRubyGroups(rubyItems, bodyFontSize * 0.45, bodyFontSize * 1.7);

  for (const group of groups) {
    const rubyText = group.map((item) => item.text).join('').trim();
    if (!rubyText) continue;

    const rubyX = group.reduce((sum, item) => sum + item.x, 0) / group.length;
    const rubyYMin = Math.min(...group.map((item) => item.y));
    const rubyYMax = Math.max(...group.map((item) => item.y));
    const rubyCenterY = (rubyYMin + rubyYMax) / 2;

    // In this Hameln vertical-bunko format ruby is printed immediately to the right
    // of the base text. The y-range check avoids attaching unrelated small text.
    const base = columns
      .filter(
        (column) =>
          column.x < rubyX + bodyFontSize * 0.35 &&
          rubyX - column.x <= bodyFontSize * 1.75 &&
          rubyCenterY >= column.yMin - bodyFontSize &&
          rubyCenterY <= column.yMax + bodyFontSize,
      )
      .sort((a, b) => Math.abs(a.x - rubyX) - Math.abs(b.x - rubyX))[0];

    if (!base) continue;

    base.items.push({
      text: `（${rubyText}）`,
      dir: 'ttb',
      x: base.x,
      y: rubyYMax + bodyFontSize * 0.25,
      fontSize: bodyFontSize,
      width: 0,
      height: 0,
      isRuby: true,
    });
  }
}

function columnText(column: TextColumn): string {
  return [...column.items]
    .sort((a, b) => {
      const yDifference = a.y - b.y;
      if (Math.abs(yDifference) > 1) return yDifference;
      return a.x - b.x;
    })
    .map((item) => item.text)
    .join('');
}

function compactHeading(text: string): string {
  return text.replace(/[\s　]+/g, '');
}

function extractPage(textItems: TextItemLike[], viewport: PdfViewportLike): PageExtraction {
  const rawText = normalizeVerticalCharacters(textItems.map((item) => item.str).join(''));
  const isColophon =
    rawText.includes('本書の内容を無許可で転載') ||
    (rawText.includes('ハーメルン') && rawText.includes('発行日') && rawText.includes('著者'));

  if (isColophon) {
    return { heading: null, bodyText: '', isColophon: true };
  }

  const positioned = textItems.map((item) => positionTextItem(item, viewport));
  const interior = positioned.filter(
    (item) => item.y >= viewport.height * 0.07 && item.y <= viewport.height * 0.93,
  );

  const verticalNonSpace = interior.filter((item) => item.dir === 'ttb' && item.text.trim().length > 0);
  if (verticalNonSpace.length === 0) {
    return { heading: null, bodyText: '', isColophon: false };
  }

  const bodyFontSize = median(
    verticalNonSpace
      .map((item) => item.fontSize)
      .filter((size) => Number.isFinite(size) && size >= 4 && size <= 30),
  );
  const rubyThreshold = bodyFontSize * 0.72;
  const columnTolerance = bodyFontSize * 0.62;

  const mainAnchors = verticalNonSpace.filter((item) => item.fontSize >= rubyThreshold);
  const columns = clusterColumns(mainAnchors, columnTolerance);

  const mainAnchorSet = new Set(mainAnchors);
  const rubyItems: PositionedTextItem[] = [];

  for (const item of interior) {
    if (mainAnchorSet.has(item)) continue;

    if (item.dir === 'ttb' && item.text.trim() && item.fontSize < rubyThreshold) {
      rubyItems.push(item);
      continue;
    }

    const target = nearestColumn(item, columns, bodyFontSize * 1.9);
    if (!target) continue;

    target.items.push(item);
    target.yMin = Math.min(target.yMin, item.y);
    target.yMax = Math.max(target.yMax, item.y);
  }

  attachRuby(columns, rubyItems, bodyFontSize);

  let heading: string | null = null;
  const bodyColumns: TextColumn[] = [];

  for (const column of columns.sort((a, b) => b.x - a.x)) {
    const text = columnText(column);
    const compact = compactHeading(text);

    if (!heading && chapterHeadingPattern.test(compact)) {
      heading = compact;
      continue;
    }

    if (text.trim()) bodyColumns.push(column);
  }

  const bodyText = bodyColumns.map((column) => columnText(column)).join('');
  return { heading, bodyText, isColophon: false };
}

function normalizeParagraphText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function textToParagraphs(text: string): string[] {
  if (!text.trim()) return [];

  let normalized = normalizeParagraphText(text);
  normalized = normalized.replace(/　+/g, '\n');

  // Dialogue paragraphs in this PDF omit the normal one-character indent.
  // A quotation immediately after terminal punctuation is therefore treated as a new paragraph.
  normalized = normalized.replace(/([。！？!?」』])(?=「)/g, '$1\n');

  return normalized
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function parseFileMetadata(fileName: string): { title: string; author: string } {
  const normalizedName = fileName.replace(/\.pdf$/i, '').trim();
  const hamelnMatch = normalizedName.match(/^\[([^\]]+)](.+?)\s*-\s*ハーメルン(?:\[\d+])?$/i);

  if (hamelnMatch) {
    return {
      author: hamelnMatch[1].trim(),
      title: hamelnMatch[2].trim(),
    };
  }

  const bracketMatch = normalizedName.match(/^\[([^\]]+)](.+)$/);
  if (bracketMatch) {
    return {
      author: bracketMatch[1].trim(),
      title: bracketMatch[2].trim(),
    };
  }

  return {
    title: normalizedName || '読み込んだPDF',
    author: '作者不明',
  };
}

export async function parseHamelnVerticalPdf(
  pdf: PdfDocumentLike,
  fileName: string,
): Promise<HamelnVerticalPdfResult> {
  const metadata = parseFileMetadata(fileName);
  const chapters: Chapter[] = [];
  let currentTitle: string | null = null;
  let currentText = '';
  let started = false;

  const flushChapter = () => {
    if (!currentTitle) return;
    const paragraphs = textToParagraphs(currentText);
    if (paragraphs.length === 0) return;

    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: currentTitle,
      paragraphs,
    });
    currentText = '';
  };

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(isTextItem);
    const extraction = extractPage(items, viewport);

    if (extraction.isColophon && started) break;

    if (extraction.heading) {
      if (started) flushChapter();
      started = true;
      currentTitle = extraction.heading;
    }

    if (!started) continue;
    currentText += extraction.bodyText;
  }

  flushChapter();

  if (chapters.length === 0) {
    throw new Error(
      '対応しているハーメルンの縦書きPDF（文庫・特殊タグ一部あり）として話見出しを検出できませんでした。',
    );
  }

  return {
    ...metadata,
    chapters,
  };
}
