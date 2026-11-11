/** Shared editor-state types and helpers for the pure text operations. */

export interface TextSelection {
  start: number;
  end: number;
}

export interface EditorState {
  text: string;
  selection: TextSelection;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Clamp the selection into the text and order it (start ≤ end). */
export function normalizeState(state: EditorState): EditorState {
  const text = typeof state.text === 'string' ? state.text : '';
  const a = clamp(state.selection?.start ?? text.length, 0, text.length);
  const b = clamp(state.selection?.end ?? a, 0, text.length);
  return { text, selection: { start: Math.min(a, b), end: Math.max(a, b) } };
}

export function caret(text: string, offset: number): EditorState {
  return { text, selection: { start: offset, end: offset } };
}

export function lineStartAt(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

export function lineEndAt(text: string, offset: number): number {
  const end = text.indexOf('\n', offset);
  return end === -1 ? text.length : end;
}
