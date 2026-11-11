import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AnswerCard } from '../study/answer-card';
import { DeepStudyView } from '../study/deep-study-view';
import { PassageHeader } from '../study/passage-header';
import { StudySection } from '../study/study-section';
import { parseAskAnswer, parseDeepStudyOutput } from '@/features/study-ai/schema';
import { askAnswerFixture, deepStudyFixture } from '@/features/study-ai/testing/fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function study() {
  const parsed = parseDeepStudyOutput({ ...deepStudyFixture(), original_language: null, uncertainty_note: 'Dating is debated.' });
  if (!parsed.success) throw new Error(parsed.error);
  return parsed.data;
}

describe('StudySection', () => {
  test('collapses and expands, announcing its state', async () => {
    await render(
      <StudySection title="Overview" kind="interpretation" sources={[{ type: 'passage', reference: 'John 3:16', label: 'The passage' }]}>
        <></>
      </StudySection>,
    );
    const header = screen.getByRole('button', { name: 'Overview' });
    expect(header.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByLabelText('Interpretation')).toBeNull();

    await fireEvent.press(header);
    expect(screen.getByRole('button', { name: 'Overview' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByLabelText('Interpretation')).toBeTruthy();
    expect(screen.getByText('Sources — The passage: John 3:16')).toBeTruthy();
  });
});

describe('DeepStudyView', () => {
  test('labels AI content, shows sections, kind badges, uncertainty and the disclaimer', async () => {
    await render(<DeepStudyView study={study()} mode="advanced" droppedReferences={1} />);
    expect(screen.getByLabelText('AI-generated · Advanced study')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Theological significance' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Original language' })).toBeNull();
    expect(screen.getByText(/only when verified lexical data is available/)).toBeTruthy();
    expect(screen.getByText('Dating is debated.')).toBeTruthy();
    expect(screen.getByText(/1 reference was left out/)).toBeTruthy();
    expect(screen.getByText(/not divine authority/)).toBeTruthy();
    // The first two sections start expanded and show their kind.
    expect(screen.getAllByLabelText('From the text').length).toBeGreaterThan(0);
  });

  test('related Scripture opens the Bible reader', async () => {
    await render(<DeepStudyView study={study()} mode="basic" droppedReferences={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Related Scripture' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Romans 5:8' }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/45/5?verse=8');
  });
});

describe('AnswerCard', () => {
  test('shows the answer, kind, citations and pastoral suggestion', async () => {
    const parsed = parseAskAnswer({ ...askAnswerFixture(), uncertainty: 'Traditions differ.', suggest_pastor: true });
    if (!parsed.success) throw new Error(parsed.error);
    await render(<AnswerCard answer={parsed.data} droppedReferences={0} />);
    expect(screen.getByText('Jesus is explaining new birth.')).toBeTruthy();
    expect(screen.getByLabelText('Text and interpretation')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'John 3:3' })).toBeTruthy();
    expect(screen.getByText('Uncertain or debated: Traditions differ.')).toBeTruthy();
    expect(screen.getByText(/pastor or church leader/)).toBeTruthy();
  });
});

describe('PassageHeader', () => {
  test('shows the reference, translation and verse text', async () => {
    await render(
      <PassageHeader
        passage={{
          range: { start: { bookId: 43, chapter: 3, verse: 16 }, end: { bookId: 43, chapter: 3, verse: 16 } },
          reference: 'John 3:16',
          translation: 'WEB',
          truncated: false,
          verses: [{ id: 43003016, bookId: 43, chapter: 3, verse: 16, text: 'For God so loved the world', heading: null, paragraphStart: true, poetry: false }],
        }}
      />,
    );
    expect(screen.getByText('John 3:16 · WEB')).toBeTruthy();
    expect(screen.getByText(/For God so loved the world/)).toBeTruthy();
  });
});
