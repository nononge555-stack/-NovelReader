import { useEffect, useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { sampleNovel } from './data/sampleNovel';
import type { Novel, ReaderSettings } from './models/Novel';
import {
  loadChapterProgress,
  loadReaderSettings,
  saveChapterProgress,
  saveReaderSettings,
} from './storage/readerStorage';

const novels = [sampleNovel];

export default function App() {
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [settings, setSettings] = useState<ReaderSettings>(() => loadReaderSettings());

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  const openNovel = (novel: Novel) => {
    const savedIndex = loadChapterProgress(novel.id);
    const safeIndex = Math.min(savedIndex, Math.max(novel.chapters.length - 1, 0));
    setChapterIndex(safeIndex);
    setSelectedNovel(novel);
  };

  const changeChapter = (nextIndex: number) => {
    if (!selectedNovel) return;
    if (nextIndex < 0 || nextIndex >= selectedNovel.chapters.length) return;

    setChapterIndex(nextIndex);
    saveChapterProgress(selectedNovel.id, nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!selectedNovel) {
    return <Library novels={novels} onOpenNovel={openNovel} />;
  }

  return (
    <Reader
      novel={selectedNovel}
      chapterIndex={chapterIndex}
      settings={settings}
      onSettingsChange={setSettings}
      onChapterChange={changeChapter}
      onBack={() => setSelectedNovel(null)}
    />
  );
}
