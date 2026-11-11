import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, LoadingState, TextField } from '@/components/ui';
import { getBook } from '@/features/bible/books';
import { useVerseCount } from '@/features/bible/hooks/use-bible-text';
import { chapterTitle, rangeLabel } from '@/features/bible/reader/format';
import { resolvePassageRequest } from '@/features/bible/reader/passage-requests';
import { parseReference } from '@/features/bible/reference';
import type { BibleBook, VerseRange } from '@/features/bible/types';
import { GUTTER, MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { BookList } from './book-list';
import { NumberGrid } from './number-grid';

export interface PassagePickerProps {
  requestId: string | null;
  title?: string;
  initial?: VerseRange | null;
}

type Step = { kind: 'book' } | { kind: 'chapter'; book: BibleBook } | { kind: 'verse'; book: BibleBook; chapter: number };

function initialStep(initial: VerseRange | null | undefined): Step {
  const book = initial ? getBook(initial.start.bookId) : undefined;
  return book && initial ? { kind: 'verse', book, chapter: initial.start.chapter } : { kind: 'book' };
}

function ReferenceEntry({ onChoose }: { onChoose: (range: VerseRange) => void }) {
  const [text, setText] = useState('');
  const [hasSubmitted, setSubmitted] = useState(false);
  const parsed = text.trim() ? parseReference(text) : null;

  const submit = () => {
    setSubmitted(true);
    if (parsed) onChoose(parsed);
  };

  return (
    <View style={styles.entry}>
      <TextField
        label="Type a reference"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setSubmitted(false);
        }}
        placeholder="Romans 8:28-30"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        error={hasSubmitted && text.trim() && !parsed ? 'We couldn’t read that reference. Try “John 3:16”.' : undefined}
      />
      {parsed ? <FaithButton label={`Use ${rangeLabel(parsed)}`} icon="check" onPress={() => onChoose(parsed)} /> : null}
    </View>
  );
}

function VerseStep({
  book,
  chapter,
  initial,
  onChoose,
  onBack,
}: {
  book: BibleBook;
  chapter: number;
  initial?: VerseRange | null;
  onChoose: (range: VerseRange) => void;
  onBack: () => void;
}) {
  const { count, isLoading } = useVerseCount(book.id, chapter);
  const isInitialChapter = initial?.start.bookId === book.id && initial.start.chapter === chapter;
  const [startVerse, setStartVerse] = useState<number | null>(isInitialChapter ? initial.start.verse : null);
  const ref = (verse: number) => ({ bookId: book.id, chapter, verse });

  const handleSelect = (verse: number) => {
    if (startVerse === null) setStartVerse(verse);
    else onChoose({ start: ref(startVerse), end: ref(Math.max(verse, startVerse)) });
  };

  return (
    <ScrollView contentContainerStyle={styles.step} contentInsetAdjustmentBehavior="automatic">
      <FaithText variant="display" accessibilityRole="header">
        {chapterTitle(book.id, chapter)}
      </FaithText>
      <FaithText variant="secondary" accessibilityLiveRegion="polite">
        {startVerse === null
          ? 'Choose the first verse.'
          : `From verse ${startVerse}. Choose the last verse, or use just this one.`}
      </FaithText>
      {isLoading ? <LoadingState label="Loading verses" /> : null}
      {!isLoading && count === 0 ? (
        <FaithText variant="secondary">Verse numbers aren’t available yet. Type a reference instead.</FaithText>
      ) : null}
      <NumberGrid
        count={count}
        noun="Verse"
        minimum={startVerse ?? 1}
        onSelect={handleSelect}
        isSelected={(verse) => verse === startVerse}
      />
      <View style={styles.actions}>
        {startVerse !== null ? (
          <FaithButton label={`Just verse ${startVerse}`} onPress={() => onChoose({ start: ref(startVerse), end: ref(startVerse) })} />
        ) : null}
        {count > 0 ? (
          <FaithButton label="Whole chapter" variant="secondary" onPress={() => onChoose({ start: ref(1), end: ref(count) })} />
        ) : null}
        <FaithButton label="Back" icon="back" variant="ghost" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

/** Book → chapter → start/end verse, or a typed reference. Resolves the caller's request. */
export function PassagePicker({ requestId, title = 'Choose a passage', initial }: PassagePickerProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(() => initialStep(initial));

  // Leaving without choosing (swipe down, back) resolves the request with null.
  useEffect(() => () => {
    if (requestId) resolvePassageRequest(requestId, null);
  }, [requestId]);

  const choose = (range: VerseRange) => {
    if (requestId) resolvePassageRequest(requestId, range);
    if (router.canGoBack()) router.back();
  };

  const cancel = () => {
    if (requestId) resolvePassageRequest(requestId, null);
    if (router.canGoBack()) router.back();
  };

  const headerLeft = () => (
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={cancel} hitSlop={8} style={styles.cancel}>
      <FaithText style={{ color: colors.primaryText }}>Cancel</FaithText>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title, headerLeft }} />
      {step.kind === 'book' ? (
        <BookList
          header={<ReferenceEntry onChoose={choose} />}
          currentBookId={initial?.start.bookId}
          onSelectBook={(book) =>
            book.chapters === 1 ? setStep({ kind: 'verse', book, chapter: 1 }) : setStep({ kind: 'chapter', book })
          }
        />
      ) : null}
      {step.kind === 'chapter' ? (
        <ScrollView contentContainerStyle={styles.step} contentInsetAdjustmentBehavior="automatic">
          <FaithText variant="display" accessibilityRole="header">
            {step.book.name}
          </FaithText>
          <NumberGrid
            count={step.book.chapters}
            noun="Chapter"
            onSelect={(chapter) => setStep({ kind: 'verse', book: step.book, chapter })}
          />
          <FaithButton label="All books" icon="back" variant="ghost" onPress={() => setStep({ kind: 'book' })} />
        </ScrollView>
      ) : null}
      {step.kind === 'verse' ? (
        <VerseStep
          key={`${step.book.id}:${step.chapter}`}
          book={step.book}
          chapter={step.chapter}
          initial={initial}
          onChoose={choose}
          onBack={() => setStep(step.book.chapters === 1 ? { kind: 'book' } : { kind: 'chapter', book: step.book })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  entry: { gap: 10 },
  step: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 48, gap: 16 },
  actions: { gap: 8, alignItems: 'flex-start' },
  cancel: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 4 },
});
