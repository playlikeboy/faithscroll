/** Study data bundled with the Bible: topical index (OpenBible.info + Nave's) and Easton's dictionary. */

export type TopicSource = 'openbible' | 'nave';

export interface TopicSummary {
  id: number;
  /** Display name, e.g. "Love", "Lord’s Supper". */
  name: string;
  /** Number of distinct passages linked to the topic. */
  verseCount: number;
}

export interface TopicPassage {
  startVerseId: number;
  endVerseId: number;
  /** Text of the first verses of the passage (at most three, "…" appended when longer). */
  text: string;
  /** OpenBible.info net votes (0 for Nave's references). */
  weight: number;
  source: TopicSource;
}

export interface TopicSection {
  /** Nave's subtopic label ("Of man for God"), or null for general references. */
  label: string | null;
  passages: TopicPassage[];
}

export interface TopicDetail extends TopicSummary {
  /** Most-voted passages from OpenBible.info, best first. */
  popular: TopicPassage[];
  /** Nave's Topical Bible references grouped by subtopic, in book order. */
  sections: TopicSection[];
  seeAlso: TopicSummary[];
}

export interface DictionaryEntrySummary {
  id: number;
  term: string;
  /** First ~160 characters of the definition. */
  preview: string;
}

export interface DictionaryEntry {
  id: number;
  term: string;
  /** Plain text; paragraphs separated by a blank line. */
  definition: string;
}
