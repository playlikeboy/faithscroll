import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Chip, FaithText } from '@/components/ui';
import { normalizeTagName, type Tag, type TagWithCount } from '@/features/tags/repository';
import { MIN_TOUCH_TARGET, useThemedStyles, type Theme } from '@/theme';

export interface TagEditorProps {
  tags: readonly Pick<Tag, 'id' | 'name'>[];
  /** Existing library tags offered as one-tap suggestions. */
  suggestions?: readonly TagWithCount[];
  onAdd: (name: string) => void;
  onRemove: (tagId: string) => void;
}

const MAX_SUGGESTIONS = 6;

export function TagEditor({ tags, suggestions = [], onAdd, onRemove }: TagEditorProps) {
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState('');

  const assigned = new Set(tags.map((tag) => tag.name.toLowerCase()));
  const query = normalizeTagName(text).toLowerCase();
  const offered = suggestions
    .filter((tag) => !assigned.has(tag.name.toLowerCase()) && (!query || tag.name.toLowerCase().includes(query)))
    .slice(0, MAX_SUGGESTIONS);

  const submit = () => {
    const name = normalizeTagName(text);
    if (!name) return;
    onAdd(name);
    setText('');
  };

  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Tags
      </FaithText>
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              icon="close"
              label={`#${tag.name}`}
              onPress={() => onRemove(tag.id)}
              accessibilityHint={`Removes the tag ${tag.name}`}
            />
          ))}
        </View>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="Add a tag"
        accessibilityLabel="Add a tag"
        accessibilityHint="Type a tag and press return"
        returnKeyType="done"
        submitBehavior="submit"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={60}
        style={styles.input}
        placeholderTextColor={styles.placeholder.color}
      />
      {offered.length > 0 ? (
        <View style={styles.chips}>
          {offered.map((tag) => (
            <Chip
              key={tag.id}
              icon="add"
              label={tag.name}
              onPress={() => {
                onAdd(tag.name);
                setText('');
              }}
              accessibilityHint={`Adds the tag ${tag.name}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors, radii, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    container: { gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    input: {
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: fonts.sans,
      fontSize: fontSizes.body,
    },
    placeholder: { color: colors.textTertiary },
  });
