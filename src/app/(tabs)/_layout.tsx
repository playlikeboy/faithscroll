import { NativeTabs } from 'expo-router/native-tabs';

import { ICONS } from '@/components/ui';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs tintColor={colors.primaryText} backgroundColor={colors.background} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.today.ios} md={ICONS.today.android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bible">
        <NativeTabs.Trigger.Label>Bible</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.bible.ios} md={ICONS.bible.android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sermons">
        <NativeTabs.Trigger.Label>Sermons</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.sermons.ios} md={ICONS.sermons.android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.journal.ios} md={ICONS.journal.android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.library.ios} md={ICONS.library.android} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
