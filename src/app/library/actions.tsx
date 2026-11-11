import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { ActionItemEditor } from '@/components/library/action-item-editor';
import { ActionItemRowView } from '@/components/library/action-item-row';
import { Chip, Divider, EmptyState, ErrorState, FaithButton, FaithText, LoadingState, Screen } from '@/components/ui';
import type { ActionFilter, ActionItemRow } from '@/features/library/action-items';
import { useActionItemActions } from '@/features/library/use-action-item-actions';
import { useActionItems } from '@/features/library/use-library';
import { GUTTER } from '@/theme';

type EditorState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; item: ActionItemRow };

const EMPTY: Record<ActionFilter, { title: string; message: string }> = {
  open: {
    title: 'Nothing on your list',
    message: 'Actions you choose from sermons, recaps and reflections appear here. You can also add your own.',
  },
  completed: { title: 'No completed actions yet', message: 'Actions you mark as done are kept here.' },
};

export default function ActionItemsScreen() {
  const [filter, setFilter] = useState<ActionFilter>('open');
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const { data, error } = useActionItems(filter);
  const actions = useActionItemActions();
  const editing = editor.mode === 'edit' ? editor.item : null;

  const closeEditor = () => {
    actions.clearMessage();
    setEditor({ mode: 'closed' });
  };

  const confirmDelete = (item: ActionItemRow) => {
    Alert.alert('Delete this action?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setEditor({ mode: 'closed' });
          void actions.remove(item);
        },
      },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.filters} accessibilityRole="tablist">
        <Chip label="Open" isSelected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="Completed" isSelected={filter === 'completed'} onPress={() => setFilter('completed')} />
      </View>
      <FaithButton label="Add action" icon="add" variant="secondary" onPress={() => setEditor({ mode: 'new' })} />
      {actions.message && editor.mode === 'closed' ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {actions.message}
        </FaithText>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Action items' }} />
      {error ? (
        <ErrorState message="We couldn’t load your action items. Please try again later." />
      ) : !data ? (
        <LoadingState label="Loading action items" />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="action" title={EMPTY[filter].title} message={EMPTY[filter].message} />}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <ActionItemRowView
              item={item}
              source={data.sources.get(item.id)}
              onToggle={() => void actions.toggleComplete(item)}
              onEdit={() => setEditor({ mode: 'edit', item })}
            />
          )}
        />
      )}
      {editor.mode !== 'closed' ? (
        <ActionItemEditor
          item={editing}
          isBusy={actions.isBusy}
          error={actions.message}
          onClose={closeEditor}
          onDelete={editing ? () => confirmDelete(editing) : undefined}
          onSave={(draft) =>
            void actions.save(editing, draft).then((saved) => {
              if (saved) setEditor({ mode: 'closed' });
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 12, paddingTop: 12, paddingBottom: 8 },
  filters: { flexDirection: 'row', gap: 8 },
});
