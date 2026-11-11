/** Sermon page (container): metadata, audio player, bookmarks, notes, AI entries, actions and management. */
import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AudioPlayer } from '@/components/sermons/audio-player';
import { BookmarkList } from '@/components/sermons/bookmark-list';
import { RecordingParts } from '@/components/sermons/recording-parts';
import { RecoveryNotice } from '@/components/sermons/recovery-notice';
import { SermonActionItems } from '@/components/sermons/sermon-action-items';
import { SermonAiEntries } from '@/components/sermons/sermon-ai-entries';
import { SermonHeader } from '@/components/sermons/sermon-header';
import { EmptyState, FaithButton, FaithText, IconButton, Section } from '@/components/ui';
import { db } from '@/db/client';
import { toGlobalMs } from '@/features/audio/timeline';
import { useSermonPlayer } from '@/features/audio/use-sermon-player';
import type { VerseRange } from '@/features/bible/types';
import { toVerseId } from '@/features/bible/verse-id';
import { deleteRecordingAndFile, deleteSermonAndRecordings } from '@/features/recording/delete-recordings';
import { useRecordingRecovery } from '@/features/recording/use-recording-recovery';
import { logger } from '@/lib/logger';
import { GUTTER, useTheme } from '@/theme';

import { deleteBookmark } from './bookmarks-repository';
import { useBookmarks, useRecordings, useSeries, useSermon, useSermonActionItems, useSermonAiStatus } from './hooks';
import { readerHref } from './passage';
import { renameRecording } from './recordings-repository';
import { seriesHref } from './routes';
import { SermonNotesSection } from './sermon-notes-section';
import { useSermonTimeline } from './use-sermon-timeline';

export interface SermonDetailScreenProps {
  sermonId: string;
  /** `?t=` deep link: position to play from. */
  initialPositionMs: number | null;
  /** When set, `initialPositionMs` is inside this recording part instead of on the sermon timeline. */
  initialRecordingId: string | null;
}

export function SermonDetailScreen({ sermonId, initialPositionMs, initialRecordingId }: SermonDetailScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const sermon = useSermon(sermonId);
  const recordings = useRecordings(sermonId);
  const bookmarkRows = useBookmarks(sermonId);
  const aiStatus = useSermonAiStatus(sermonId);
  const actionItems = useSermonActionItems(sermonId);
  const series = useSeries(sermon.data?.seriesId ?? '');
  const recovery = useRecordingRecovery();
  const { timeline, parts, bookmarks } = useSermonTimeline(recordings.data, bookmarkRows.data);
  const player = useSermonPlayer(timeline, { title: sermon.data?.title ?? 'Sermon', artist: sermon.data?.speaker ?? null });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Deep link from the transcript (`?t=`): seek once the audio is known, then play.
  const deepLinkApplied = useRef(false);
  const { seekTo } = player;
  useEffect(() => {
    if (deepLinkApplied.current || initialPositionMs === null || timeline.totalMs === 0) return;
    deepLinkApplied.current = true;
    const target = toGlobalMs(timeline, initialRecordingId, initialPositionMs);
    if (target !== null) void seekTo(target, { play: true });
  }, [initialPositionMs, initialRecordingId, timeline, seekTo]);

  const run = (action: () => void, failure: string) => {
    try {
      setErrorMessage(null);
      action();
    } catch (error) {
      logger.error(failure, error);
      setErrorMessage(`${failure}. Please try again.`);
    }
  };

  if (!sermon.data) {
    return <EmptyState icon="sermons" title="This sermon isn't available" message="It may have been deleted." />;
  }
  const data = sermon.data;
  const hasAudio = timeline.parts.length > 0;

  const openReader = (range: VerseRange) => router.push(readerHref(toVerseId(range.start)));
  const playFrom = (positionMs: number) => void player.seekTo(positionMs, { play: true });
  const record = () => router.push({ pathname: '/sermons/record/[id]', params: { id: sermonId } });
  const reflect = (actionItemId?: string) =>
    router.push({ pathname: '/journal/new', params: { type: 'sermon_reflection', sermonId, ...(actionItemId && { actionItemId }) } });

  const confirmDeleteSermon = () =>
    Alert.alert('Delete this sermon?', 'Its recording, bookmarks, notes, transcript and recap are removed from this device. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(() => {
            player.pause();
            deleteSermonAndRecordings(db, sermonId);
            router.back();
          }, 'We couldn’t delete this sermon'),
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton icon="edit" accessibilityLabel="Edit sermon details" onPress={() => router.push({ pathname: '/sermons/[id]/edit', params: { id: sermonId } })} />
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {recovery.notice ? <RecoveryNotice notice={recovery.notice} onDismiss={recovery.dismiss} /> : null}
        <SermonHeader
          sermon={data}
          seriesTitle={series.data?.title ?? null}
          onOpenSeries={data.seriesId ? () => router.push(seriesHref(data.seriesId as string)) : undefined}
          onOpenPassage={data.mainPassageStartVerseId ? () => router.push(readerHref(data.mainPassageStartVerseId as number)) : undefined}
        />
        {errorMessage ? (
          <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
            {errorMessage}
          </FaithText>
        ) : null}

        <Section title="Recording">
          {hasAudio ? (
            <AudioPlayer
              positionMs={player.positionMs}
              totalMs={player.totalMs}
              isPlaying={player.isPlaying}
              isBuffering={player.isBuffering}
              rate={player.rate}
              partLabel={timeline.parts.length > 1 ? `Part ${player.partIndex + 1} of ${timeline.parts.length}` : null}
              onTogglePlay={player.toggle}
              onSkip={player.skip}
              onSeek={(positionMs) => void player.seekTo(positionMs)}
              onCycleRate={player.cycleRate}
            />
          ) : (
            <FaithText variant="secondary">No recording yet. You can record the sermon or simply keep notes.</FaithText>
          )}
          <FaithButton label={hasAudio ? 'Record more' : 'Record this sermon'} icon="record" variant="secondary" onPress={record} />
        </Section>

        {hasAudio || bookmarks.length > 0 ? (
          <Section title="Bookmarks">
            <BookmarkList bookmarks={bookmarks} onPlay={playFrom} onDelete={(id) => run(() => deleteBookmark(db, id), 'We couldn’t delete that bookmark')} />
          </Section>
        ) : null}

        <Section title="Notes">
          <SermonNotesSection
            sermonId={sermonId}
            getTimestampMs={() => (hasAudio ? player.positionMs : null)}
            onPressTimestamp={playFrom}
            onPressReference={openReader}
          />
        </Section>

        <Section title="Transcript & recap">
          <SermonAiEntries
            transcriptStatus={aiStatus.data.transcriptStatus}
            recapStatus={aiStatus.data.recapStatus}
            hasRecording={hasAudio}
            onOpenTranscript={() => router.push({ pathname: '/sermons/[id]/transcript', params: { id: sermonId } })}
            onOpenRecap={() => router.push(`/sermons/${encodeURIComponent(sermonId)}/recap` as Href)}
          />
        </Section>

        {actionItems.data.length > 0 ? (
          <Section title="Live it out">
            <SermonActionItems items={actionItems.data} onReflect={reflect} />
          </Section>
        ) : null}

        <Section title="Reflect">
          <FaithText variant="secondary">What stayed with you? Write a reflection connected to this sermon.</FaithText>
          <FaithButton label="Start a reflection" icon="reflect" onPress={() => reflect()} />
        </Section>

        {parts.length > 0 ? (
          <Section title="Recording parts">
            <RecordingParts
              parts={parts}
              onRename={(id, title) => run(() => renameRecording(db, id, title), 'We couldn’t rename that part')}
              onDelete={(id) => run(() => deleteRecordingAndFile(db, id), 'We couldn’t delete that part')}
            />
          </Section>
        ) : null}

        <View style={styles.danger}>
          <FaithButton label="Delete sermon" icon="trash" variant="destructive" onPress={confirmDeleteSermon} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 56, gap: 4 },
  danger: { marginTop: 36 },
});
