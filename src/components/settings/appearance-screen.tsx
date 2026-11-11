import { StyleSheet, View } from 'react-native';

import { Card, FaithText, Screen } from '@/components/ui';
import { scriptureTextStyle } from '@/features/settings/scripture-size';
import { THEME_CHOICES } from '@/features/settings/summaries';
import { usePreferences } from '@/stores/preferences';
import { useTheme } from '@/theme';

import { ChoiceList } from './choice-list';
import { ScriptureSizeControl } from './scripture-size-control';
import { SettingsGroup } from './settings-group';

/** John 1:1, World English Bible (public domain) — used only as a type sample. */
const PREVIEW_TEXT = 'In the beginning was the Word, and the Word was with God, and the Word was God.';

export function AppearanceScreen() {
  const { colors, fonts } = useTheme();
  const themePreference = usePreferences((s) => s.themePreference);
  const setThemePreference = usePreferences((s) => s.setThemePreference);
  const sizeIndex = usePreferences((s) => s.scriptureSizeIndex);
  const setScriptureSizeIndex = usePreferences((s) => s.setScriptureSizeIndex);
  const preview = scriptureTextStyle(sizeIndex);

  return (
    <Screen edges={[]}>
      <View style={styles.section}>
        <FaithText variant="label" accessibilityRole="header" style={styles.label}>
          Theme
        </FaithText>
        <ChoiceList label="Theme" choices={THEME_CHOICES} selected={themePreference} onSelect={setThemePreference} />
      </View>

      <SettingsGroup title="Scripture text size" footer="Applies to the Bible reader, Verse of the Day and Discover.">
        <View style={styles.sizeBody}>
          <Card tone="muted" style={styles.preview}>
            <View accessible accessibilityLabel={`Preview. John 1:1. ${PREVIEW_TEXT}`}>
              <FaithText variant="scripture" style={preview}>
                <FaithText
                  style={{ color: colors.verseNumber, fontFamily: fonts.serif, fontSize: Math.round(preview.fontSize * 0.6) }}>
                  1{'  '}
                </FaithText>
                {PREVIEW_TEXT}
              </FaithText>
              <FaithText variant="caption" style={styles.citation}>
                John 1:1 · WEB
              </FaithText>
            </View>
          </Card>
          <ScriptureSizeControl sizeIndex={sizeIndex} onChange={setScriptureSizeIndex} />
        </View>
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, gap: 8 },
  label: { marginLeft: 4 },
  sizeBody: { paddingVertical: 16, gap: 12 },
  preview: { padding: 18 },
  citation: { marginTop: 8 },
});
