import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { READING_GOAL_OPTIONS, readingGoalLabel } from '@/features/onboarding/steps';
import type { ReadingGoal } from '@/stores/preferences';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { ChoiceList } from './choice-list';

export interface ReadingGoalRowProps {
  goal: ReadingGoal | null;
  onChange: (goal: ReadingGoal) => void;
}

/** Expandable row to revisit the reading goal chosen during onboarding. */
export function ReadingGoalRow({ goal, onChange }: ReadingGoalRowProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const summary = readingGoalLabel(goal) ?? 'Not set';

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reading goal, ${summary}`}
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((value) => !value)}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="plan" size={20} color={colors.primaryText} />
        <View style={styles.text}>
          <FaithText variant="body">Reading goal</FaithText>
          <FaithText variant="secondary">{summary}</FaithText>
        </View>
        <Icon name="down" size={14} color={colors.textTertiary} style={isExpanded ? styles.rotated : undefined} />
      </Pressable>
      {isExpanded ? (
        <View style={styles.choices}>
          <ChoiceList
            label="Reading goal"
            choices={READING_GOAL_OPTIONS}
            selected={goal}
            onSelect={(value) => {
              onChange(value);
              setIsExpanded(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  rotated: { transform: [{ rotate: '180deg' }] },
  choices: { paddingBottom: 14 },
});
