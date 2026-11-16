import { CultureProvider } from '@/features/culture/provider';
import { Colors } from '@/shared/constants';
import { t } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';
import { Text } from '@/shared/ui';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

// Expo Router picks up this named export as the error boundary for the root segment.
// Kept local (not extracted) because it links back to the home tab via `useRouter`.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <AlertCircle size={56} color={Colors.primary} />
      <Text style={styles.title}>{t('error.screenTitle')}</Text>
      <Text style={styles.desc}>{error.message}</Text>
      <Pressable
        style={styles.button}
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel={t('error.retry')}
      >
        <Text style={styles.buttonText}>{t('error.retry')}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.replace('/(culture)')}
        accessibilityRole="button"
        accessibilityLabel={t('notFound.backToHome')}
      >
        <Text style={styles.link}>{t('notFound.backToHome')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // No legacy festival queries, push registration or first-run interruptions.

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ThemeProvider is mounted but dormant: the preference defaults to
          `light`, so the resolved palette matches today's UI exactly. Dark
          mode activates once the `Colors.*` → `useTheme()` migration lands. */}
      <ThemeProvider>
        <SafeAreaProvider>
          <CultureProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              animationDuration: 320,
              gestureEnabled: true,
            }}
          >
            {/* Archived festival routes must not shadow /ara and /mapa or mount the old backend. */}
            <Stack.Protected guard={false}>
              <Stack.Screen name="(tabs)" />
            </Stack.Protected>
          </Stack>
          </CultureProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 14,
    padding: 32,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  desc: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { color: Colors.primary, fontSize: 14, marginTop: 4 },
});
