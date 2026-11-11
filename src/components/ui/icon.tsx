import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/** App icon vocabulary: SF Symbols on iOS, Material Symbols on Android. Add entries as needed. */
export const ICONS = {
  today: { ios: 'sun.max', android: 'wb_sunny' },
  bible: { ios: 'book', android: 'menu_book' },
  sermons: { ios: 'mic', android: 'mic' },
  journal: { ios: 'square.and.pencil', android: 'edit_note' },
  library: { ios: 'books.vertical', android: 'library_books' },
  search: { ios: 'magnifyingglass', android: 'search' },
  settings: { ios: 'gearshape', android: 'settings' },
  add: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  back: { ios: 'chevron.left', android: 'chevron_left' },
  forward: { ios: 'chevron.right', android: 'chevron_right' },
  down: { ios: 'chevron.down', android: 'expand_more' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  check: { ios: 'checkmark', android: 'check' },
  bookmark: { ios: 'bookmark', android: 'bookmark_border' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark' },
  highlight: { ios: 'highlighter', android: 'ink_highlighter' },
  note: { ios: 'note.text', android: 'sticky_note_2' },
  collection: { ios: 'folder.badge.plus', android: 'create_new_folder' },
  study: { ios: 'text.book.closed', android: 'school' },
  related: { ios: 'link', android: 'link' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  reflect: { ios: 'pencil.and.outline', android: 'draw' },
  prayer: { ios: 'hands.sparkles', android: 'volunteer_activism' },
  heart: { ios: 'heart', android: 'favorite_border' },
  heartFilled: { ios: 'heart.fill', android: 'favorite' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  stop: { ios: 'stop.fill', android: 'stop' },
  record: { ios: 'record.circle', android: 'radio_button_checked' },
  skipBack: { ios: 'gobackward.15', android: 'replay_10' },
  skipForward: { ios: 'goforward.15', android: 'forward_10' },
  timestamp: { ios: 'clock', android: 'schedule' },
  waveform: { ios: 'waveform', android: 'graphic_eq' },
  transcript: { ios: 'text.quote', android: 'subject' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  trash: { ios: 'trash', android: 'delete' },
  edit: { ios: 'pencil', android: 'edit' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  bell: { ios: 'bell', android: 'notifications' },
  person: { ios: 'person.crop.circle', android: 'account_circle' },
  lock: { ios: 'lock', android: 'lock' },
  cloud: { ios: 'icloud', android: 'cloud' },
  tag: { ios: 'tag', android: 'sell' },
  textSize: { ios: 'textformat.size', android: 'format_size' },
  list: { ios: 'list.bullet', android: 'format_list_bulleted' },
  plan: { ios: 'calendar.badge.checkmark', android: 'event_available' },
  action: { ios: 'checklist', android: 'checklist' },
  export: { ios: 'square.and.arrow.up.on.square', android: 'ios_share' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

/** Decorative icon (hidden from screen readers; label the surrounding control instead). */
export function Icon({ name, size = 22, color, style }: IconProps) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? colors.text}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
