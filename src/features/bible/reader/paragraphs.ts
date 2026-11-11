import type { Verse } from '../types';

/** One virtualised row of the reader: an optional section heading and a paragraph or stanza. */
export interface ChapterBlock {
  key: string;
  heading: string | null;
  poetry: boolean;
  verses: readonly Verse[];
}

/**
 * Long paragraphs are split so the list stays virtualised (e.g. Psalm 119 or data
 * without paragraph markers). The split only adds a paragraph break.
 */
export const MAX_VERSES_PER_BLOCK = 12;

function startsNewBlock(verse: Verse, previous: Verse | undefined, currentSize: number): boolean {
  if (!previous) return true;
  if (verse.heading) return true;
  if (verse.paragraphStart) return true;
  if (verse.poetry !== previous.poetry) return true;
  return currentSize >= MAX_VERSES_PER_BLOCK;
}

/** Group a chapter's verses into headed paragraphs / stanzas, in order. */
export function buildChapterBlocks(verses: readonly Verse[]): ChapterBlock[] {
  const blocks: ChapterBlock[] = [];
  let current: Verse[] = [];
  let heading: string | null = null;

  const flush = () => {
    if (current.length === 0) return;
    blocks.push({ key: `b${current[0].id}`, heading, poetry: current[0].poetry, verses: current });
  };

  verses.forEach((verse, index) => {
    if (startsNewBlock(verse, verses[index - 1], current.length)) {
      flush();
      current = [];
      heading = verse.heading;
    }
    current = [...current, verse];
  });
  flush();
  return blocks;
}

/** Index of the block containing `verseId`, or -1. */
export function findBlockIndex(blocks: readonly ChapterBlock[], verseId: number): number {
  return blocks.findIndex((block) => block.verses.some((verse) => verse.id === verseId));
}
