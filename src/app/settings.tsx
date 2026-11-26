// Einstellungen – kompakt wie die iPhone-Einstellungen: oben eine kurze Liste, jeder Punkt öffnet eine eigene Seite
// (/settings?page=…). Alles nativ: Profil, Bild/Banner/Farben, Rahmen, Namens-Stil, Effekt, Privatsphäre, Mitteilungen,
// Passwort, Rechtliches, Konto löschen (Apple verlangt das Löschen in der App).
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, BASE, errText, saveToken } from '@/lib/api';
import { clearState, setState, useStore } from '@/lib/store';
import { disconnect } from '@/lib/live';
import { unregisterPush } from '@/lib/push';
import { Avatar, Btn, Card, Glass, Glow, MenuRow, Section, T, TopBar } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { TipArt } from '@/components/TipArt';
import { frameOf } from '@/lib/frames';
import { NAME_STYLES } from '@/components/NameText';
import { EFFECTS } from '@/components/ProfileFx';
import { Studio } from '@/components/Studio';
import { PrivacySection, PushSection } from '@/components/SettingsMore';
import { signOut } from '@/lib/session';
import { buyTip, loadTips, onTipError, onTipThanks, type Tip } from '@/lib/tips';
import { setWebCalls, useCalls } from '@/lib/calls';
import { RINGTONES, previewRingtone, stopRingtone, applyRingtone } from '@/lib/ringtone';
import { C, F, HOME, R } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, LANGS, LANG_NAMES, langChoice, deviceLang, setLang, type Lang } from '@/lib/i18n';

const LEGAL = (p: string) => (BASE || 'https://zuno-app.altraex.workers.dev') + '/legal/' + p + '.html';
type Page = 'profile' | 'look' | 'frame' | 'name' | 'effect' | 'privacy' | 'push' | 'voice' | 'password' | 'email' | 'legal' | 'delete' | 'mfa' | 'support' | 'lang';
const titles = (): Record<Page, string> => ({ lang: t("App-Sprache"), profile: t("Profil"), look: t("Bild, Banner & Farben"), frame: t("Profilrahmen"), name: t("Namens-Stil"), effect: t("Profil-Effekt"), privacy: t("Privatsphäre & Geräte"), push: t("Mitteilungen"), voice: t("Sprache & Anrufe"), password: t("Passwort"), mfa: t("Zwei-Faktor-Schutz (MFA)"), support: t("ToLobby unterstützen"), email: t("E-Mail"), legal: t("Rechtliches"), delete: t("Konto löschen") });

export default function Settings() {
  const { page } = useLocalSearchParams<{ page?: Page }>();
  const router = useRouter();
  const me = useStore((s) => s.me) as any;
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 2600); return () => clearTimeout(t); }, [msg]);
  if (!me) return null;
  const patch = async (body: any, ok = 'Gespeichert ✓') => {
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); setMsg(ok); } catch (e) { setMsg(errText(e)); }
  };
  const open = (p: Page) => router.push({ pathname: '/settings', params: { page: p } });
  const frameName = frameOf(me.deco)?.name || null;
  const p = page && titles()[page] ? page : null;
  if (!p) return <SettingsHome me={me} open={open} frameName={frameName} />;
  // Aussehen (Bild & Farben, Rahmen, Namens-Stil, Effekt): eine gemeinsame Seite mit Live-Vorschau
  if (p === 'look' || p === 'frame' || p === 'name' || p === 'effect') return <><Stack.Screen options={{ headerShown: false }} /><Studio tab={p} /></>;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow />
      <TopBar title={titles()[p]} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {p === 'profile' ? <ProfilePage me={me} patch={patch} />
          : p === 'privacy' ? <PrivacySection patch={patch} say={setMsg} />
          : p === 'push' ? <PushSection say={setMsg} />
          : p === 'voice' ? <VoicePage />
          : p === 'lang' ? <LangPage />
          : p === 'password' ? <PasswordPage say={setMsg} />
          : p === 'email' ? <EmailPage say={setMsg} />
          : p === 'mfa' ? <MfaPage say={setMsg} />
          : p === 'support' ? <SupportPage say={setMsg} />
          : p === 'legal' ? <LegalPage />
          : <DeletePage say={setMsg} />}
      </ScrollView>
      {msg ? <View style={s.toast} pointerEvents="none"><T style={{ fontWeight: '700' }}>{msg}</T></View> : null}
    </View>
  );
}

/**
 * Startseite der Einstellungen – wie bei Discord eine Karte von unten: X oben links, Titel, Suchfeld,
 * darunter Gruppen („Konto-Einstellungen“ …) mit Zeilen und Pfeil. Beim Suchen erscheinen nur die passenden Zeilen.
 */
type Item = { icon: IconName; label: string; sub?: string; keys?: string; onPress: () => void; danger?: boolean };
function SettingsHome({ me, open, frameName }: { me: any; open: (p: Page) => void; frameName: string | null }) {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const webCalls = useCalls((c) => c.webCalls);
  const groups: [string, Item[]][] = [
    [t("Konto-Einstellungen"), [
      { icon: 'user', label: t("Profil"), sub: t("Name, Status-Text, Über mich"), keys: 'anzeigename bio pronomen', onPress: () => open('profile') },
      { icon: 'lock', label: t("Privatsphäre & Geräte"), sub: t("Wer schreiben darf, Blockierte, Geräte"), keys: 'datenschutz blockieren sitzungen', onPress: () => open('privacy') },
      { icon: 'bell', label: t("Mitteilungen"), keys: 'push benachrichtigungen ton', onPress: () => open('push') },
      { icon: 'globe', label: t("App-Sprache"), sub: langChoice() === 'auto' ? t("Wie das iPhone") + ' · ' + LANG_NAMES[deviceLang()] : LANG_NAMES[langChoice() as Lang], keys: 'sprache language dil لغة ziman langue idioma', onPress: () => open('lang') },
      { icon: 'phone', label: t("Sprache & Anrufe"), sub: webCalls ? t("Über die Web-Ansicht") : t("Direkt in der App"), keys: 'telefonieren sprachraum mikrofon', onPress: () => open('voice') },
      { icon: 'at', label: t("E-Mail"), sub: me.email ? maskMail(me.email) : t("Noch nicht eingetragen"), keys: 'mail email passwort vergessen', onPress: () => open('email') },
      { icon: 'shield', label: t("Passwort ändern"), keys: 'sicherheit kennwort', onPress: () => open('password') },
      { icon: 'lock', label: t("Zwei-Faktor-Schutz (MFA)"), sub: me.mfa ? t("Eingeschaltet") : t("Aus"), keys: 'mfa 2fa authenticator sicherheit code', onPress: () => open('mfa') },
    ]],
    [t("Aussehen"), [
      { icon: 'cube', label: t("3D-Avatar"), sub: t("Figur und Farben"), keys: 'figur 3d', onPress: () => router.push('/avatar3d') },
      { icon: 'image', label: t("Bild, Banner & Farben"), sub: t("Profilbild, Banner, eigene Farben"), keys: 'profilbild hintergrund farbe farbwähler akzent', onPress: () => open('look') },
      { icon: 'sparkle', label: t("Profilrahmen"), sub: frameName || t("Keiner"), keys: 'rahmen deko', onPress: () => open('frame') },
      { icon: 'edit', label: t("Namens-Stil"), sub: NAME_STYLES.find((x) => x[0] === (me.name_style || 'default'))?.[1] || t("Standard"), keys: 'schrift name farbe gold chrom', onPress: () => open('name') },
      { icon: 'moon', label: t("Profil-Effekt"), sub: EFFECTS.find((x) => x[0] === me.effect)?.[1] || t("Keiner"), keys: 'effekt schnee herzen goldstaub', onPress: () => open('effect') },
    ]],
    [t("Mehr"), [
      { icon: 'user', label: t("So sehen dich andere"), keys: 'profil ansehen', onPress: () => router.push({ pathname: '/user/[id]', params: { id: me.id } }) },
      { icon: 'pad', label: t("Mitspieler-Match"), sub: t("Leute zum Zocken finden und matchen"), keys: 'gamer match duo team spieler suchen', onPress: () => router.push('/match') },
      { icon: 'sparkle', label: t("Feed"), keys: 'beiträge posts', onPress: () => router.push('/feed') },
      { icon: 'compass', label: t("Server entdecken"), keys: 'suchen beitreten', onPress: () => router.push({ pathname: '/server-new', params: { tab: 'discover' } }) },
      ...(me.is_admin ? [{ icon: 'shield' as IconName, label: t("Admin-Bereich"), keys: 'verwaltung', onPress: () => router.push('/admin') }] : []),
      ...(Platform.OS === 'ios' ? [{ icon: 'heart' as IconName, label: t("ToLobby unterstützen"), sub: t("Freiwilliges Trinkgeld über Apple"), keys: 'trinkgeld spende support danke', onPress: () => open('support') }] : []),
      { icon: 'globe', label: t("Rechtliches"), sub: t("Regeln, Datenschutz, Impressum"), keys: 'agb', onPress: () => open('legal') },
    ]],
    ['', [
      { icon: 'logout', label: t("Abmelden"), danger: true, keys: 'ausloggen', onPress: () => signOut() },
      { icon: 'trash', label: t("Konto löschen"), danger: true, keys: 'entfernen', onPress: () => open('delete') },
    ]],
  ];
  const term = q.trim().toLowerCase();
  const shown = term ? groups.map(([t, items]) => [t, items.filter((i) => `${i.label} ${i.sub || ''} ${i.keys || ''}`.toLowerCase().includes(term))] as [string, Item[]]).filter(([, items]) => items.length) : groups;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[sh.sheet, { marginTop: ins.top + 4 }]}>
        <View style={sh.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Schließen")} hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={sh.close}>
            <Icon name="x" size={24} color={C.text} stroke={2.3} />
          </Pressable>
          <T style={sh.title}>{t("Einstellungen")}</T>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + ins.bottom }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={sh.search}>
            <Icon name="search" size={19} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t("Suchen")} placeholderTextColor={C.faint} style={sh.input} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
          </View>
          {!shown.length ? <T style={{ color: C.muted, textAlign: 'center', marginTop: 24 }}>{t("Nichts gefunden.")}</T> : null}
          {shown.map(([title, items], gi) => (
            <View key={title || 'x' + gi}>
              {title ? <T style={sh.group}>{title}</T> : <View style={{ height: 22 }} />}
              <View style={sh.card}>
                {items.map((i, k) => (
                  <Pressable key={i.label} accessibilityRole="button" accessibilityLabel={i.label} onPress={i.onPress} style={({ pressed }) => [sh.row, pressed && { backgroundColor: HOME.bar }]}>
                    <Icon name={i.icon} size={22} color={i.danger ? C.danger : C.text} stroke={2.1} />
                    <View style={[sh.rowBody, k > 0 && sh.line]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={[sh.label, i.danger && { color: C.danger }]} numberOfLines={1}>{i.label}</T>
                        {i.sub ? <T style={sh.sub} numberOfLines={1}>{i.sub}</T> : null}
                      </View>
                      {i.danger ? null : <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={16} color={C.muted} stroke={2.4} /></View>}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
const sh = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: HOME.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 14, paddingHorizontal: 14, backgroundColor: HOME.rail, borderWidth: 1, borderColor: HOME.edge },
  input: { flex: 1, color: C.text, fontSize: 16, fontFamily: F.regular, height: '100%' },
  group: { color: C.muted, fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 8, marginLeft: 2 },
  card: { backgroundColor: HOME.raised, borderRadius: 18, borderWidth: 1, borderColor: HOME.edge, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 18 },
  rowBody: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 16, paddingVertical: 8 },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  label: { fontSize: 16.5, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 13, marginTop: -1 },
});

type PP = { me: any; patch: (b: any, ok?: string) => Promise<void> };
const Field = ({ label, ...p }: any) => (<><T style={s.label}>{label}</T><TextInput placeholderTextColor={C.faint} {...p} style={[s.input, p.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }]} /></>);

function ProfilePage({ me, patch }: PP) {
  const [display, setDisplay] = useState(me.display || '');
  const [custom, setCustom] = useState(me.custom_status || '');
  const [bio, setBio] = useState(me.bio || '');
  const [pronouns, setPronouns] = useState(me.pronouns || '');
  const dirty = display !== (me.display || '') || custom !== (me.custom_status || '') || bio !== (me.bio || '') || pronouns !== (me.pronouns || '');
  return (
    <Glass style={s.card} intensity={20}>
      <Field label={t("Anzeigename")} value={display} onChangeText={setDisplay} maxLength={32} />
      <Field label={t("Status-Text")} value={custom} onChangeText={setCustom} maxLength={80} placeholder={t("z. B. „Zocke gerade 🎮“")} />
      <Field label={t("Pronomen")} value={pronouns} onChangeText={setPronouns} maxLength={40} placeholder={t("z. B. sie/ihr")} />
      <Field label={t("Über mich")} value={bio} onChangeText={setBio} maxLength={300} multiline />
      <Btn title={t("Speichern")} disabled={!dirty || !display.trim()} onPress={() => patch({ display: display.trim(), bio, custom_status: custom, pronouns })} style={{ marginTop: 14 }} />
    </Glass>
  );
}

/** E-Mail eintragen oder ändern: Adresse eingeben → 6-stelligen Code aus der Mail eingeben (wie in der Web-App). */
const maskMail = (e: string) => { const [a, b] = String(e).split('@'); return (a.length > 2 ? a.slice(0, 2) + '•'.repeat(Math.min(6, a.length - 2)) : a) + '@' + (b || ''); };
function EmailPage({ say }: { say: (t: string) => void }) {
  const me = useStore((s) => s.me) as any;
  const [email, setEmail] = useState(me?.email || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const send = async () => {
    setBusy(true);
    try { await api('POST', '/api/me/email', { email: email.trim(), ...(me?.email ? { password: pw } : {}) }); setSent(true); say(t("Code gesendet – schau in dein Postfach.")); } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  const confirm = async () => {
    setBusy(true);
    try { const d = await api<any>('POST', '/api/me/email/confirm', { email: email.trim(), code: code.trim() }); setState((s) => ({ me: { ...s.me!, ...d.user } })); setSent(false); setCode(''); say(t("E-Mail gespeichert ✓")); } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  return (
    <Glass style={s.card} intensity={20}>
      <T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 4 }}>{t("Damit kannst du dein Passwort zurücksetzen, falls du es vergisst. Deine E-Mail sieht niemand.")}</T>
      {me?.email ? <T style={{ fontWeight: '700', marginTop: 6 }}>{t("Eingetragen:")}{' '}{maskMail(me.email)} ✓</T> : null}
      <Field label={me?.email ? t("Neue E-Mail") : t("E-Mail")} value={email} onChangeText={(v: string) => { setEmail(v); setSent(false); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder={t("name@beispiel.de")} />
      {me?.email && !sent ? <Field label={t("Dein Passwort")} value={pw} onChangeText={setPw} secureTextEntry textContentType="password" autoCapitalize="none" /> : null}
      {!sent ? <Btn title={t("Code schicken")} busy={busy} onPress={send} disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || (!!me?.email && pw.length < 8)} style={{ marginTop: 14 }} />
        : <>
            <Field label={t("Code aus der E-Mail")} value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={8} placeholder="123456" />
            <Btn title={t("Bestätigen")} busy={busy} onPress={confirm} disabled={code.trim().length < 6} style={{ marginTop: 14 }} />
            <Btn title={t("Code noch einmal schicken")} kind="ghost" small onPress={send} style={{ marginTop: 6 }} />
          </>}
    </Glass>
  );
}
/** Zwei-Faktor-Schutz: Schlüssel in die Authenticator-App übernehmen (Link oder Abtippen), Code bestätigen, Ersatz-Codes sichern */
function MfaPage({ say }: { say: (t: string) => void }) {
  const me = useStore((s) => s.me) as any;
  const [pw, setPw] = useState('');
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { say(errText(e)); } setBusy(false); };
  const start = () => run(async () => { setSetup(await api<any>('POST', '/api/me/mfa/setup', { password: pw })); setPw(''); });
  const enable = () => run(async () => { const r = await api<any>('POST', '/api/me/mfa/enable', { code: code.trim() }); setState((s) => ({ me: { ...s.me!, ...r.user } })); setBackup(r.backup); setSetup(null); setCode(''); });
  const newCodes = () => run(async () => { const r = await api<any>('POST', '/api/me/mfa/backup', { password: pw, code: code.trim() }); setBackup(r.backup); setPw(''); setCode(''); });
  const off = () => run(async () => { const r = await api<any>('POST', '/api/me/mfa/disable', { password: pw, code: code.trim() }); setState((s) => ({ me: { ...s.me!, ...r.user } })); setPw(''); setCode(''); say(t("Zwei-Faktor-Schutz ist aus.")); });
  const copy = async (v: string) => { try { const C2 = await import('expo-clipboard'); await C2.setStringAsync(v); say(t("Kopiert ✓")); } catch {} };
  return (
    <Glass style={s.card} intensity={20}>
      <T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 6 }}>{t("Beim Anmelden brauchst du zusätzlich einen 6-stelligen Code aus einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, Authy). Selbst wer dein Passwort kennt, kommt dann nicht rein.")}</T>
      {backup ? <>
        <T style={{ fontWeight: '800', marginTop: 8 }}>{t("Deine Ersatz-Codes")}</T>
        <T style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{t("Schreib dir diese Ersatz-Codes auf oder speichere sie. Wenn du dein Handy verlierst, kommst du nur damit wieder in dein Konto. Jeder Code gilt genau einmal.")}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{backup.map((c) => <T key={c} style={{ width: '47%', textAlign: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: C.bg1, fontSize: 16, letterSpacing: 1 }}>{c}</T>)}</View>
        <Btn title={t("Kopieren")} kind="secondary" onPress={() => copy(backup.join('\n'))} style={{ marginTop: 12 }} />
        <Btn title={t("Fertig")} onPress={() => setBackup(null)} style={{ marginTop: 8 }} />
      </> : setup ? <>
        <T style={{ fontWeight: '800', marginTop: 8 }}>{t("1. Schlüssel in die Authenticator-App übernehmen")}</T>
        <Btn title={t("In Authenticator-App öffnen")} onPress={() => Linking.openURL(setup.uri).catch(() => say(t("Keine Authenticator-App gefunden – gib den Schlüssel von Hand ein.")))} style={{ marginTop: 10 }} />
        <T style={{ color: C.muted, fontSize: 13, marginTop: 10 }}>{t("Oder gib diesen Schlüssel in der App ein:")}</T>
        <Pressable onPress={() => copy(setup.secret)} style={{ marginTop: 6, padding: 12, borderRadius: 10, backgroundColor: C.bg1 }}><T style={{ fontSize: 15, letterSpacing: 1 }}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</T><T style={{ color: C.accent, fontSize: 12, marginTop: 4 }}>{t("Tippen zum Kopieren")}</T></Pressable>
        <Field label={t("2. Code aus der App")} value={code} onChangeText={(v: string) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" placeholder="123456" maxLength={6} />
        <Btn title={t("Einschalten")} busy={busy} onPress={enable} disabled={code.length < 6} style={{ marginTop: 14 }} />
      </> : me?.mfa ? <>
        <T style={{ fontWeight: '800', color: C.ok, marginTop: 6 }}>{t("Eingeschaltet")} ✓</T>
        <Field label={t("Dein Passwort")} value={pw} onChangeText={setPw} secureTextEntry textContentType="password" autoCapitalize="none" />
        <Field label={t("Code aus der App oder Ersatz-Code")} value={code} onChangeText={setCode} autoCapitalize="none" placeholder="123456" maxLength={12} />
        <Btn title={t("Neue Ersatz-Codes")} kind="secondary" busy={busy} onPress={newCodes} disabled={pw.length < 8 || code.trim().length < 6} style={{ marginTop: 12 }} />
        <Btn title={t("Ausschalten")} kind="danger" busy={busy} onPress={off} disabled={pw.length < 8 || code.trim().length < 6} style={{ marginTop: 12 }} />
      </> : <>
        <Field label={t("Dein Passwort")} value={pw} onChangeText={setPw} secureTextEntry textContentType="password" autoCapitalize="none" />
        <Btn title={t("Einschalten")} busy={busy} onPress={start} disabled={pw.length < 8} style={{ marginTop: 14 }} />
      </>}
    </Glass>
  );
}
/** Freiwilliges Trinkgeld über Apple (In-App-Kauf). Schaltet nichts frei – ein Dankeschön an die Entwicklung. */
function SupportPage({ say }: { say: (t: string) => void }) {
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [thanked, setThanked] = useState(false);
  useEffect(() => {
    loadTips().then(setTips).catch(() => setTips([]));
    const a = onTipThanks(() => { setBusy(null); setThanked(true); });
    const b = onTipError(() => { setBusy(null); say(t("Der Kauf hat nicht geklappt. Bitte versuch es noch einmal.")); });
    return () => { a(); b(); };
  }, []);
  const NAME: Record<string, string> = { tolobby_tip_small: t("Kleines Danke"), tolobby_tip_medium: t("Großes Danke"), tolobby_tip_large: t("Riesiges Danke") };
  return (
    <Glass style={s.card} intensity={20}>
      <T style={{ fontSize: 17, fontWeight: '800' }}>{t("Gefällt dir ToLobby?")}</T>
      <T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{t("ToLobby ist kostenlos und ohne Werbung. Mit einem Trinkgeld hilfst du, Server und Weiterentwicklung zu bezahlen. Es schaltet nichts frei – es ist einfach ein Dankeschön.")}</T>
      {thanked ? <T style={{ marginTop: 16, fontSize: 16, fontWeight: '800', color: C.ok, textAlign: 'center' }}>{t("Danke für deine Unterstützung! 💜")}</T> : null}
      {tips === null ? <T style={{ color: C.muted, marginTop: 16 }}>{t("Lädt …")}</T>
        : !tips.length ? <T style={{ color: C.muted, marginTop: 16 }}>{t("Trinkgeld ist gerade nicht verfügbar. Bitte versuch es später noch einmal.")}</T>
        : tips.map((tp) => (
          <Pressable key={tp.id} accessibilityRole="button" disabled={!!busy} onPress={async () => { setBusy(tp.id); try { await buyTip(tp.id); } catch { setBusy(null); say(t("Der Kauf hat nicht geklappt. Bitte versuch es noch einmal.")); } }}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: C.bg1, borderWidth: 1, borderColor: C.line }, pressed && { opacity: 0.8 }]}>
            <TipArt id={tp.id} size={46} />
            <T style={{ flex: 1, fontWeight: '800', fontSize: 16 }}>{NAME[tp.id] || tp.title}</T>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: C.accent }}><T style={{ color: '#fff', fontWeight: '800' }}>{busy === tp.id ? '…' : tp.price}</T></View>
          </Pressable>
        ))}
      <T style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 14 }}>{t("Bezahlt wird über dein Apple-Konto. Einmalig, kein Abo.")}</T>
    </Glass>
  );
}
function PasswordPage({ say }: { say: (t: string) => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const change = async () => {
    setBusy(true);
    try { await api('POST', '/api/me/password', { old: oldPw, new: newPw }); setOldPw(''); setNewPw(''); say(t("Passwort geändert ✓")); } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  return (
    <Glass style={s.card} intensity={20}>
      <Field label={t("Aktuelles Passwort")} value={oldPw} onChangeText={setOldPw} secureTextEntry textContentType="password" autoCapitalize="none" />
      <Field label={t("Neues Passwort")} value={newPw} onChangeText={setNewPw} secureTextEntry textContentType="newPassword" autoCapitalize="none" placeholder={t("mindestens 8 Zeichen")} />
      <Btn title={t("Passwort ändern")} busy={busy} onPress={change} disabled={!oldPw || newPw.length < 8} style={{ marginTop: 14 }} />
    </Glass>
  );
}
/** Anrufe und Sprachräume direkt in der App – oder (Ersatzweg) wie früher über die Web-Ansicht. */
/** Sprache der App: „Wie das iPhone“ oder eine feste Sprache. Gilt auch für Mitteilungen vom Server (Konto-Sprache). */
function LangPage() {
  const cur = langChoice();
  const choose = (l: Lang | 'auto') => {
    if (l === cur) return;
    const eff = l === 'auto' ? deviceLang() : l;
    api('PATCH', '/api/me', { lang: eff }).catch(() => {});
    setLang(l);
  };
  const row = (key: Lang | 'auto', label: string, sub: string | null, last: boolean) => (
    <Pressable key={key} onPress={() => choose(key)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '700', fontSize: 15.5 }}>{label}</T>
        {sub ? <T style={{ color: C.muted, fontSize: 12.5 }}>{sub}</T> : null}
      </View>
      {cur === key ? <Icon name="check" size={20} color={C.accent} /> : null}
    </Pressable>
  );
  return (
    <>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {row('auto', t("Wie das iPhone"), LANG_NAMES[deviceLang()], false)}
        {LANGS.map((l, i) => row(l, LANG_NAMES[l], null, i === LANGS.length - 1))}
      </Card>
      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 10, paddingHorizontal: 4 }}>
        {t("Die App baut sich in der neuen Sprache neu auf. Mitteilungen kommen ebenfalls in dieser Sprache.")}</T>
    </>
  );
}

function VoicePage() {
  const webCalls = useCalls((c) => c.webCalls);
  const me = useStore((s) => s.me);
  const cur = (me as any)?.ringtone || 'puls';
  const pick = async (k: string) => {
    previewRingtone(k);
    if (k === cur) return;
    try { await api('PATCH', '/api/me', { ringtone: k }); setState((s) => ({ me: s.me ? { ...s.me, ringtone: k } as any : s.me })); applyRingtone(k); } catch {}
  };
  useEffect(() => () => stopRingtone(), []);
  return (
    <>
      <T style={{ color: C.muted, fontSize: 12.5, fontWeight: '700', marginBottom: 6, paddingHorizontal: 4 }}>{t("Klingelton").toUpperCase()}</T>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {RINGTONES.map(([k, label], i) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: cur === k }} onPress={() => pick(k)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: C.line }, pressed && { opacity: 0.7 }]}>
            <Icon name={cur === k ? 'check' : 'bell'} size={18} color={cur === k ? C.accent : C.muted} />
            <T style={{ flex: 1, fontWeight: cur === k ? '800' : '600' }}>{t(label)}</T>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Anhören")} hitSlop={8} onPress={() => previewRingtone(k)}><Icon name="play" size={18} color={C.text2} /></Pressable>
          </Pressable>
        ))}
      </Card>
      <Card style={{ padding: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <Icon name="phone" size={20} color={C.accent} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{t("Anrufe direkt in der App")}</T>
            <T style={{ color: C.muted, fontSize: 12.5 }}>{t("Anrufe und Sprachräume laufen schneller und stabiler, auch mit gesperrtem Handy.")}</T>
          </View>
          <Switch value={!webCalls} onValueChange={(on) => setWebCalls(!on)} trackColor={{ true: C.accent, false: C.bg5 }} />
        </View>
      </Card>
      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 10, paddingHorizontal: 4 }}>
        {t("Klappt etwas nicht, schalte es aus – dann laufen Anrufe wie früher über die Web-Ansicht. 3D-Räume und Spiele laufen immer über die Web-Ansicht.")}</T>
    </>
  );
}

function LegalPage() {
  const Link = ({ icon, label, page, last }: { icon: IconName; label: string; page: string; last?: boolean }) => (
    <MenuRow icon={icon} label={label} onPress={() => WebBrowser.openBrowserAsync(LEGAL(page)).catch(() => {})} last={last} />
  );
  return <Card><Link icon="shield" label={t("Regeln")} page="regeln" /><Link icon="lock" label={t("Datenschutz")} page="datenschutz" /><Link icon="globe" label={t("Impressum")} page="impressum" last /></Card>;
}
function DeletePage({ say }: { say: (t: string) => void }) {
  const [pw, setPw] = useState('');
  const really = async () => {
    try { await api('POST', '/api/me/delete', { password: pw }); await unregisterPush(); disconnect(); await saveToken(null); clearState(); }
    catch (e) { say(errText(e)); }
  };
  const del = () => {
    const text = 'Profil, Nachrichten, Bilder, Freundschaften und Mitgliedschaften werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.';
    if (Platform.OS === 'web') { if (confirm(text)) really(); return; }
    Alert.alert(t("Konto endgültig löschen?"), text, [{ text: t("Abbrechen"), style: 'cancel' }, { text: t("Löschen"), style: 'destructive', onPress: really }]);
  };
  return (
    <Glass style={[s.card, { borderColor: 'rgba(255,77,94,0.3)' }]} intensity={20}>
      <T style={{ color: C.text2, lineHeight: 21 }}>{t("Dein Konto und alles, was du geschrieben und hochgeladen hast, wird endgültig gelöscht.")}</T>
      <Field label={t("Passwort zur Bestätigung")} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
      <Btn title={t("Konto endgültig löschen")} kind="danger" icon="trash" disabled={!pw} onPress={del} style={{ marginTop: 14 }} />
    </Glass>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.lg },
  sub: { color: C.muted, fontSize: 13.5, marginTop: -2 },
  h2: { marginTop: 18, marginBottom: 6, marginLeft: 4 },
  card: { borderRadius: 16, padding: 14 },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 13, minHeight: 44, fontSize: 15.5, fontFamily: F.medium, position: 'relative' },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frame: { width: '23.3%', alignItems: 'center', paddingVertical: 4, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)' },
  on: { borderColor: C.accent, backgroundColor: C.accentSoft },
  style: { width: '31.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 2, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)' },
  styleName: { fontSize: 16, fontWeight: '800', maxWidth: '100%' },
  fx: { width: '31.5%', alignItems: 'center', paddingBottom: 6, gap: 4, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)', overflow: 'hidden' },
  fxDemo: { width: '100%', height: 54, backgroundColor: '#1d1838' },
  cap: { fontSize: 11, color: C.text2, fontWeight: '600', paddingHorizontal: 2 },
});
