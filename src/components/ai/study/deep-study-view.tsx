/** Renders a validated Deep Study as collapsible editorial sections inside an AI card. */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import { visibleSections, type DeepStudy, type DeepStudySectionKey, type StudyMode } from '@/features/study-ai/schema';

import { AiLabel } from '../ai-label';
import { ReferenceChip } from './reference-chip';
import { StudyDisclaimer } from './study-disclaimer';
import { StudySection } from './study-section';

export interface DeepStudyViewProps {
  study: DeepStudy;
  mode: StudyMode;
  droppedReferences: number;
}

function Items({ rows }: { rows: { key: string; title: string; body: string }[] }) {
  return (
    <View style={styles.items}>
      {rows.map((row) => (
        <View key={row.key} style={styles.itemRow}>
          <FaithText variant="heading">{row.title}</FaithText>
          <FaithText variant="body">{row.body}</FaithText>
        </View>
      ))}
    </View>
  );
}

function sectionContent(study: DeepStudy, key: DeepStudySectionKey): { kind: 'text' | 'interpretation' | null; sources: DeepStudy['overview']['sources']; body: ReactNode } {
  switch (key) {
    case 'key_words':
      return {
        kind: study.key_words.kind,
        sources: study.key_words.sources,
        body: <Items rows={study.key_words.items.map((item, i) => ({ key: `${i}`, title: item.term, body: item.explanation }))} />,
      };
    case 'original_language': {
      const section = study.original_language;
      if (!section) return { kind: null, sources: [], body: null };
      return {
        kind: section.kind,
        sources: section.sources,
        body: (
          <Items
            rows={section.items.map((item, i) => ({ key: `${i}`, title: `${item.term} — ${item.original} (${item.transliteration}, ${item.language})`, body: item.gloss }))}
          />
        ),
      };
    }
    case 'related_scripture':
      return {
        kind: study.related_scripture.kind,
        sources: study.related_scripture.sources,
        body: (
          <View style={styles.items}>
            {study.related_scripture.items.map((item, i) => (
              <View key={`${i}-${item.reference}`} style={styles.itemRow}>
                <ReferenceChip reference={item.reference} />
                <FaithText variant="body">{item.connection}</FaithText>
              </View>
            ))}
          </View>
        ),
      };
    case 'theological_significance': {
      const section = study.theological_significance;
      if (!section) return { kind: null, sources: [], body: null };
      return {
        kind: section.kind,
        sources: section.sources,
        body: (
          <>
            <FaithText variant="body">{section.body}</FaithText>
            <Items rows={section.perspectives.map((p, i) => ({ key: `${i}`, title: p.tradition, body: p.view }))} />
          </>
        ),
      };
    }
    case 'reflection_questions':
      return {
        kind: 'interpretation',
        sources: [],
        body: study.reflection_questions.map((question, i) => (
          <FaithText key={`${i}`} variant="body">{`• ${question}`}</FaithText>
        )),
      };
    default: {
      const section = study[key];
      if (!section) return { kind: null, sources: [], body: null };
      return { kind: section.kind, sources: section.sources, body: <FaithText variant="body">{section.body}</FaithText> };
    }
  }
}

export function DeepStudyView({ study, mode, droppedReferences }: DeepStudyViewProps) {
  const sections = visibleSections(study);
  return (
    <Card tone="ai" style={styles.card}>
      <AiLabel text={mode === 'advanced' ? 'AI-generated · Advanced study' : 'AI-generated · Basic study'} />
      {sections.map(({ key, title }, index) => {
        const content = sectionContent(study, key);
        return (
          <StudySection key={key} title={title} kind={content.kind} sources={content.sources} initiallyExpanded={index < 2}>
            {content.body}
          </StudySection>
        );
      })}
      {mode === 'advanced' && !study.original_language ? (
        <FaithText variant="caption">Original-language notes appear only when verified lexical data is available for this passage.</FaithText>
      ) : null}
      {study.uncertainty_note ? (
        <View style={styles.items}>
          <FaithText variant="label">Uncertain or debated</FaithText>
          <FaithText variant="secondary">{study.uncertainty_note}</FaithText>
        </View>
      ) : null}
      {droppedReferences > 0 ? (
        <FaithText variant="caption">{`${droppedReferences} reference${droppedReferences === 1 ? ' was' : 's were'} left out because ${droppedReferences === 1 ? 'it' : 'they'} couldn’t be verified.`}</FaithText>
      ) : null}
      <StudyDisclaimer />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  items: { gap: 10 },
  itemRow: { gap: 4 },
});
