// Wurzel der App: Schrift laden, Anmeldung prüfen, Daten laden, Live-Verbindung und Push. Ohne Konto → Anmeldeseite.
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';
import { loadToken, saveToken } from '@/lib/api';
import { bootstrap, useStore } from '@/lib/store';
import { connect } from '@/lib/live';
import { registerPush, onPushTap, chatFromUrl } from '@/lib/push';
import { C, F } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [booted, setBooted] = useState(false);
  const [fonts] = useFonts({ Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold });
  const me = useStore((s) => s.me);
  const segs = useSegments();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const tok = await loadToken();
      if (tok) {
        try { const u = await bootstrap(); if (u) connect(); else await saveToken(null); }
        catch { /* offline: mit dem gespeicherten Schlüssel später erneut */ }
      }
      setBooted(true);
    })();
  }, []);
  useEffect(() => { if (booted && fonts) SplashScreen.hideAsync().catch(() => {}); }, [booted, fonts]);
  // ohne Konto immer zur Anmeldung, mit Konto weg von dort
  useEffect(() => {
    if (!booted) return;
    const onAuth = segs[0] === 'login';
    if (!me && !onAuth) router.replace('/login');
    else if (me && onAuth) router.replace('/');
  }, [booted, me, segs]);
  // Push: nach dem Anmelden das Gerät melden; Tippen auf eine Mitteilung öffnet den Chat
  useEffect(() => { if (me) registerPush(); }, [me?.id]);
  useEffect(() => onPushTap((url) => { const ch = chatFromUrl(url); if (ch) router.push({ pathname: '/chat/[id]', params: { id: ch } }); }), []);
  if (!booted || !fonts) return <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg0 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: C.bg1 }, headerShadowVisible: false, headerTintColor: C.text, headerTitleStyle: { fontFamily: F.bold, fontSize: 17 }, contentStyle: { backgroundColor: C.bg0 }, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="user/[id]" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
          {/* Räume: kein Wischen zum Zurückgehen – im 3D-Raum wischt man, um sich umzusehen */}
          <Stack.Screen name="room" options={{ headerShown: false, gestureEnabled: false, animation: 'fade_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
