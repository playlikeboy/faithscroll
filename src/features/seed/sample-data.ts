/**
 * Static sample content shown on a fresh install so the Journal, Library, Sermons and Today
 * screens aren't empty. Everything here is fictional, generic and non-denominational.
 * Scripture is stored as references (verse ids); short quotes inside personal notes are copied
 * word for word from the bundled World English Bible.
 */
import type { HighlightColorValue } from '@/features/bible/annotations';
import type { VerseRef } from '@/features/bible/types';
import { toVerseId } from '@/features/bible/verse-id';
import type { JournalEntryType } from '@/features/journal/types';
import type { PrayerStatus } from '@/features/prayers/types';

/** Tag added to every taggable sample item, so samples are easy to spot and filter. */
export const SAMPLE_TAG = 'Sample';

export interface SamplePassage {
  startVerseId: number;
  endVerseId: number;
}

const ref = (bookId: number, chapter: number, verse: number): VerseRef => ({ bookId, chapter, verse });

function passage(bookId: number, chapter: number, startVerse: number, endVerse: number = startVerse): SamplePassage {
  return { startVerseId: toVerseId(ref(bookId, chapter, startVerse)), endVerseId: toVerseId(ref(bookId, chapter, endVerse)) };
}

/** Canonical book ids (Protestant order, 1-based). */
const BOOK = {
  psalms: 19,
  proverbs: 20,
  isaiah: 23,
  lamentations: 25,
  matthew: 40,
  john: 43,
  secondCorinthians: 47,
  ephesians: 49,
  philippians: 50,
  firstThessalonians: 52,
  james: 59,
} as const;

export const PASSAGES = {
  psalm23: passage(BOOK.psalms, 23, 1, 6),
  psalm34v18: passage(BOOK.psalms, 34, 18),
  psalm46v1: passage(BOOK.psalms, 46, 1),
  proverbs3v5to6: passage(BOOK.proverbs, 3, 5, 6),
  isaiah40v31: passage(BOOK.isaiah, 40, 31),
  lamentations3v22to23: passage(BOOK.lamentations, 3, 22, 23),
  matthew11v28to30: passage(BOOK.matthew, 11, 28, 30),
  matthew18v21to22: passage(BOOK.matthew, 18, 21, 22),
  matthew18v23to35: passage(BOOK.matthew, 18, 23, 35),
  matthew18v21to35: passage(BOOK.matthew, 18, 21, 35),
  john3v16: passage(BOOK.john, 3, 16),
  secondCorinthians12v9: passage(BOOK.secondCorinthians, 12, 9),
  ephesians4v32: passage(BOOK.ephesians, 4, 32),
  philippians4v6to7: passage(BOOK.philippians, 4, 6, 7),
  firstThessalonians5v16to18: passage(BOOK.firstThessalonians, 5, 16, 18),
  james1v5: passage(BOOK.james, 1, 5),
} as const;

// ---------------------------------------------------------------------------
// Sermon
// ---------------------------------------------------------------------------

export const SAMPLE_SERIES = {
  title: 'Living With Grace',
  description: 'A sample series about receiving grace and extending it to others.',
  speaker: 'Sample Pastor',
} as const;

export const SAMPLE_SERMON = {
  title: 'The Power of Forgiveness',
  speaker: 'Sample Pastor',
  church: 'Sample Community Church',
  daysAgo: 2,
  mainPassage: { text: 'Matthew 18:21-35', ...PASSAGES.matthew18v21to35 },
  tags: ['Forgiveness'],
} as const;

export const SAMPLE_SERMON_NOTES = [
  '# The Power of Forgiveness',
  'Main passage: Matthew 18:21-35',
  '',
  '## Peter’s question [02:15]',
  '- Peter asks how often he should forgive: “Until seven times?”',
  '- Jesus answers “until seventy times seven” (Matthew 18:22)',
  '- Forgiveness isn’t a counting game',
  '',
  '## The unforgiving servant [09:40]',
  '- The first servant is forgiven a debt he could never repay',
  '- He then refuses to forgive a much smaller debt',
  '- **We forgive because we have been forgiven**',
  '',
  '## Forgiving from the heart [21:05]',
  '1. Be honest about the hurt',
  '2. Remember the mercy you’ve received (Ephesians 4:32)',
  '3. Release the debt, and do it again when the hurt comes back',
  '',
  '==Forgiveness is not pretending it didn’t matter.==',
  '',
  '## Questions to sit with',
  '- Who do I need to forgive?',
  '- Where am I still keeping score?',
].join('\n');

export interface SampleBookmark {
  positionMs: number;
  note: string;
  reference: { text: string } & SamplePassage;
}

export const SAMPLE_BOOKMARKS: readonly SampleBookmark[] = [
  { positionMs: 135_000, note: 'Peter’s question', reference: { text: 'Matthew 18:21-22', ...PASSAGES.matthew18v21to22 } },
  { positionMs: 580_000, note: 'The parable begins', reference: { text: 'Matthew 18:23-35', ...PASSAGES.matthew18v23to35 } },
  { positionMs: 1_265_000, note: 'Forgiving from the heart', reference: { text: 'Ephesians 4:32', ...PASSAGES.ephesians4v32 } },
];

export const SAMPLE_ACTION_ITEMS: readonly { title: string; notes: string }[] = [
  { title: 'Write down one hurt I’m ready to release', notes: 'Keep it private. Just name it honestly before God.' },
  { title: 'Pray this week for someone I find hard to forgive', notes: 'A few minutes each morning is enough.' },
];

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export interface SampleJournalEntry {
  key: string;
  title: string;
  entryType: JournalEntryType;
  prompt: string;
  daysAgo: number;
  content: string;
  passages: readonly SamplePassage[];
  tags: readonly string[];
  linkToSermon?: boolean;
  linkToPrayerKey?: string;
}

export const SAMPLE_JOURNAL_ENTRIES: readonly SampleJournalEntry[] = [
  {
    key: 'new-every-morning',
    title: 'New every morning',
    entryType: 'reflection',
    prompt: 'What stood out to me today?',
    daysAgo: 0,
    content: [
      'Yesterday felt heavy and I went to bed carrying it.',
      '',
      'This morning I read Lamentations 3 and stopped at “They are new every morning. Great is your faithfulness.” I don’t have to drag yesterday’s mistakes into today.',
      '',
      '- Start the day with a few quiet minutes before my phone',
      '- Notice one mercy before lunch',
    ].join('\n'),
    passages: [PASSAGES.lamentations3v22to23],
    tags: ['Hope'],
  },
  {
    key: 'forgiving-from-the-heart',
    title: 'Forgiving from the heart',
    entryType: 'sermon_reflection',
    prompt: 'What action can I take?',
    daysAgo: 1,
    content: [
      'Still thinking about Sunday’s sermon on Matthew 18.',
      '',
      'I’ve been keeping a quiet list of the times someone close to me let me down. The parable made me see how much I’ve been forgiven, and how small my list looks next to that.',
      '',
      '**Next step:** pray for them by name this week, and stop rehearsing the old conversation in my head.',
    ].join('\n'),
    passages: [PASSAGES.matthew18v21to35, PASSAGES.ephesians4v32],
    tags: ['Forgiveness'],
    linkToSermon: true,
  },
  {
    key: 'psalm-23-slowly',
    title: 'Psalm 23, slowly',
    entryType: 'bible_study',
    prompt: 'What am I learning?',
    daysAgo: 3,
    content: [
      '# Psalm 23',
      'Read it three times, one line at a time.',
      '',
      '- v1: “I shall lack nothing.” Contentment starts with who my shepherd is, not with what I have.',
      '- v2–3: He *leads* and *restores*. Rest is something I receive, not something I earn.',
      '- v4: “for you are with me.” The valley is still there, but I’m not alone in it.',
      '',
      'Question to keep: where do I need to let myself be led this week?',
    ].join('\n'),
    passages: [PASSAGES.psalm23],
    tags: ['Psalms'],
  },
  {
    key: 'anxious-about-the-week',
    title: 'Anxious about the week',
    entryType: 'prayer',
    prompt: 'What am I struggling with?',
    daysAgo: 4,
    content: [
      'Lord, the week ahead feels crowded and I’m already tired.',
      '',
      'You said “In nothing be anxious,” so I’m handing you the list: the deadline, the hard conversation, the things I can’t control. Guard my heart and my thoughts. Help me do today’s part well and leave tomorrow with you.',
    ].join('\n'),
    passages: [PASSAGES.philippians4v6to7],
    tags: ['Peace'],
    linkToPrayerKey: 'peace-for-the-week',
  },
  {
    key: 'small-mercies',
    title: 'Small mercies',
    entryType: 'gratitude',
    prompt: 'What am I grateful for?',
    daysAgo: 6,
    content: [
      'Three things from today:',
      '',
      '1. A long walk and an unexpectedly warm afternoon',
      '2. A friend who checked in without being asked',
      '3. Dinner around the table with everyone home',
      '',
      '“In everything give thanks.” Writing these down makes me notice how much I usually miss.',
    ].join('\n'),
    passages: [PASSAGES.firstThessalonians5v16to18],
    tags: ['Gratitude'],
  },
  {
    key: 'learning-to-rest',
    title: 'Learning to rest',
    entryType: 'personal',
    prompt: 'What do I want to remember?',
    daysAgo: 8,
    content: [
      'I keep treating rest as a reward for finishing everything, which means I never get there.',
      '',
      'Jesus says “Come to me… and I will give you rest.” It’s an invitation, not a prize. I want to remember that the next time I feel guilty for stopping.',
    ].join('\n'),
    passages: [PASSAGES.matthew11v28to30],
    tags: ['Rest'],
  },
  {
    key: 'waiting-well',
    title: 'Waiting well',
    entryType: 'reflection',
    prompt: 'What am I learning?',
    daysAgo: 10,
    content: [
      'Still no clear answer on the decision at work. I don’t like waiting.',
      '',
      'Isaiah 40:31 says “those who wait for Yahweh will renew their strength.” Maybe waiting isn’t wasted time. Maybe it’s where strength is being renewed.',
    ].join('\n'),
    passages: [PASSAGES.isaiah40v31, PASSAGES.proverbs3v5to6],
    tags: ['Hope'],
  },
];

// ---------------------------------------------------------------------------
// Prayers
// ---------------------------------------------------------------------------

export interface SamplePrayer {
  key: string;
  title: string;
  content: string;
  category: string;
  status: PrayerStatus;
  daysAgo: number;
  /** Note recorded with the status change (answered / archived). */
  statusNote?: string;
  passages: readonly SamplePassage[];
}

export const SAMPLE_PRAYERS: readonly SamplePrayer[] = [
  {
    key: 'peace-for-the-week',
    title: 'Peace for the week ahead',
    content: 'For a calm heart in a busy week, and wisdom to put first things first.',
    category: 'Guidance',
    status: 'praying',
    daysAgo: 4,
    passages: [PASSAGES.philippians4v6to7],
  },
  {
    key: 'family-closeness',
    title: 'Health and closeness for my family',
    content: 'For good health, patience with one another, and time together that isn’t rushed.',
    category: 'Family',
    status: 'ongoing',
    daysAgo: 9,
    passages: [],
  },
  {
    key: 'work-decision',
    title: 'Wisdom for a decision at work',
    content: 'Not sure which direction to take. Asking for clarity and a settled heart.',
    category: 'Work',
    status: 'answered',
    daysAgo: 12,
    statusNote: 'Talked it through with a trusted friend and felt clear about the next step. Grateful for the peace that came with it.',
    passages: [PASSAGES.james1v5],
  },
  {
    key: 'community-meal',
    title: 'Our church’s community meal',
    content: 'For the volunteers and for everyone who comes, that they’d feel welcome.',
    category: 'Church',
    status: 'archived',
    daysAgo: 20,
    statusNote: 'The meal series finished for the season. Thankful for every table.',
    passages: [],
  },
];

// ---------------------------------------------------------------------------
// Bible annotations & reading
// ---------------------------------------------------------------------------

export const SAMPLE_HIGHLIGHTS: readonly { verseId: number; color: HighlightColorValue }[] = [
  { verseId: PASSAGES.psalm23.startVerseId, color: 'gold' },
  { verseId: PASSAGES.lamentations3v22to23.startVerseId, color: 'sage' },
  { verseId: PASSAGES.lamentations3v22to23.endVerseId, color: 'sage' },
  { verseId: PASSAGES.john3v16.startVerseId, color: 'sky' },
  { verseId: PASSAGES.psalm46v1.startVerseId, color: 'rose' },
];

/** Saved verses; all of them go into the sample collection. */
export const SAMPLE_SAVED_VERSES: readonly SamplePassage[] = [
  PASSAGES.psalm46v1,
  PASSAGES.psalm34v18,
  PASSAGES.matthew11v28to30,
  PASSAGES.secondCorinthians12v9,
];

export const SAMPLE_COLLECTION = {
  title: 'Verses for hard days',
  description: 'A sample collection: passages to return to when things feel heavy.',
} as const;

export const SAMPLE_VERSE_NOTE = {
  ...PASSAGES.lamentations3v22to23,
  content: [
    'Written on a hard morning.',
    '',
    '“They are new every morning.” I don’t have to carry yesterday into today.',
    '',
    '**Great is your faithfulness.**',
  ].join('\n'),
} as const;

/** "Continue reading" position: John 3 in the bundled World English Bible. */
export const SAMPLE_READING = { translationId: 'WEB', bookId: BOOK.john, chapter: 3, verse: 1 } as const;
