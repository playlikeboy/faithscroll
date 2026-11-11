import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, TextField } from '@/components/ui';

import { SegmentedControl } from './segmented-control';

export type LibraryMode = 'sermons' | 'series';

const MODES = [
  { value: 'sermons', label: 'Sermons' },
  { value: 'series', label: 'Series' },
] as const;

export interface LibraryHeaderProps {
  mode: LibraryMode;
  onChangeMode: (mode: LibraryMode) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  onNewSermon: () => void;
  /** Optional notice (e.g. a recovered recording) shown above the list. */
  notice?: ReactNode;
}

export function LibraryHeader({ mode, onChangeMode, query, onChangeQuery, onNewSermon, notice }: LibraryHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <FaithText variant="label">Your sermon notebook</FaithText>
        <FaithText variant="display" accessibilityRole="header">
          Sermons
        </FaithText>
      </View>
      <FaithButton
        label="New sermon"
        icon="record"
        onPress={onNewSermon}
        accessibilityHint="Add details, then record or save notes"
        fullWidth
      />
      {notice}
      <TextField
        label="Find a sermon"
        value={query}
        onChangeText={onChangeQuery}
        placeholder={mode === 'sermons' ? 'Title, speaker, church, series or passage' : 'Series name, speaker or church'}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <SegmentedControl options={MODES} value={mode} onChange={onChangeMode} accessibilityLabel="Show sermons or series" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 16, paddingTop: 12, paddingBottom: 16 },
  titleBlock: { gap: 4 },
});
