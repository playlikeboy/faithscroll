/**
 * CONTRACT STUB — owned by the editor agent.
 * Renders Markdown-lite content: headings, lists, bold, italic, ==highlight==,
 * tappable `[mm:ss]` timestamps and tappable Scripture references.
 */
import { Text } from 'react-native';

import type { VerseRange } from '@/features/bible/types';

export interface NoteRendererProps {
  content: string;
  onPressTimestamp?: (positionMs: number) => void;
  onPressReference?: (range: VerseRange) => void;
}

export function NoteRenderer({ content }: NoteRendererProps) {
  return <Text>{content}</Text>;
}
