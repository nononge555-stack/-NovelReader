import { useCallback, useEffect, useRef, useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Toast, type ToastKind, type ToastMessage } from './components/Toast';
import { sampleNovel } from './data/sampleNovel';
import type { Novel, ReaderSettings } from './models/Novel';
import { importPdfAsNovel } from './pdf/importPdf';
import { loadStoredNovels, saveStoredNovel } from './storage/novelStorage';
import {
  loadChapterProgress,
  loadReaderSettings,
  saveChapterProgress,
  saveReaderSettings,
} from './storage/readerStorage';

const PENDING_TOAST_KEY = 'novel-reader.pending-toast.v1';

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export default function App() {
  const [novels, setNovels] = useState<Novel[]>([sampleNovel]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [settings, setSettings] = useState<ReaderSettings>(() => loadReaderSettings());
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [pdfImportMessage, setPdfImportMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragDepthRef = useRef(0);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, kind, message });
  }, []);

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    loadStoredNovels()
      .then((storedNovels) => {
        if (cancelled || storedNovels.length === 0) return;

        setNovels((current) => {
          const currentIds = new Set(current.map((novel) => novel.id));
          const restored = storedNovels.filter((novel) => !currentIds.has(novel.id));
          return [...restored, ...current];
        });
      })
      .catch((error) => {
        console.error('保存済み作品の読み込みに失敗しました。', error);
        showToast('保存済み作品の読み込みに失敗しました。', 'error');
      });

    try {
      const pendingToast = sessionStorage.getItem(PENDING_TOAST_KEY);
      if (pendingToast) {
        sessionStorage.removeItem(PENDING_TOAST_KEY);
        const parsed = JSON.parse(pendingToast) as { message?: string; kind?: ToastKind };
        if (parsed.message) showToast(parsed.message, parsed.kind ?? 'success');
      }
    } catch (error) {
      console.warn('リロード後の通知を復元できませんでした。', error);
    }

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const openNovel = (novel: Novel) => {
    const savedIndex = loadChapterProgress(novel.id);
    const safeIndex = Math.min(savedIndex, Math.max(novel.chapters.length - 1, 0));
    setChapterIndex(safeIndex);
    setSelectedNovel(novel);
  };

  const importPdf = useCallback(
    async (file: File) => {
      if (isImportingPdf) {
        showToast('PDFを解析中です。完了してから次のPDFを追加してください。', 'info');
        return;
      }

      if (!isPdfFile(file)) {
        showToast('PDFファイルをドロップしてください。', 'error');
        return;
      }

      const wasOnLibrary = selectedNovel === null;
      setIsImportingPdf(true);
      setPdfImportMessage(`${file.name} を解析しています…`);

      try {
        const novel = await importPdfAsNovel(file, (processedPages, totalPages) => {
          const percentage = Math.round((processedPages / totalPages) * 100);
          setPdfImportMessage(
            `${file.name} を解析しています… ${processedPages} / ${totalPages}ページ（${percentage}%）`,
          );
        });

        try {
          await saveStoredNovel(novel);
        } catch (storageError) {
          console.error('作品のIndexedDB保存に失敗しました。', storageError);
          setNovels((current) => [novel, ...current.filter((item) => item.id !== novel.id)]);
          const warning = `${novel.title} は読み込めましたが、ブラウザへの保存に失敗しました。`;
          setPdfImportMessage(warning);
          showToast(warning, 'error');
          return;
        }

        setNovels((current) => [novel, ...current.filter((item) => item.id !== novel.id)]);
        const successMessage = `${novel.title} を追加しました（${novel.chapters.length}話）。`;
        setPdfImportMessage(successMessage);

        if (wasOnLibrary) {
          try {
            sessionStorage.setItem(
              PENDING_TOAST_KEY,
              JSON.stringify({ message: successMessage, kind: 'success' satisfies ToastKind }),
            );
          } catch (error) {
            console.warn('リロード後の通知を保存できませんでした。', error);
          }

          window.location.reload();
          return;
        }

        showToast(successMessage, 'success');
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'PDFの読み込みに失敗しました。';
        const failureMessage = `PDFの読み込みに失敗しました: ${message}`;
        setPdfImportMessage(failureMessage);
        showToast(failureMessage, 'error');
      } finally {
        setIsImportingPdf(false);
      }
    },
    [isImportingPdf, selectedNovel, showToast],
  );

  useEffect(() => {
    const containsFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const handleDragEnter = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFile(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setIsDraggingFile(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFile(false);
    };

    const handleDrop = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFile(false);

      const files = Array.from(event.dataTransfer?.files ?? []);
      const pdfFile = files.find(isPdfFile);

      if (!pdfFile) {
        showToast('PDFファイルをドロップしてください。', 'error');
        return;
      }

      void importPdf(pdfFile);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [importPdf, showToast]);

  const changeChapter = (nextIndex: number) => {
    if (!selectedNovel) return;
    if (nextIndex < 0 || nextIndex >= selectedNovel.chapters.length) return;

    setChapterIndex(nextIndex);
    saveChapterProgress(selectedNovel.id, nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const page = selectedNovel ? (
    <Reader
      novel={selectedNovel}
      chapterIndex={chapterIndex}
      settings={settings}
      onSettingsChange={setSettings}
      onChapterChange={changeChapter}
      onBack={() => setSelectedNovel(null)}
    />
  ) : (
    <Library
      novels={novels}
      isImportingPdf={isImportingPdf}
      pdfImportMessage={pdfImportMessage}
      onImportPdf={importPdf}
      onOpenNovel={openNovel}
    />
  );

  return (
    <>
      {page}
      {isDraggingFile && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-card">
            <strong>PDFをドロップして小説を追加</strong>
            <span>ファイルはブラウザ内で解析されます</span>
          </div>
        </div>
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
