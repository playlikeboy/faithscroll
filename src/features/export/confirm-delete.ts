import { Alert } from 'react-native';

/**
 * Two-step confirmation before deleting everything on the device. `onConfirmed` runs only after
 * the user explicitly confirms twice; cancelling at either step does nothing.
 */
export function confirmDeleteAllLocalData(onConfirmed: () => void): void {
  Alert.alert(
    'Delete all data on this device?',
    'This removes your journal, prayers, notes, highlights, sermons, recordings and settings from this device and signs you out here. Anything already synced to your account stays in your account.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'This can’t be undone',
            'If you want a copy, export your data first. Delete everything on this device now?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete everything', style: 'destructive', onPress: onConfirmed },
            ],
          ),
      },
    ],
  );
}
