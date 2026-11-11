/**
 * "Verse of the Day" home-screen / lock-screen widget (iOS, expo-widgets + SwiftUI).
 *
 * Widget components run in an isolated runtime: no hooks, no imports inside the function, and no
 * references to module-level values — colours and sizes are written inline on purpose.
 * The app feeds it a 14-day timeline from `syncVerseWidget()` (src/features/widgets).
 */
import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  kerning,
  lineLimit,
  minimumScaleFactor,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface VerseWidgetProps {
  reference: string;
  text: string;
  translation: string;
  /** Deep link opened when the widget is tapped, e.g. "faithscroll:///bible/read/19/23?verse=1". */
  url: string;
}

const VerseOfTheDay = (props: VerseWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const isDark = environment.colorScheme === 'dark';
  const family = environment.widgetFamily ?? 'systemMedium';
  const ink = isDark ? '#ECE8DF' : '#242923';
  const muted = isDark ? '#AEB2A6' : '#5E6057';
  const accent = isDark ? '#C9A970' : '#8A6A35';

  if (family === 'accessoryRectangular' || family === 'accessoryInline') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[containerBackground('clear', 'widget'), widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{props.reference}</Text>
        <Text modifiers={[font({ size: 12, design: 'serif' }), lineLimit(2)]}>{props.text}</Text>
      </VStack>
    );
  }

  const isSmall = family === 'systemSmall';
  return (
    <VStack
      alignment="leading"
      spacing={isSmall ? 4 : 6}
      modifiers={[
        containerBackground(isDark ? '#111914' : '#F6F3EC', 'widget'),
        widgetURL(props.url),
        padding({ top: 2, bottom: 2 }),
      ]}>
      <Text modifiers={[font({ size: 10, weight: 'semibold' }), kerning(0.8), foregroundStyle(accent)]}>VERSE OF THE DAY</Text>
      <Text
        modifiers={[
          font({ size: isSmall ? 14 : 16, design: 'serif' }),
          foregroundStyle(ink),
          lineLimit(isSmall ? 5 : 4),
          minimumScaleFactor(0.75),
        ]}>
        {props.text}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(muted), lineLimit(1)]}>
        {isSmall ? props.reference : `${props.reference} · ${props.translation}`}
      </Text>
    </VStack>
  );
};

export const verseOfTheDayWidget = createWidget<VerseWidgetProps>('VerseOfTheDay', VerseOfTheDay, {
  reference: 'Psalm 23:1',
  text: 'Yahweh is my shepherd; I shall lack nothing.',
  translation: 'WEB',
  url: 'faithscroll:///',
});

export default verseOfTheDayWidget;
