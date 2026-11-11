import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, Icon, LoadingState, TextField } from '@/components/ui';
import { MAX_COLLECTION_TITLE_LENGTH } from '@/features/bible/annotations/collections';
import { useCollectionMembership } from '@/features/bible/hooks/use-collection-membership';
import type { CollectionWithCount } from '@/features/bible/hooks/use-collections';
import { rangeLabel } from '@/features/bible/reader/format';
import type { CollectionTarget } from '@/features/bible/reader/params';
import { GUTTER, MIN_TOUCH_TARGET, useTheme } from '@/theme';

function CollectionRow({
  collection,
  isChecked,
  onToggle,
}: {
  collection: CollectionWithCount;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const count = `${collection.itemCount} ${collection.itemCount === 1 ? 'item' : 'items'}`;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${collection.title}, ${count}`}
      accessibilityState={{ checked: isChecked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && styles.pressed]}>
      <View style={[styles.check, { borderColor: isChecked ? colors.primary : colors.border, backgroundColor: isChecked ? colors.primary : 'transparent' }]}>
        {isChecked ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
      </View>
      <View style={styles.rowText}>
        <FaithText variant="body">{collection.title}</FaithText>
        <FaithText variant="secondary">{count}</FaithText>
      </View>
    </Pressable>
  );
}

/** Pick or create collections for a verse range (saved verse) or any linkable item. */
export function CollectionsPicker({ target }: { target: CollectionTarget }) {
  const { colors } = useTheme();
  const { collections, isLoading, memberIds, toggle, create, errorMessage } = useCollectionMembership(target);
  const [newTitle, setNewTitle] = useState('');
  const subject = target.kind === 'range' ? rangeLabel(target.range) : null;

  const handleCreate = () => {
    if (create(newTitle)) setNewTitle('');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Add to collection' }} />
      {subject ? (
        <FaithText variant="secondary">{`Choose collections for ${subject}. Adding a passage also bookmarks it.`}</FaithText>
      ) : null}

      <View style={styles.create}>
        <TextField
          label="New collection"
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="e.g. Verses for hard days"
          maxLength={MAX_COLLECTION_TITLE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <FaithButton label="Create and add" icon="add" variant="secondary" isDisabled={!newTitle.trim()} onPress={handleCreate} />
      </View>

      {errorMessage ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {errorMessage}
        </FaithText>
      ) : null}

      {isLoading ? <LoadingState label="Loading collections" /> : null}
      {!isLoading && collections.length === 0 ? (
        <FaithText variant="secondary">You don’t have any collections yet. Create one above.</FaithText>
      ) : null}
      <View accessibilityLabel="Your collections">
        {collections.map((collection) => (
          <CollectionRow
            key={collection.id}
            collection={collection}
            isChecked={memberIds.has(collection.id)}
            onToggle={() => toggle(collection.id)}
          />
        ))}
      </View>

      <FaithButton label="Done" onPress={() => (router.canGoBack() ? router.back() : undefined)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 48, gap: 16 },
  create: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET + 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
});
