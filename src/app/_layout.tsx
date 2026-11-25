// Wurzel der App: Schrift laden, Anmeldung prüfen, Daten laden, Live-Verbindung und Push. Ohne Konto → Anmeldeseite.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';
import { loadToken, saveToken } from '@/lib/api';
import { bootstrap, useStore } from '@/lib/store';
import { connect } from '@/lib/live';
import { registerPush, onPushTap, chatFromUrl, startBadge } from '@/lib/push';
import { C, F } from '@/lib/theme';
import { LANG, onLangChange } from '@/lib/i18n';
import { prewarmWeb } from '@/lib/webhost';
import { loadCallMode } from '@/lib/calls';
import { WebHost } from '@/components/WebHost';
import { GlobalScreenPicker } from '@/components/ScreenPicker';
import { CropHost } from '@/components/CropHost';
import { startTips } from '@/lib/tips';
import { CallBar, IncomingCall } from '@/components/CallBar';
import { MatchParty } from '@/components/MatchBits';
import { UpdateBanner } from '@/components/UpdateBanner';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [booted, setBooted] = useState(false);
  const [fonts] = useFonts({ Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold });
  const me = useStore((s) => s.me);
  // Trinkgeld-Käufe (Apple): Verbindung früh öffnen, damit nachgelieferte Käufe abgeschlossen werden
  useEffect(() => { if (me) startTips(); }, [!!me]);
  // Sprache in der App gewechselt: alles neu aufbauen (Texte, Datum, Web-Ansicht) – man landet auf der Startseite
  const [lang, setLangKey] = useState(LANG);
  useEffect(() => onLangChange(() => setLangKey(LANG)), []);
  const segs = useSegments();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      loadCallMode();
      const tok = await loadToken();
      if (tok) {
        try { const u = await bootstrap(); if (u) connect(); else await saveToken(null); }
        catch { /* offline: mit dem gespeicherten Schlüssel später erneut */ }
      }
      setBooted(true);
    })();
    // Notbremse: Hängt das Laden (schlechtes Netz beim Start aus einer Mitteilung), nicht ewig auf dem Ladebild bleiben
    const t = setTimeout(() => setBooted(true), 12000);
    return () => clearTimeout(t);
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
  // Zahl am App-Symbol aktuell halten (ungelesene Direktnachrichten + Erwähnungen)
  useEffect(() => startBadge(), []);
  // Web-Fenster nach dem Anmelden im Hintergrund vorladen: erste 3D-/Web-Seite ist dann sofort da, Anrufe kommen an
  useEffect(() => { if (!me) return; const t = setTimeout(prewarmWeb, 1500); return () => clearTimeout(t); }, [me?.id]);
  // Tippen auf eine Mitteilung: merken und erst öffnen, wenn alles bereit ist (wichtig, wenn die App ganz zu war)
  const navReady = !!useRootNavigationState()?.key;
  const [pushUrl, setPushUrl] = useState<{ url: string | null } | null>(null);
  useEffect(() => onPushTap((url) => setPushUrl({ url })), []);
  const pushDone = useRef<object | null>(null);
  useEffect(() => {
    if (!pushUrl || pushDone.current === pushUrl || !booted || !fonts || !me || !navReady) return;
    const url = pushUrl.url;
    // einen Takt warten, damit die Startseite steht – dann liegt der Chat darüber und „Zurück“ führt zur Startseite
    const t = setTimeout(() => {
      pushDone.current = pushUrl;
      try {
        const ch = chatFromUrl(url);
        if (ch) router.push({ pathname: '/chat/[id]', params: { id: ch } });
        else if (/^\/match\b/.test(url || '')) router.push(/tab=/.test(url || '') ? '/match-likes' : '/match'); // „Jemand mag dein Mitspieler-Profil“
        else if (/^\/(notifications|activity)\b/.test(url || '')) router.push('/notifications');
      } catch { /* Ziel nicht erreichbar – die App bleibt auf der Startseite */ }
    }, 250);
    return () => clearTimeout(t);
  }, [pushUrl, booted, fonts, me?.id, navReady]);
  if (!booted || !fonts) return <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>;
  return (
    <GestureHandlerRootView key={lang} style={{ flex: 1, backgroundColor: C.bg0 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: C.bg1 }, headerShadowVisible: false, headerTintColor: C.text, headerTitleStyle: { fontFamily: F.bold, fontSize: 17 }, contentStyle: { backgroundColor: C.bg0 }, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="user/[id]" options={{ headerShown: false, presentation: 'modal' }} />
          {/* Einstellungen kommen wie bei Discord von unten; die Unterseiten (?page=…) schieben sich normal von rechts herein */}
          <Stack.Screen name="settings" options={({ route }) => ({ headerShown: false, animation: (route.params as any)?.page ? 'default' : 'slide_from_bottom' })} />
          <Stack.Screen name="friends" options={{ headerShown: false }} />
          <Stack.Screen name="members" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="me" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="feed" options={{ headerShown: false }} />
          <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
          {/* Blätter von unten (nativ statt Web-Dialog) */}
          <Stack.Screen name="server-new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="server-invite" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="admin" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="server-settings" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="channel-new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="group-new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="invite/[code]" options={{ headerShown: false, presentation: 'modal' }} />
          {/* Räume: kein Wischen zum Zurückgehen – im 3D-Raum wischt man, um sich umzusehen */}
          <Stack.Screen name="room" options={{ headerShown: false, animation: 'none' }} />
          {/* Anruf/Sprachraum in der App: kommt von unten; zurück = verkleinern (der Anruf läuft weiter) */}
          <Stack.Screen name="call" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          {/* „Mitspieler finden“: Karten-Stapel (kein Wischen zum Zurückgehen – dort wischt man die Karten), Listen, Gamer-Profil */}
          <Stack.Screen name="match" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="match-likes" options={{ headerShown: false }} />
          <Stack.Screen name="match-profile" options={{ headerShown: false }} />
        </Stack>
        {/* dauerhaftes Web-Fenster (3D, Anrufe, Feed …), darüber Anruf-Leiste und eingehende Anrufe */}
        {me ? <WebHost /> : null}
        {/* der einzige „Übertragung starten“-Knopf (Bildschirm teilen) – muss im sichtbaren Fenster hängen */}
        <GlobalScreenPicker />
        <CropHost />
        {me ? <CallBar /> : null}
        {me ? <IncomingCall /> : null}
        {me ? <MatchParty /> : null} {me ? <UpdateBanner /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
