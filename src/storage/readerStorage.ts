import type { ReaderSettings } from '../models/Novel';

const SETTINGS_KEY = 'novel-reader.settings.v1';
const PROGRESS_PREFIX = 'novel-reader.progress.v1.';

export const defaultReaderSettings: ReaderSettings = {
  theme: 'paper',
  fontSize: 19,
  lineHeight: 1.95,
  contentWidth: 720,
};

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultReaderSettings;

    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      ...defaultReaderSettings,
      ...parsed,
    };
  } catch {
    return defaultReaderSettings;
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadChapterProgress(novelId: string): number {
  const raw = localStorage.getItem(`${PROGRESS_PREFIX}${novelId}`);
  if (!raw) return 0;

  const chapterIndex = Number.parseInt(raw, 10);
  return Number.isFinite(chapterIndex) && chapterIndex >= 0 ? chapterIndex : 0;
}

export function saveChapterProgress(novelId: string, chapterIndex: number): void {
  localStorage.setItem(`${PROGRESS_PREFIX}${novelId}`, String(chapterIndex));
}
