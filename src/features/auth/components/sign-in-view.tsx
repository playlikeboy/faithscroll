import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Divider, FaithButton, FaithText, TextField } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { isAppleSignInAvailable } from '../apple';
import { NOT_CONFIGURED_MESSAGE } from '../errors';
import { useSignInFlow, type SignInFlow } from '../use-sign-in-flow';

export interface SignInViewProps {
  isConfigured: boolean;
  onSignedIn: () => void;
}

function useAppleAvailability(enabled: boolean): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void isAppleSignInAvailable().then((value) => {
      if (active) setAvailable(value);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return available;
}

function AppleButton({ flow }: { flow: SignInFlow }) {
  const { scheme } = useTheme();
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={14}
      style={styles.appleButton}
      onPress={() => {
        if (!flow.busy) void flow.continueWithApple();
      }}
    />
  );
}

function EmailStep({ flow }: { flow: SignInFlow }) {
  return (
    <View style={styles.group}>
      <TextField
        label="Email"
        value={flow.email}
        onChangeText={flow.setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void flow.sendCode()}
        editable={flow.busy === null}
      />
      <FaithButton
        label="Email me a sign-in code"
        variant="secondary"
        icon="lock"
        onPress={() => void flow.sendCode()}
        isLoading={flow.busy === 'send'}
        isDisabled={flow.busy !== null}
        fullWidth
      />
    </View>
  );
}

function CodeStep({ flow }: { flow: SignInFlow }) {
  return (
    <View style={styles.group}>
      {flow.notice ? (
        <FaithText variant="secondary" accessibilityLiveRegion="polite">
          {flow.notice}
        </FaithText>
      ) : null}
      <TextField
        label="Sign-in code"
        value={flow.code}
        onChangeText={flow.setCode}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        returnKeyType="done"
        onSubmitEditing={() => void flow.verifyCode()}
        editable={flow.busy === null}
      />
      <FaithButton
        label="Verify and sign in"
        onPress={() => void flow.verifyCode()}
        isLoading={flow.busy === 'verify'}
        isDisabled={flow.busy !== null}
        fullWidth
      />
      <View style={styles.row}>
        <FaithButton label="Send a new code" variant="ghost" onPress={() => void flow.sendCode()} isDisabled={flow.busy !== null} />
        <FaithButton label="Use a different email" variant="ghost" onPress={flow.changeEmail} isDisabled={flow.busy !== null} />
      </View>
    </View>
  );
}

export function SignInView({ isConfigured, onSignedIn }: SignInViewProps) {
  const flow = useSignInFlow(onSignedIn);
  const appleAvailable = useAppleAvailability(isConfigured);

  if (!isConfigured) {
    return (
      <Card tone="muted">
        <FaithText variant="heading">Accounts aren&apos;t available yet</FaithText>
        <FaithText variant="secondary" style={styles.paragraph}>
          {NOT_CONFIGURED_MESSAGE}
        </FaithText>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <FaithText variant="bodySerif">
        An account is optional. It lets you back up and sync your notes across devices with Faithscroll Plus and use
        AI study tools. Reading, journaling, prayer and sermon notes all work without one.
      </FaithText>

      {appleAvailable && flow.step === 'email' ? (
        <>
          <AppleButton flow={flow} />
          <View style={styles.dividerRow} accessible={false}>
            <View style={styles.dividerLine}>
              <Divider />
            </View>
            <FaithText variant="caption">or</FaithText>
            <View style={styles.dividerLine}>
              <Divider />
            </View>
          </View>
        </>
      ) : null}

      {flow.step === 'email' ? <EmailStep flow={flow} /> : <CodeStep flow={flow} />}

      {flow.error ? (
        <FaithText variant="secondary" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {flow.error}
        </FaithText>
      ) : null}

      <FaithText variant="caption">
        We only use your email to sign you in. Your journal, prayers and notes stay private to you.
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingTop: 8 },
  group: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  paragraph: { marginTop: 6 },
  appleButton: { height: MIN_TOUCH_TARGET + 6, width: '100%' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1 },
});
