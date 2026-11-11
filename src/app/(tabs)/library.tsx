import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LibraryRow } from '@/components/library/library-row';
import { SearchEntry } from '@/components/library/search-entry';
import { Card, Divider, ErrorState, Screen, Section, type IconName } from '@/components/ui';
import type { LibraryCounts } from '@/features/library/counts';
import { useLibraryCounts } from '@/features/library/use-library';

interface Entry {
  icon: IconName;
  title: string;
  href: string;
  countKey: keyof LibraryCounts;
  countLabel: string;
}

const SCRIPTURE: readonly Entry[] = [
  { icon: 'bookmark', title: 'Saved verses', href: '/library/saved', countKey: 'savedVerses', countLabel: 'saved' },
  { icon: 'highlight', title: 'Highlights', href: '/library/highlights', countKey: 'highlights', countLabel: 'highlighted verses' },
  { icon: 'note', title: 'Bible notes', href: '/library/notes', countKey: 'notes', countLabel: 'notes' },
  { icon: 'plan', title: 'Reading plans', href: '/plans', countKey: 'plans', countLabel: 'started' },
];

const SERMONS: readonly Entry[] = [
  { icon: 'sermons', title: 'Sermons', href: '/sermons', countKey: 'sermons', countLabel: 'sermons' },
  { icon: 'list', title: 'Series', href: '/sermons/series', countKey: 'series', countLabel: 'series' },
];

const REFLECTION: readonly Entry[] = [
  { icon: 'journal', title: 'Journal', href: '/journal', countKey: 'journal', countLabel: 'entries' },
  { icon: 'prayer', title: 'Prayers', href: '/prayers', countKey: 'prayers', countLabel: 'prayers' },
  { icon: 'action', title: 'Action items', href: '/library/actions', countKey: 'openActions', countLabel: 'open' },
  { icon: 'collection', title: 'Collections', href: '/library/collections', countKey: 'collections', countLabel: 'collections' },
];

function EntryGroup({ entries, counts }: { entries: readonly Entry[]; counts: LibraryCounts | undefined }) {
  return (
    <Card>
      {entries.map((entry, index) => (
        <View key={entry.href}>
          {index > 0 ? <Divider /> : null}
          <LibraryRow
            icon={entry.icon}
            title={entry.title}
            count={counts?.[entry.countKey]}
            countLabel={entry.countLabel}
            onPress={() => router.push(entry.href as Href)}
          />
        </View>
      ))}
    </Card>
  );
}

export default function LibraryScreen() {
  const { data: counts, error } = useLibraryCounts();

  return (
    <Screen title="Library">
      <SearchEntry onPress={() => router.push('/search' as Href)} />
      {error ? <ErrorState message="We couldn’t load your library counts. Your notes are safe on this device." /> : null}
      <View style={styles.sections}>
        <Section title="Scripture">
          <EntryGroup entries={SCRIPTURE} counts={counts} />
        </Section>
        <Section title="Sermons">
          <EntryGroup entries={SERMONS} counts={counts} />
        </Section>
        <Section title="Reflection">
          <EntryGroup entries={REFLECTION} counts={counts} />
        </Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { paddingBottom: 24 },
});
