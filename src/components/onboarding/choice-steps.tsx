import { StyleSheet, View } from 'react-native';

import { ChoiceList } from '@/components/settings/choice-list';
import { FaithText, Icon } from '@/components/ui';
import { READING_GOAL_OPTIONS, STEP_TITLES } from '@/features/onboarding/steps';
import type { ReadingGoal } from '@/stores/preferences';
import { useTheme } from '@/theme';

import { ReminderTimePicker } from './reminder-time-picker';

export interface GoalStepProps {
  goal: ReadingGoal | null;
  onSelect: (goal: ReadingGoal) => void;
}

export function GoalStep({ goal, onSelect }: GoalStepProps) {
  return (
    <View style={styles.stack}>
      <FaithText variant="display" accessibilityRole="header">
        {STEP_TITLES.goal}
      </FaithText>
      <FaithText variant="body" color="textSecondary">
        There&apos;s no wrong answer, and you can change this whenever you like.
      </FaithText>
      <View style={styles.choices}>
        <ChoiceList label="Reading goal" choices={READING_GOAL_OPTIONS} selected={goal} onSelect={onSelect} />
      </View>
    </View>
  );
}

export interface ReminderStepProps {
  time: string;
  onChange: (time: string) => void;
}

export function ReminderStep({ time, onChange }: ReminderStepProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <FaithText variant="display" accessibilityRole="header">
        {STEP_TITLES.reminder}
      </FaithText>
      <FaithText variant="body" color="textSecondary">
        Pick a time that suits your day. We&apos;ll remember it for you.
      </FaithText>
      <ReminderTimePicker value={time} onChange={onChange} />
      <View style={styles.note}>
        <Icon name="bell" size={18} color={colors.textSecondary} />
        <FaithText variant="secondary" style={styles.noteText}>
          Reminders stay off until you turn them on in Settings. We won&apos;t ask for notification permission now.
        </FaithText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  choices: { marginTop: 12 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 },
  noteText: { flex: 1 },
});
