/** Edit one recap section as plain fields (add / remove items where that makes sense). */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaithButton, FaithText, IconButton, TextField } from '@/components/ui';
import { EDIT_SPECS, emptyDraftItem, fromDraft, toDraft, type DraftItem } from '@/features/recap/edit';
import { RECAP_SECTIONS, type RecapSectionKey, type SermonRecap } from '@/features/recap/schema';
import { GUTTER, useTheme } from '@/theme';

export interface RecapSectionEditorProps {
  sectionKey: RecapSectionKey;
  recap: SermonRecap;
  onSave: (next: SermonRecap) => void;
  onClose: () => void;
}

export function RecapSectionEditor({ sectionKey, recap, onSave, onClose }: RecapSectionEditorProps) {
  const { colors } = useTheme();
  const spec = EDIT_SPECS[sectionKey];
  const title = RECAP_SECTIONS.find((section) => section.key === sectionKey)?.title ?? 'Section';
  const [items, setItems] = useState<DraftItem[]>(() => toDraft(recap, sectionKey));
  const isList = sectionKey !== 'summary';

  const setValue = (id: string, name: string, value: string) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, values: { ...item.values, [name]: value } } : item)));
  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <FaithButton label="Cancel" variant="ghost" onPress={onClose} />
          <FaithText variant="heading" accessibilityRole="header">{`Edit ${title}`}</FaithText>
          <FaithButton label="Save" variant="ghost" onPress={() => onSave(fromDraft(recap, sectionKey, items))} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {items.map((item, index) => (
            <View key={item.id} style={[styles.item, isList && { borderBottomColor: colors.border }, isList && styles.itemDivider]}>
              {spec.editable ? (
                spec.fields.map((field) => (
                  <TextField
                    key={field.name}
                    label={isList ? `${field.label} ${index + 1}` : field.label}
                    value={item.values[field.name] ?? ''}
                    onChangeText={(value) => setValue(item.id, field.name, value)}
                    multiline={field.multiline}
                  />
                ))
              ) : (
                <FaithText variant="body">{item.values[spec.fields[0].name]}</FaithText>
              )}
              {isList ? (
                <IconButton icon="trash" accessibilityLabel={`Remove item ${index + 1}`} onPress={() => removeItem(item.id)} color={colors.danger} />
              ) : null}
            </View>
          ))}
          {items.length === 0 ? <FaithText variant="secondary">No items.</FaithText> : null}
          {spec.addLabel ? (
            <FaithButton label={spec.addLabel} icon="add" variant="secondary" onPress={() => setItems((current) => [...current, emptyDraftItem(sectionKey)])} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 12 },
  content: { paddingHorizontal: GUTTER, paddingVertical: 16, gap: 16 },
  item: { gap: 10 },
  itemDivider: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
});
