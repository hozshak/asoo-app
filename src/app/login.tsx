// Anmelden und Registrieren – wie in der Web-App: die 3D-Räume blenden langsam im Hintergrund über, davor eine
// Glaskarte mit Logo und Farbverlauf-Knopf. Regeln: ab 16, Zustimmung zu Regeln und Datenschutz.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { api, errText, saveToken, BASE } from '@/lib/api';
import { bootstrap } from '@/lib/store';
import { connect } from '@/lib/live';
import { Btn, Glass, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { C, F, R } from '@/lib/theme';

const LEGAL = (p: string) => (BASE || 'https://zuno-app.altraex.workers.dev') + '/legal/' + p + '.html';
const ROOMS = [require('../../assets/rooms/lounge.webp'), require('../../assets/rooms/beach.webp'), require('../../assets/rooms/wedding.webp'), require('../../assets/rooms/orbit.webp'), require('../../assets/rooms/theater.webp'), require('../../assets/rooms/gaming.webp')];

/** Zwei Bilder, die abwechselnd ein- und ausblenden (wie der Hintergrund der Anmeldeseite im Web). */
function RoomBackdrop() {
  const [i, setI] = useState(0);
  const top = useSharedValue(1);
  useEffect(() => {
    const t = setInterval(() => {
      top.value = withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) });
      setTimeout(() => { setI((x) => (x + 1) % ROOMS.length); top.value = 1; }, 1450);
    }, 6500);
    return () => clearInterval(t);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: top.value }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={ROOMS[(i + 1) % ROOMS.length]} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, a]}><Image source={ROOMS[i]} style={StyleSheet.absoluteFill} contentFit="cover" /></Animated.View>
      <LinearGradient colors={['rgba(7,7,13,0.35)', 'rgba(7,7,13,0.72)', 'rgba(7,7,13,0.96)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [display, setDisplay] = useState('');
  const [age, setAge] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const body = mode === 'login' ? { username: username.trim(), password } : { username: username.trim().toLowerCase(), password, display: display.trim() || username.trim(), age16: age, accept, lang: 'de' };
      const d = await api<{ token?: string }>('POST', mode === 'login' ? '/api/auth/login' : '/api/auth/register', body);
      if (!d.token) throw new Error('kein Schlüssel');
      await saveToken(d.token);
      await bootstrap();
      connect();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const field = (key: string, props: any) => (
    <TextInput {...props} onFocus={() => setFocus(key)} onBlur={() => setFocus('')} placeholderTextColor={C.faint}
      style={[s.input, focus === key && s.inputFocus]} />
  );
  const Check = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(!on)} style={s.check}>
      <View style={[s.box, on && s.boxOn]}>{on ? <Icon name="check" size={14} color="#fff" stroke={3} /> : null}</View>
      <T style={s.checkText}>{children}</T>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <RoomBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={s.logoGlow}><Logo size={72} /></View>
              <T style={s.brand}>Asoo</T>
              <T style={s.tag}>Chatten, reden und in 3D-Räumen abhängen.</T>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(150).duration(500)}>
              <Glass style={s.card} intensity={40} tint="rgba(19,20,32,0.78)">
                <View style={s.tabs}>
                  {(['login', 'register'] as const).map((m) => (
                    <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => { setMode(m); setErr(''); }} style={[s.tab, mode === m && s.tabOn]}>
                      <T style={[s.tabText, mode === m && { color: C.text }]}>{m === 'login' ? 'Anmelden' : 'Registrieren'}</T>
                    </Pressable>
                  ))}
                </View>
                <T style={s.label}>Benutzername</T>
                {field('u', { value: username, onChangeText: setUsername, autoCapitalize: 'none', autoCorrect: false, textContentType: 'username', autoComplete: 'username', placeholder: 'dein.name' })}
                {mode === 'register' ? <>
                  <T style={s.label}>Anzeigename</T>
                  {field('d', { value: display, onChangeText: setDisplay, placeholder: 'So sehen dich andere', maxLength: 32 })}
                </> : null}
                <T style={s.label}>Passwort</T>
                {field('p', { value: password, onChangeText: setPassword, secureTextEntry: true, textContentType: mode === 'login' ? 'password' : 'newPassword', autoComplete: mode === 'login' ? 'password' : 'new-password', placeholder: mode === 'login' ? '••••••••' : 'mindestens 8 Zeichen', onSubmitEditing: submit })}
                {mode === 'register' ? <>
                  <Check on={age} set={setAge}>Ich bin mindestens 16 Jahre alt.</Check>
                  <Check on={accept} set={setAccept}>Ich stimme den <T style={s.link} onPress={() => WebBrowser.openBrowserAsync(LEGAL('regeln'))}>Regeln</T> und der <T style={s.link} onPress={() => WebBrowser.openBrowserAsync(LEGAL('datenschutz'))}>Datenschutzerklärung</T> zu.</Check>
                </> : null}
                {err ? <View style={s.err}><Icon name="ban" size={16} color={C.danger} /><T style={{ color: C.danger, flex: 1 }}>{err}</T></View> : null}
                <Btn title={mode === 'login' ? 'Anmelden' : 'Konto erstellen'} onPress={submit} busy={busy} disabled={!username || !password || (mode === 'register' && (!age || !accept))} style={{ marginTop: 20 }} />
              </Glass>
            </Animated.View>
            <View style={s.legal}>
              <T style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(LEGAL('impressum'))}>Impressum</T>
              <T style={s.legalDot}>·</T>
              <T style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(LEGAL('datenschutz'))}>Datenschutz</T>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 36, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  logoGlow: { shadowColor: '#a060ff', shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, borderRadius: 20 },
  brand: { fontSize: 34, fontWeight: '800', marginTop: 12, letterSpacing: -0.5 },
  tag: { color: C.text2, marginTop: 2, textAlign: 'center' },
  card: { borderRadius: 24, padding: 20 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 14, padding: 4, marginBottom: 8 },
  tab: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line },
  tabText: { color: C.muted, fontWeight: '700' },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, height: 50, fontSize: 16, fontFamily: F.medium },
  inputFocus: { borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 8 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  checkText: { color: C.text2, flex: 1, lineHeight: 22 },
  link: { color: C.info, fontWeight: '700' },
  err: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,77,94,0.1)' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 },
  legalLink: { color: C.muted, fontSize: 13 },
  legalDot: { color: C.faint },
});
