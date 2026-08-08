export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  description: string;
  chapters: Chapter[];
}

export type ReaderTheme = 'paper' | 'dark';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
}
