/** Public API of the editor feature. UI lives in `@/components/editor/{note-editor,note-renderer}`. */
export {
  DEFAULT_AUTOSAVE_DELAY_MS,
  useAutosave,
  type AutosaveResult,
  type AutosaveStatus,
  type UseAutosaveOptions,
} from './use-autosave';
export {
  extractTimestamps,
  parseInline,
  parseNote,
  toPlainText,
  type HeadingLevel,
  type NoteBlock,
  type NoteInline,
  type NoteTimestamp,
  type ParseOptions,
} from './markdown';
export {
  continueList,
  insertToken,
  timestampToken,
  toggleBlockFormat,
  toggleInlineFormat,
  type BlockFormat,
  type EditorState,
  type InlineFormat,
  type TextSelection,
} from './text-ops';
export { referenceLabel, spokenDuration, timestampLabel } from './labels';
