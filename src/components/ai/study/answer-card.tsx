import { StyleSheet, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import type { AskAnswer } from '@/features/study-ai/schema';

import { AiLabel } from '../ai-label';
import { KindBadge } from './kind-badge';
import { ReferenceChip } from './reference-chip';

export interface AnswerCardProps {
  answer: AskAnswer;
  droppedReferences: number;
}

export function AnswerCard({ answer, droppedReferences }: AnswerCardProps) {
  return (
    <Card tone="ai" style={styles.card}>
      <View style={styles.meta}>
        <AiLabel />
        <KindBadge kind={answer.kind} />
      </View>
      <FaithText variant="body">{answer.answer}</FaithText>
      {answer.citations.length > 0 ? (
        <View style={styles.citations}>
          {answer.citations.map((citation, index) => (
            <ReferenceChip key={`${index}-${citation.reference}`} reference={citation.reference} />
          ))}
        </View>
      ) : null}
      {answer.uncertainty ? <FaithText variant="secondary">{`Uncertain or debated: ${answer.uncertainty}`}</FaithText> : null}
      {answer.suggest_pastor ? (
        <FaithText variant="secondary">For a question like this, it can really help to talk it through with a pastor or church leader you trust.</FaithText>
      ) : null}
      {droppedReferences > 0 ? <FaithText variant="caption">Some references were left out because they couldn’t be verified.</FaithText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
