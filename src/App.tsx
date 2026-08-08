import { useEffect, useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { sampleNovel } from './data/sampleNovel';
import type { Novel, ReaderSettings } from './models/Novel';
import { importPdfAsNovel } from './pdf/importPdf';
import {
  loadChapterProgress,
  loadReaderSettings,
  saveChapterProgress,
  saveReaderSettings,
} from './storage/readerStorage';

export default function App() {
  const [novels, setNovels] = useState<Novel[]>([sampleNovel]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [settings, setSettings] = useState<ReaderSettings>(() => loadReaderSettings());
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [pdfImportMessage, setPdfImportMessage] = useState<string | null>(null);

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  const openNovel = (novel: Novel) => {
    const savedIndex = loadChapterProgress(novel.id);
    const safeIndex = Math.min(savedIndex, Math.max(novel.chapters.length - 1, 0));
    setChapterIndex(safeIndex);
    setSelectedNovel(novel);
  };

  const importPdf = async (file: File) => {
    setIsImportingPdf(true);
    setPdfImportMessage(`${file.name} を解析しています…`);

    try {
      const novel = await importPdfAsNovel(file);
      setNovels((current) => [novel, ...current.filter((item) => item.id !== novel.id)]);
      setPdfImportMessage(`${novel.title} を読み込みました（${novel.chapters.length}話を検出）。`);
      openNovel(novel);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'PDFの読み込みに失敗しました。';
      setPdfImportMessage(`PDFの読み込みに失敗しました: ${message}`);
    } finally {
      setIsImportingPdf(false);
    }
  };

  const changeChapter = (nextIndex: number) => {
    if (!selectedNovel) return;
    if (nextIndex < 0 || nextIndex >= selectedNovel.chapters.length) return;

    setChapterIndex(nextIndex);
    saveChapterProgress(selectedNovel.id, nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!selectedNovel) {
    return (
      <Library
        novels={novels}
        isImportingPdf={isImportingPdf}
        pdfImportMessage={pdfImportMessage}
        onImportPdf={importPdf}
        onOpenNovel={openNovel}
      />
    );
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
