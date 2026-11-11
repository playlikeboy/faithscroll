import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchField } from '@/components/journal/search-field';
import { Divider, EmptyState, ErrorState, FaithText, ListRow, LoadingState } from '@/components/ui';
import { db } from '@/db/client';
import { useDebouncedValue } from '@/features/journal/use-debounced-value';
import { useLiveData } from '@/features/journal/use-live-data';
import { CONNECTION_TABLES } from '@/features/links/connections';
import {
  parseLinkPickerParams,
  releaseLinkRequest,
  resolveLinkRequest,
  retainLinkRequest,
} from '@/features/links/link-picker-registry';
import { LINK_TYPE_ICONS, type ResolvedEntity } from '@/features/links/resolve';
import { searchLinkables, type LinkSearchSection } from '@/features/links/search';
import { GUTTER, MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface LinkPickerScreenProps {
  params: Record<string, string | string[] | undefined>;
}

/** Modal search across sermons, journal entries, prayers and action items. */
export function LinkPickerScreen({ params }: LinkPickerScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [request] = useState(() => parseLinkPickerParams(params));
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const requestId = request?.requestId ?? null;

  // Dismissing the modal (swipe, Cancel, back) settles the request with null.
  useEffect(() => {
    if (!requestId) return undefined;
    retainLinkRequest(requestId);
    return () => releaseLinkRequest(requestId);
  }, [requestId]);

  const { data: sections, error, reload } = useLiveData<LinkSearchSection[]>(
    () => (request ? searchLinkables(db, { query: debouncedQuery, types: request.types, exclude: request.exclude }) : []),
    CONNECTION_TABLES,
    debouncedQuery,
  );

  const cancelButton = () => (
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => router.back()} hitSlop={8} style={styles.headerButton}>
      <FaithText variant="body" style={{ color: colors.primaryText }}>
        Cancel
      </FaithText>
    </Pressable>
  );

  if (!request) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Link', headerLeft: cancelButton }} />
        <ErrorState title="Nothing to link" message="Please go back and try again." />
      </SafeAreaView>
    );
  }

  const choose = (item: ResolvedEntity) => {
    resolveLinkRequest(request.requestId, { type: item.type, id: item.id, title: item.title });
    router.back();
  };

  const empty = error ? (
    <ErrorState message="We couldn't search your library. Please try again." onRetry={reload} />
  ) : sections === undefined ? (
    <LoadingState label="Searching" />
  ) : debouncedQuery ? (
    <EmptyState icon="search" title="No matches" message="Try another word." />
  ) : (
    <EmptyState icon="related" title="Nothing to link yet" message="Sermons, journal entries, prayers and action items you create will appear here." />
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: request.title, headerLeft: cancelButton }} />
      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search to link" autoFocus />
      </View>
      <SectionList<ResolvedEntity, LinkSearchSection>
        sections={sections ?? []}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <FaithText variant="label" accessibilityRole="header">
              {section.title}
            </FaithText>
          </View>
        )}
        renderItem={({ item }) => (
          <ListRow
            icon={LINK_TYPE_ICONS[item.type]}
            title={item.title}
            subtitle={item.subtitle ?? undefined}
            onPress={() => choose(item)}
            showChevron={false}
            accessibilityHint="Links this item"
          />
        )}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 32 },
  sectionHeader: { paddingTop: 18, paddingBottom: 6 },
  headerButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
});
