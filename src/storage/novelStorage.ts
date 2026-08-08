import type { Novel } from '../models/Novel';

const DATABASE_NAME = 'novel-reader';
const DATABASE_VERSION = 1;
const NOVEL_STORE_NAME = 'novels';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('このブラウザではIndexedDBを利用できません。'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NOVEL_STORE_NAME)) {
        database.createObjectStore(NOVEL_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした。'));
    request.onblocked = () => reject(new Error('IndexedDBの更新が別のタブによってブロックされています。'));
  });
}

export async function loadStoredNovels(): Promise<Novel[]> {
  const database = await openDatabase();

  try {
    return await new Promise<Novel[]>((resolve, reject) => {
      const transaction = database.transaction(NOVEL_STORE_NAME, 'readonly');
      const request = transaction.objectStore(NOVEL_STORE_NAME).getAll();

      request.onsuccess = () => resolve(request.result as Novel[]);
      request.onerror = () => reject(request.error ?? new Error('保存済み作品を読み込めませんでした。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('保存済み作品の読み込みが中断されました。'));
    });
  } finally {
    database.close();
  }
}

export async function saveStoredNovel(novel: Novel): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(NOVEL_STORE_NAME, 'readwrite');
      transaction.objectStore(NOVEL_STORE_NAME).put(novel);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('作品を保存できませんでした。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('作品の保存が中断されました。'));
    });
  } finally {
    database.close();
  }
}

export async function deleteStoredNovel(novelId: string): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(NOVEL_STORE_NAME, 'readwrite');
      transaction.objectStore(NOVEL_STORE_NAME).delete(novelId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('作品を削除できませんでした。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('作品の削除が中断されました。'));
    });
  } finally {
    database.close();
  }
}
