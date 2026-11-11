import { StyleSheet, View } from 'react-native';

import { Chip, FaithText } from '@/components/ui';
import { PRAYER_CATEGORIES } from '@/features/prayers/types';

export interface CategoryPickerProps {
  value: string | null;
  onChange: (category: string | null) => void;
}

/** Optional category; tapping the selected one clears it. Keeps unknown (synced) categories visible. */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const options = value && !PRAYER_CATEGORIES.includes(value) ? [...PRAYER_CATEGORIES, value] : PRAYER_CATEGORIES;
  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Category
      </FaithText>
      <View style={styles.chips}>
        {options.map((category) => (
          <Chip
            key={category}
            label={category}
            isSelected={value === category}
            onPress={() => onChange(value === category ? null : category)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
