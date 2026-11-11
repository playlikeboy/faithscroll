import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform } from 'react-native';

import { NoteEditor, type NoteEditorProps } from '../note-editor';

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));

type HarnessProps = Omit<NoteEditorProps, 'value' | 'onChangeText'> & {
  initial?: string;
  onChange?: (next: string) => void;
};

/** Controlled wrapper, as a real screen would use it. */
function Harness({ initial = '', onChange, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <NoteEditor
      accessibilityLabel="Sermon notes"
      {...rest}
      value={value}
      onChangeText={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const input = () => screen.getByLabelText('Sermon notes');

async function select(start: number, end = start) {
  await fireEvent(input(), 'selectionChange', { nativeEvent: { selection: { start, end } } });
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

describe('NoteEditor toolbar', () => {
  test('shows the core formatting buttons with labels', async () => {
    await render(<Harness />);

    for (const name of ['Heading', 'Bold', 'Italic', 'Highlight', 'Bulleted list', 'Numbered list', 'Hide keyboard']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Insert timestamp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Insert Scripture reference' })).toBeNull();
  });

  test('shows Timestamp and Scripture only when their props are given', async () => {
    await render(<Harness getTimestampMs={() => 0} onRequestScripture={async () => null} />);

    expect(screen.getByRole('button', { name: 'Insert timestamp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Insert Scripture reference' })).toBeTruthy();
  });

  test('hides the toolbar when not editable', async () => {
    await render(<Harness editable={false} />);
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
  });

  test('bolds the selection, keeps it selected and gives haptic feedback', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="God is good" onChange={onChange} />);

    await select(7, 11);
    await press('Bold');

    expect(onChange).toHaveBeenLastCalledWith('God is **good**');
    expect(input().props.selection).toEqual({ start: 9, end: 13 });
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  test('inserts an empty pair at the caret and releases the controlled selection afterwards', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="Note" onChange={onChange} />);

    await select(4);
    await press('Italic');
    expect(onChange).toHaveBeenLastCalledWith('Note**');
    expect(input().props.selection).toEqual({ start: 5, end: 5 });

    await select(5);
    expect(input().props.selection).toBeUndefined();
  });

  test('applies heading, highlight and list formats', async () => {
    const onChange = jest.fn();
    await render(<Harness initial={'Grace\none\ntwo'} onChange={onChange} />);

    await select(0, 5);
    await press('Highlight');
    expect(onChange).toHaveBeenLastCalledWith('==Grace==\none\ntwo');

    await select(0);
    await press('Heading');
    expect(onChange).toHaveBeenLastCalledWith('# ==Grace==\none\ntwo');

    await select(12, 19);
    await press('Numbered list');
    expect(onChange).toHaveBeenLastCalledWith('# ==Grace==\n1. one\n2. two');

    await press('Bulleted list');
    expect(onChange).toHaveBeenLastCalledWith('# ==Grace==\n- one\n- two');
  });

  test('inserts the current timestamp at the caret', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="Key moment" onChange={onChange} getTimestampMs={() => 272_000} />);

    await select(10);
    await press('Insert timestamp');

    expect(onChange).toHaveBeenLastCalledWith('Key moment [04:32] ');
  });

  test('does nothing when there is no timestamp available', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="x" onChange={onChange} getTimestampMs={() => null} />);

    await press('Insert timestamp');

    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows an error when reading the timestamp fails', async () => {
    await render(
      <Harness
        getTimestampMs={() => {
          throw new Error('player gone');
        }}
      />,
    );

    await press('Insert timestamp');

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't read the current time. Please try again.");
  });

  test('inserts the Scripture reference returned by the picker', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="Read" onChange={onChange} onRequestScripture={async () => 'Romans 8:28'} />);

    await select(4);
    await press('Insert Scripture reference');

    expect(onChange).toHaveBeenLastCalledWith('Read Romans 8:28 ');
  });

  test('ignores a cancelled Scripture picker', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="Read" onChange={onChange} onRequestScripture={async () => null} />);

    await press('Insert Scripture reference');

    expect(onChange).not.toHaveBeenCalled();
  });

  test('disables the Scripture button while the picker is open and reports failures', async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    const onRequestScripture = jest.fn(() => new Promise<string | null>((_, reject) => (rejectRequest = reject)));
    await render(<Harness onRequestScripture={onRequestScripture} />);

    await press('Insert Scripture reference');
    expect(screen.getByRole('button', { name: 'Insert Scripture reference' })).toBeDisabled();
    await press('Insert Scripture reference');
    expect(onRequestScripture).toHaveBeenCalledTimes(1);

    await act(async () => rejectRequest(new Error('offline')));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't add that Scripture reference. Please try again.");
    expect(screen.getByRole('button', { name: 'Insert Scripture reference' })).toBeEnabled();
  });
});

describe('NoteEditor typing', () => {
  test('passes ordinary edits straight through', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);

    await fireEvent.changeText(input(), 'Hello');

    expect(onChange).toHaveBeenLastCalledWith('Hello');
  });

  test('continues a list when Return is pressed on an item', async () => {
    const onChange = jest.fn();
    await render(<Harness initial="1. Forgive" onChange={onChange} />);

    await select(10);
    await fireEvent.changeText(input(), '1. Forgive\n');

    expect(onChange).toHaveBeenLastCalledWith('1. Forgive\n2. ');
    expect(input().props.selection).toEqual({ start: 14, end: 14 });
  });

  test('calls focus and blur callbacks', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<Harness onFocus={onFocus} onBlur={onBlur} />);

    await fireEvent(input(), 'focus');
    await fireEvent(input(), 'blur');

    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  test('stays responsive with a 5,000-word note', async () => {
    const onChange = jest.fn();
    const longNote = Array.from({ length: 700 }, (_, i) => `- Point ${i} about **grace** and [12:${String(i % 60).padStart(2, '0')}] today`).join('\n');
    expect(longNote.split(/\s+/).length).toBeGreaterThan(5_000);
    await render(<Harness initial={longNote} onChange={onChange} />);

    const started = Date.now();
    await select(0, longNote.length);
    await press('Numbered list');
    const elapsed = Date.now() - started;

    expect(onChange.mock.calls[0][0].startsWith('1. Point 0')).toBe(true);
    expect(onChange.mock.calls[0][0]).toContain('\n500. Point 499');
    expect(elapsed).toBeLessThan(2_000);
  });
});

describe('NoteEditor on Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows the toolbar only while the editor is focused', async () => {
    await render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();

    await fireEvent(input(), 'focus');
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();

    await fireEvent(input(), 'blur');
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
  });
});
