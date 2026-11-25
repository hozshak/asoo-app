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
import { prepPow, takePow } from '@/lib/pow';
import { saveDevice } from '@/lib/api';
import { bootstrap } from '@/lib/store';
import { connect } from '@/lib/live';
import { Btn, Glass, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { C, F, R } from '@/lib/theme';
import { t, LANG } from '@/lib/i18n';

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
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [display, setDisplay] = useState('');
  const [age, setAge] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [focus, setFocus] = useState('');
  // E-Mail (wie im Web): beim Registrieren Pflicht, sobald der Server Mails schicken kann; „Passwort vergessen“ per Code
  const [mailOn, setMailOn] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { api<{ mail?: boolean }>('GET', '/api/me').then((d) => setMailOn(!!d.mail)).catch(() => {}); }, []);
  // Anmeldung von neuem Gerät/Ort: Server schickt einen Code per E-Mail (verify = Hinweis auf die Adresse)
  const [verify, setVerify] = useState<string | null>(null);
  // Zwei-Faktor: Code aus der Authenticator-App (oder Ersatz-Code)
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfa, setMfa] = useState('');
  const switchMode = (m: typeof mode) => { setMode(m); setErr(''); setInfo(''); setCode(''); setCodeSent(false); setVerify(null); setMfaNeeded(false); setMfa(''); };
  const signedIn = async (d: { token?: string; device?: string }) => {
    if (!d.token) throw new Error('kein Schlüssel');
    if (d.device) await saveDevice(d.device);
    await saveToken(d.token);
    await bootstrap();
    connect();
  };
  const sendCode = async () => {
    setErr(''); setInfo(''); setSending(true);
    try {
      const r = mode === 'forgot'
        ? await api<{ dev_code?: string }>('POST', '/api/auth/forgot', { login: username.trim() })
        : await api<{ dev_code?: string }>('POST', '/api/auth/email-code', { email: email.trim(), lang: 'de' });
      setCodeSent(true);
      setInfo(mode === 'forgot' ? t("Wenn zu diesem Konto eine bestätigte E-Mail gehört, ist der Code jetzt unterwegs. Er gilt 15 Minuten.") : t("Wir haben dir einen 6-stelligen Code geschickt. Schau auch im Spam-Ordner nach."));
      if (r.dev_code) setCode(r.dev_code);
    } catch (e) { setErr(errText(e)); } finally { setSending(false); }
  };
  const needMail = mode === 'register' && mailOn;
  // Bot-Schutz schon beim Öffnen des Formulars im Hintergrund rechnen
  useEffect(() => { if (mode === 'register') prepPow().catch(() => {}); }, [mode]);
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      if (mode === 'forgot') {
        const rr = await api<{ token?: string; need_login?: boolean }>('POST', '/api/auth/reset', { login: username.trim(), code: code.trim(), password });
        if (rr.need_login) { switchMode('login'); setInfo(t("Passwort geändert. Melde dich jetzt mit dem neuen Passwort und deinem Zwei-Faktor-Code an.")); return; }
        await signedIn(rr);
        return;
      }
      if (needMail && !code.trim()) throw new Error(codeSent ? 'Bitte gib den Code aus der Mail ein.' : 'Bitte lass dir zuerst einen Code an deine E-Mail schicken.');
      const body = mode === 'login' ? { username: username.trim(), password, ...(verify && code.trim() ? { code: code.trim() } : {}), ...(mfaNeeded && mfa.trim() ? { mfa: mfa.trim() } : {}) } : { username: username.trim().toLowerCase(), password, display: display.trim() || username.trim(), age16: age, accept, lang: LANG, ...(needMail ? { email: email.trim(), code: code.trim() } : {}) };
      // Bot-Schutz: beim Registrieren die (meist schon fertig gerechnete) Aufgabe mitschicken
      const full = mode === 'register' ? { ...body, pow: await takePow() } : body;
      await signedIn(await api<{ token?: string }>('POST', mode === 'login' ? '/api/auth/login' : '/api/auth/register', full));
    } catch (e: any) {
      if (e?.code === 'mfa_required' || (e?.code === 'bad_mfa' && !mfaNeeded)) {
        setMfaNeeded(true);
        setInfo(t("Gib den 6-stelligen Code aus deiner Authenticator-App ein – oder einen Ersatz-Code."));
        return;
      }
      if (e?.code === 'login_verify') {
        setVerify(e.data?.email || '');
        if (e.data?.dev_code) setCode(e.data.dev_code);
        setInfo(t("Du meldest dich von einem neuen Gerät oder Ort an. Wir haben dir eine E-Mail an {e} geschickt: Klicke dort auf „IP autorisieren“ und tippe danach hier auf „Anmelden“. Oder gib den Code aus der Mail ein.", { e: e.data?.email || '' }));
        return;
      } setErr(e instanceof Error && !(e as any).code && /^Bitte /.test(e.message) ? e.message : errText(e)); } finally { setBusy(false); }
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
              <T style={s.brand}>{t("ToLobby")}</T>
              <T style={s.tag}>{t("Chatten, reden und in 3D-Räumen abhängen.")}</T>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(150).duration(500)}>
              <Glass style={s.card} intensity={40} tint="rgba(19,20,32,0.78)">
                {mode === 'forgot' ? (
                  <View style={{ marginBottom: 4 }}>
                    <T style={{ fontSize: 20, fontWeight: '800' }}>{t("Passwort vergessen?")}</T>
                    <T style={{ color: C.text2, marginTop: 4 }}>{t("Wir schicken dir einen Code an die E-Mail deines Kontos.")}</T>
                  </View>
                ) : (
                  <View style={s.tabs}>
                    {(['login', 'register'] as const).map((m) => (
                      <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => switchMode(m)} style={[s.tab, mode === m && s.tabOn]}>
                        <T style={[s.tabText, mode === m && { color: C.text }]}>{m === 'login' ? t("Anmelden") : t("Registrieren")}</T>
                      </Pressable>
                    ))}
                  </View>
                )}
                <T style={s.label}>{mode === 'forgot' ? t("Benutzername oder E-Mail") : t("Benutzername")}</T>
                {field('u', { value: username, onChangeText: setUsername, autoCapitalize: 'none', autoCorrect: false, textContentType: 'username', autoComplete: 'username', placeholder: mode === 'forgot' ? t("dein.name oder name@mail.de") : 'dein.name', editable: !(mode === 'forgot' && codeSent) })}
                {mode === 'register' ? <>
                  <T style={s.label}>{t("Anzeigename")}</T>
                  {field('d', { value: display, onChangeText: setDisplay, placeholder: t("So sehen dich andere"), maxLength: 32 })}
                </> : null}
                {needMail ? <>
                  <T style={s.label}>{t("E-Mail")}</T>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>{field('e', { value: email, onChangeText: setEmail, autoCapitalize: 'none', autoCorrect: false, keyboardType: 'email-address', textContentType: 'emailAddress', autoComplete: 'email', placeholder: t("name@mail.de") })}</View>
                    <Btn title={codeSent ? t("Neu senden") : t("Code senden")} kind="secondary" onPress={sendCode} busy={sending} disabled={!email.includes('@')} style={{ height: 50 }} />
                  </View>
                </> : null}
                {mode === 'forgot' && !codeSent ? <Btn title={t("Code senden")} onPress={sendCode} busy={sending} disabled={!username.trim()} style={{ marginTop: 18 }} /> : null}
                {info ? <T style={{ color: C.text2, marginTop: 12, lineHeight: 20 }}>{info}</T> : null}
                {(needMail && codeSent) || (mode === 'forgot' && codeSent) || (mode === 'login' && verify !== null) ? <>
                  <T style={s.label}>{t("Code aus der Mail")}</T>
                  {field('c', { value: code, onChangeText: (v: string) => setCode(v.replace(/\D/g, '').slice(0, 6)), keyboardType: 'number-pad', textContentType: 'oneTimeCode', autoComplete: 'one-time-code', placeholder: '123456', maxLength: 6 })}
                </> : null}
                {mode !== 'forgot' || codeSent ? <>
                  <T style={s.label}>{mode === 'forgot' ? t("Neues Passwort") : t("Passwort")}</T>
                  {field('p', { value: password, onChangeText: setPassword, secureTextEntry: true, textContentType: mode === 'login' ? 'password' : 'newPassword', autoComplete: mode === 'login' ? 'password' : 'new-password', placeholder: mode === 'login' ? '••••••••' : t("mindestens 8 Zeichen"), onSubmitEditing: submit })}
                </> : null}
                {mode === 'login' && mfaNeeded ? <>
                  <T style={s.label}>{t("Zwei-Faktor-Code")}</T>
                  {field('m', { value: mfa, onChangeText: (v: string) => setMfa(v.slice(0, 12)), keyboardType: 'default', autoCapitalize: 'none', autoCorrect: false, textContentType: 'oneTimeCode', autoComplete: 'one-time-code', placeholder: '123456', maxLength: 12, onSubmitEditing: submit })}
                </> : null}
                {mode === 'login' ? <T style={s.forgot} onPress={() => switchMode('forgot')}>{t("Passwort vergessen?")}</T> : null}
                {mode === 'register' ? <>
                  <Check on={age} set={setAge}>{t("Ich bin mindestens 16 Jahre alt.")}</Check>
                  <Check on={accept} set={setAccept}>{t("Ich stimme den")}{' '}<T style={s.link} onPress={() => WebBrowser.openBrowserAsync(LEGAL('regeln'))}>{t("Regeln")}</T> {' '}{t("und der")}{' '}<T style={s.link} onPress={() => WebBrowser.openBrowserAsync(LEGAL('datenschutz'))}>{t("Datenschutzerklärung")}</T> {' '}{t("zu.")}</Check>
                </> : null}
                {err ? <View style={s.err}><Icon name="ban" size={16} color={C.danger} /><T style={{ color: C.danger, flex: 1 }}>{err}</T></View> : null}
                {mode !== 'forgot' || codeSent
                  ? <Btn title={mode === 'login' ? t("Anmelden") : mode === 'forgot' ? t("Passwort speichern") : t("Konto erstellen")} onPress={submit} busy={busy} disabled={!username || !password || (mode === 'register' && (!age || !accept)) || (mode === 'forgot' && code.length < 6)} style={{ marginTop: 20 }} />
                  : null}
                {mode === 'forgot' ? <T style={[s.forgot, { alignSelf: 'center' }]} onPress={() => switchMode('login')}>{t("Zurück zur Anmeldung")}</T> : null}
              </Glass>
            </Animated.View>
            <View style={s.legal}>
              <T style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(LEGAL('impressum'))}>{t("Impressum")}</T>
              <T style={s.legalDot}>·</T>
              <T style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(LEGAL('datenschutz'))}>{t("Datenschutz")}</T>
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
  forgot: { color: C.info, fontWeight: '700', fontSize: 13, alignSelf: 'flex-end', marginTop: 10, paddingVertical: 4 },
});
