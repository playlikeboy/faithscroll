import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon, IconButton } from '@/components/ui';
import { spokenDuration } from '@/features/editor';
import { formatDuration } from '@/lib/time';
import { MIN_TOUCH_TARGET, tabularNums, useTheme } from '@/theme';

export interface BookmarkListItem {
  id: string;
  /** Position on the sermon timeline, or null when its recording part is gone. */
  positionMs: number | null;
  note: string | null;
  reference: string | null;
}

export interface BookmarkListProps {
  bookmarks: readonly BookmarkListItem[];
  onPlay: (positionMs: number) => void;
  onDelete: (id: string) => void;
}

function confirmDelete(onConfirm: () => void) {
  Alert.alert('Delete this bookmark?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

/** Timestamp bookmarks; tapping one plays the sermon from that moment. */
export function BookmarkList({ bookmarks, onPlay, onDelete }: BookmarkListProps) {
  const { colors, radii } = useTheme();
  if (bookmarks.length === 0) {
    return <FaithText variant="secondary">Tap Bookmark while recording to mark moments you want to return to.</FaithText>;
  }
  return (
    <View style={styles.list}>
      {bookmarks.map((bookmark) => {
        const { positionMs } = bookmark;
        const time = positionMs === null ? '—' : formatDuration(positionMs);
        const description = [bookmark.note, bookmark.reference].filter(Boolean).join(', ') || 'Bookmark';
        const label = positionMs === null ? description : `${description}, at ${spokenDuration(positionMs)}`;
        return (
          <View key={bookmark.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={positionMs === null ? undefined : 'Plays the sermon from this moment'}
              accessibilityState={{ disabled: positionMs === null }}
              disabled={positionMs === null}
              onPress={() => positionMs !== null && onPlay(positionMs)}
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
              <View style={[styles.time, { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm }]}>
                <Icon name="play" size={12} color={colors.primaryText} />
                <FaithText variant="secondary" weight="600" style={[tabularNums, { color: colors.primaryText }]}>
                  {time}
                </FaithText>
              </View>
              <View style={styles.text}>
                <FaithText variant="body" numberOfLines={3}>
                  {bookmark.note ?? 'Bookmark'}
                </FaithText>
                {bookmark.reference ? (
                  <FaithText variant="caption" style={{ color: colors.primaryText }}>
                    {bookmark.reference}
                  </FaithText>
                ) : null}
              </View>
            </Pressable>
            <IconButton icon="trash" accessibilityLabel={`Delete bookmark at ${time}`} onPress={() => confirmDelete(() => onDelete(bookmark.id))} size={18} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingLeft: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  text: { flex: 1, gap: 2 },
});
