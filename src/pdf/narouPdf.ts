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
  cleanup?(): boolean;
}

export interface NarouPdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

export type NarouPdfProgressCallback = (processedPages: number, totalPages: number) => void;

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

interface ParagraphSegment {
  text: string;
  startsParagraph: boolean;
}

type HeadingKind = 'preface' | 'body' | 'afterword';

interface PageHeading {
  title: string;
  kind: HeadingKind;
}

interface PageExtraction {
  heading: PageHeading | null;
  segments: ParagraphSegment[];
}

interface HeadingDetection {
  heading: PageHeading | null;
  headingColumn: TextColumn | null;
  skipContent: boolean;
}

export interface NarouPdfResult {
  title: string;
  author: string;
  ncode: string | null;
  chapters: Chapter[];
}

const PREFACE_SUFFIX = '（前書き）';
const AFTERWORD_SUFFIX = '（後書き）';
const NOTICE_HEADING = '注意事項';
const EXTRACTION_CONCURRENCY = 4;

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

function compactText(text: string): string {
  return normalizeVerticalCharacters(text).replace(/[\s　]+/g, '');
}

function median(values: number[]): number {
  if (values.length === 0) return 14;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function positionTextItem(item: TextItemLike, viewport: PdfViewportLike): PositionedTextItem {
  const transformed = multiplyTransforms(viewport.transform, item.transform);
  const horizontalScale = Math.hypot(transformed[0], transformed[1]);
  const verticalScale = Math.hypot(transformed[2], transformed[3]);
  const fontSize = Math.max(1, Math.min(Math.max(horizontalScale, verticalScale), 80));
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
  return (
    columns
      .map((column) => ({ column, distance: Math.abs(column.x - item.x) }))
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)[0]?.column ?? null
  );
}

function splitRubyGroups(
  items: PositionedTextItem[],
  xTolerance: number,
  yGap: number,
): PositionedTextItem[][] {
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
    .join('')
    .replace(/[\r\n]/g, '');
}

function isImagePlaceholder(text: string): boolean {
  return /^[＜<][ｉi][0-9０-９]+[｜|][0-9０-９]+[＞>]$/.test(compactText(text));
}

function parseHeading(text: string): PageHeading | null {
  const compact = compactText(text);
  if (!compact || compact === NOTICE_HEADING || isImagePlaceholder(compact)) return null;

  if (compact.endsWith(PREFACE_SUFFIX)) {
    return {
      title: compact.slice(0, -PREFACE_SUFFIX.length),
      kind: 'preface',
    };
  }

  if (compact.endsWith(AFTERWORD_SUFFIX)) {
    return {
      title: compact.slice(0, -AFTERWORD_SUFFIX.length),
      kind: 'afterword',
    };
  }

  return { title: compact, kind: 'body' };
}

function bodyFontSizeFor(items: PositionedTextItem[]): number {
  const sizes = items
    .filter((item) => item.dir === 'ttb' && item.text.trim())
    .map((item) => item.fontSize)
    .filter((size) => Number.isFinite(size) && size >= 10 && size <= 24);
  return median(sizes);
}

function buildColumns(
  positioned: PositionedTextItem[],
  viewport: PdfViewportLike,
): { columns: TextColumn[]; bodyFontSize: number } {
  const interior = positioned.filter(
    (item) => item.y >= viewport.height * 0.08 && item.y <= viewport.height * 0.93,
  );
  const bodyFontSize = bodyFontSizeFor(interior);
  const rubyThreshold = bodyFontSize * 0.72;
  const columnTolerance = bodyFontSize * 0.42;

  const mainAnchors = interior.filter(
    (item) => item.dir === 'ttb' && item.text.trim() && item.fontSize >= rubyThreshold,
  );
  const columns = clusterColumns(mainAnchors, columnTolerance);
  const mainAnchorSet = new Set(mainAnchors);
  const rubyItems: PositionedTextItem[] = [];

  for (const item of interior) {
    if (mainAnchorSet.has(item)) continue;

    if (item.dir === 'ttb' && item.text.trim() && item.fontSize < rubyThreshold) {
      rubyItems.push(item);
      continue;
    }

    if (item.dir !== 'ttb') {
      const compact = item.text.trim();
      if (!compact) continue;
      if (item.y >= viewport.height * 0.86 && /^[0-9０-９]+$/.test(compact)) continue;
    }

    const target = nearestColumn(item, columns, bodyFontSize * 1.9);
    if (!target) continue;
    target.items.push(item);
    target.yMin = Math.min(target.yMin, item.y);
    target.yMax = Math.max(target.yMax, item.y);
  }

  attachRuby(columns, rubyItems, bodyFontSize);
  return { columns, bodyFontSize };
}

async function detectHeadingColumnX(pdf: NarouPdfDocumentLike): Promise<number | null> {
  const lastPage = Math.min(pdf.numPages, 8);

  for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const positioned = textContent.items
        .filter(isTextItem)
        .map((item) => positionTextItem(item, viewport));
      const { columns } = buildColumns(positioned, viewport);
      const noticeColumn = columns.find(
        (column) => compactText(columnText(column)) === NOTICE_HEADING,
      );
      if (noticeColumn) return noticeColumn.x;
    } finally {
      page.cleanup?.();
    }
  }

  return null;
}

function detectPageHeading(
  columns: TextColumn[],
  bodyFontSize: number,
  viewport: PdfViewportLike,
  headingColumnX: number,
): HeadingDetection {
  const visibleColumns = columns.filter((column) => {
    const text = columnText(column);
    return text.trim() && !isImagePlaceholder(text);
  });

  const rightmost = visibleColumns[0];
  if (!rightmost) {
    return { heading: null, headingColumn: null, skipContent: false };
  }

  const second = visibleColumns[1];
  const xMatches = Math.abs(rightmost.x - headingColumnX) <= bodyFontSize * 0.28;
  const yMatches =
    rightmost.yMin >= viewport.height * 0.14 && rightmost.yMin <= viewport.height * 0.25;
  const hasHeadingGap = !second || rightmost.x - second.x >= bodyFontSize * 5.4;
  const text = compactText(columnText(rightmost));

  if (!xMatches || !yMatches || !hasHeadingGap || text.length > 90) {
    return { heading: null, headingColumn: null, skipContent: false };
  }

  if (text === NOTICE_HEADING) {
    return { heading: null, headingColumn: rightmost, skipContent: true };
  }

  return {
    heading: parseHeading(text),
    headingColumn: rightmost,
    skipContent: false,
  };
}

async function extractPage(
  pdf: NarouPdfDocumentLike,
  pageNumber: number,
  headingColumnX: number | null,
): Promise<PageExtraction> {
  const page = await pdf.getPage(pageNumber);

  try {
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const positioned = textContent.items
      .filter(isTextItem)
      .map((item) => positionTextItem(item, viewport));
    const { columns, bodyFontSize } = buildColumns(positioned, viewport);
    const effectiveHeadingX = headingColumnX ?? viewport.width * 0.874;
    const { heading, headingColumn, skipContent } = detectPageHeading(
      columns,
      bodyFontSize,
      viewport,
      effectiveHeadingX,
    );

    if (skipContent) {
      return { heading: null, segments: [] };
    }

    const bodyColumns = columns
      .filter((column) => column !== headingColumn)
      .filter((column) => !isImagePlaceholder(columnText(column)))
      .sort((a, b) => b.x - a.x);

    const segments: ParagraphSegment[] = [];
    let previousX: number | null = null;
    const expectedTop = viewport.height * 0.16;

    for (const column of bodyColumns) {
      const text = columnText(column).trim();
      if (!text) continue;

      const startsByIndent = column.yMin > expectedTop + bodyFontSize * 0.65;
      const startsAfterGap =
        previousX !== null && previousX - column.x > bodyFontSize * 2.2;

      segments.push({
        text,
        startsParagraph: startsByIndent || startsAfterGap,
      });
      previousX = column.x;
    }

    return { heading, segments };
  } finally {
    page.cleanup?.();
  }
}

function appendSegments(
  paragraphs: string[],
  segments: ParagraphSegment[],
  forceFirstParagraph: boolean,
): void {
  let first = true;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    const startsParagraph =
      paragraphs.length === 0 || segment.startsParagraph || (first && forceFirstParagraph);
    if (startsParagraph) {
      paragraphs.push(text);
    } else {
      paragraphs[paragraphs.length - 1] += text;
    }
    first = false;
  }
}

async function extractCoverMetadata(
  pdf: NarouPdfDocumentLike,
  fileName: string,
): Promise<{ title: string; author: string; ncode: string | null }> {
  const page = await pdf.getPage(1);

  try {
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const horizontal = textContent.items
      .filter(isTextItem)
      .map((item) => positionTextItem(item, viewport))
      .filter((item) => item.dir !== 'ttb' && item.text.trim());

    const lineTolerance = 4;
    const lines: Array<{ y: number; fontSize: number; items: PositionedTextItem[] }> = [];

    for (const item of [...horizontal].sort((a, b) => a.y - b.y || a.x - b.x)) {
      let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= lineTolerance);
      if (!line) {
        line = { y: item.y, fontSize: item.fontSize, items: [] };
        lines.push(line);
      }
      line.items.push(item);
      line.fontSize = Math.max(line.fontSize, item.fontSize);
      line.y = line.items.reduce((sum, value) => sum + value.y, 0) / line.items.length;
    }

    const normalizedLines = lines
      .map((line) => ({
        y: line.y,
        fontSize: line.fontSize,
        text: line.items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join('')
          .trim(),
      }))
      .filter(
        (line) =>
          line.text &&
          !/^HinaProject Inc\.?$/i.test(line.text) &&
          !/^[0-9０-９]+$/.test(line.text),
      );

    const titleLine = [...normalizedLines].sort((a, b) => b.fontSize - a.fontSize)[0];
    const authorLine = titleLine
      ? normalizedLines
          .filter((line) => line !== titleLine && line.y > titleLine.y)
          .sort((a, b) => a.y - b.y)[0]
      : undefined;

    const fileBase = fileName.replace(/\.pdf$/i, '').trim();
    const ncode = /^N[0-9A-Z]+$/i.test(fileBase) ? fileBase.toUpperCase() : null;

    return {
      title: titleLine?.text || fileBase || '読み込んだPDF',
      author: authorLine?.text || '作者不明',
      ncode,
    };
  } finally {
    page.cleanup?.();
  }
}

async function coverContainsNarouMark(pdf: NarouPdfDocumentLike): Promise<boolean> {
  const page = await pdf.getPage(1);

  try {
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter(isTextItem)
      .map((item) => item.str)
      .join(' ');
    return /HinaProject/i.test(text);
  } finally {
    page.cleanup?.();
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

export async function looksLikeNarouPdf(
  pdf: NarouPdfDocumentLike,
  fileName: string,
): Promise<boolean> {
  const fileBase = fileName.replace(/\.pdf$/i, '').trim();
  if (/^N[0-9A-Z]+$/i.test(fileBase)) return true;
  return coverContainsNarouMark(pdf);
}

export async function parseNarouPdf(
  pdf: NarouPdfDocumentLike,
  fileName: string,
  onProgress?: NarouPdfProgressCallback,
): Promise<NarouPdfResult> {
  const metadata = await extractCoverMetadata(pdf, fileName);
  const headingColumnX = await detectHeadingColumnX(pdf);
  const chapters: Chapter[] = [];

  let currentTitle: string | null = null;
  let currentParagraphs: string[] = [];
  let pendingPrefaceTitle: string | null = null;
  let pendingPrefaceParagraphs: string[] = [];
  let leadingParagraphs: string[] = [];
  let activeSection: 'none' | HeadingKind = 'none';

  const flushChapter = () => {
    if (!currentTitle) return;
    const paragraphs = currentParagraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
    if (paragraphs.length > 0) {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: currentTitle,
        paragraphs,
      });
    }
    currentTitle = null;
    currentParagraphs = [];
    activeSection = 'none';
  };

  const consumeExtraction = (extraction: PageExtraction) => {
    const heading = extraction.heading;

    if (heading?.kind === 'preface') {
      flushChapter();
      pendingPrefaceTitle = heading.title;
      pendingPrefaceParagraphs = [];
      if (chapters.length === 0 && leadingParagraphs.length > 0) {
        pendingPrefaceParagraphs.push(...leadingParagraphs);
        leadingParagraphs = [];
      }
      pendingPrefaceParagraphs.push('【前書き】');
      activeSection = 'preface';
      appendSegments(pendingPrefaceParagraphs, extraction.segments, true);
      return;
    }

    if (heading?.kind === 'body') {
      if (currentTitle) flushChapter();
      currentTitle = heading.title;
      currentParagraphs = [];

      if (chapters.length === 0 && leadingParagraphs.length > 0) {
        currentParagraphs.push(...leadingParagraphs);
        leadingParagraphs = [];
      }

      if (pendingPrefaceTitle === heading.title && pendingPrefaceParagraphs.length > 0) {
        currentParagraphs.push(...pendingPrefaceParagraphs);
      }
      pendingPrefaceTitle = null;
      pendingPrefaceParagraphs = [];
      activeSection = 'body';
      appendSegments(currentParagraphs, extraction.segments, true);
      return;
    }

    if (heading?.kind === 'afterword') {
      if (currentTitle && currentTitle !== heading.title) flushChapter();
      if (!currentTitle) currentTitle = heading.title;
      currentParagraphs.push('【後書き】');
      activeSection = 'afterword';
      appendSegments(currentParagraphs, extraction.segments, true);
      return;
    }

    if (activeSection === 'preface') {
      appendSegments(pendingPrefaceParagraphs, extraction.segments, false);
    } else if (activeSection === 'body' || activeSection === 'afterword') {
      appendSegments(currentParagraphs, extraction.segments, false);
    } else if (chapters.length === 0) {
      appendSegments(leadingParagraphs, extraction.segments, leadingParagraphs.length === 0);
    }
  };

  onProgress?.(1, pdf.numPages);

  for (let batchStart = 2; batchStart <= pdf.numPages; batchStart += EXTRACTION_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(EXTRACTION_CONCURRENCY, pdf.numPages - batchStart + 1) },
      (_, index) => batchStart + index,
    );
    const extractions = await Promise.all(
      pageNumbers.map((pageNumber) => extractPage(pdf, pageNumber, headingColumnX)),
    );
    for (const extraction of extractions) consumeExtraction(extraction);

    const processedPages = pageNumbers[pageNumbers.length - 1];
    onProgress?.(processedPages, pdf.numPages);
    await yieldToEventLoop();
  }

  flushChapter();

  if (chapters.length === 0) {
    throw new Error('小説家になろうのPDFとして話タイトルを検出できませんでした。');
  }

  return {
    ...metadata,
    chapters,
  };
}
