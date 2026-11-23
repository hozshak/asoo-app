// Einstellungen – kompakt wie die iPhone-Einstellungen: oben eine kurze Liste, jeder Punkt öffnet eine eigene Seite
// (/settings?page=…). Alles nativ: Profil, Bild/Banner/Farben, Rahmen, Namens-Stil, Effekt, Privatsphäre, Mitteilungen,
// Passwort, Rechtliches, Konto löschen (Apple verlangt das Löschen in der App).
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, BASE, errText, saveToken } from '@/lib/api';
import { clearState, setState, useStore } from '@/lib/store';
import { disconnect } from '@/lib/live';
import { unregisterPush } from '@/lib/push';
import { Avatar, Btn, Card, Glass, Glow, MenuRow, Section, T, TopBar } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { FRAMES } from '@/lib/frames';
import { NameText, NAME_STYLES } from '@/components/NameText';
import { EFFECTS, ProfileFx } from '@/components/ProfileFx';
import { LookSection, PrivacySection, PushSection } from '@/components/SettingsMore';
import { signOut } from '@/lib/session';
import { setWebCalls, useCalls } from '@/lib/calls';
import { C, F, HOME, R } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LEGAL = (p: string) => (BASE || 'https://zuno-app.altraex.workers.dev') + '/legal/' + p + '.html';
type Page = 'profile' | 'look' | 'frame' | 'name' | 'effect' | 'privacy' | 'push' | 'voice' | 'password' | 'legal' | 'delete';
const TITLES: Record<Page, string> = { profile: 'Profil', look: 'Bild, Banner & Farben', frame: 'Profilrahmen', name: 'Namens-Stil', effect: 'Profil-Effekt', privacy: 'Privatsphäre & Geräte', push: 'Mitteilungen', voice: 'Sprache & Anrufe', password: 'Passwort', legal: 'Rechtliches', delete: 'Konto löschen' };

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
  const frameName = me.deco && me.deco !== 'none' ? FRAMES[me.deco]?.name : null;
  const p = page && TITLES[page] ? page : null;
  if (!p) return <SettingsHome me={me} open={open} frameName={frameName} />;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow />
      <TopBar title={TITLES[p]} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {p === 'profile' ? <ProfilePage me={me} patch={patch} />
          : p === 'look' ? <LookSection patch={patch} say={setMsg} />
          : p === 'frame' ? <FramePage me={me} patch={patch} />
          : p === 'name' ? <NamePage me={me} patch={patch} />
          : p === 'effect' ? <EffectPage me={me} patch={patch} />
          : p === 'privacy' ? <PrivacySection patch={patch} say={setMsg} />
          : p === 'push' ? <PushSection say={setMsg} />
          : p === 'voice' ? <VoicePage />
          : p === 'password' ? <PasswordPage say={setMsg} />
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
    ['Konto-Einstellungen', [
      { icon: 'user', label: 'Profil', sub: 'Name, Status-Text, Über mich', keys: 'anzeigename bio pronomen', onPress: () => open('profile') },
      { icon: 'lock', label: 'Privatsphäre & Geräte', sub: 'Wer schreiben darf, Blockierte, Geräte', keys: 'datenschutz blockieren sitzungen', onPress: () => open('privacy') },
      { icon: 'bell', label: 'Mitteilungen', keys: 'push benachrichtigungen ton', onPress: () => open('push') },
      { icon: 'phone', label: 'Sprache & Anrufe', sub: webCalls ? 'Über die Web-Ansicht' : 'Direkt in der App', keys: 'telefonieren sprachraum mikrofon', onPress: () => open('voice') },
      { icon: 'shield', label: 'Passwort ändern', keys: 'sicherheit kennwort', onPress: () => open('password') },
    ]],
    ['Aussehen', [
      { icon: 'cube', label: '3D-Avatar', sub: 'Figur und Farben', keys: 'figur 3d', onPress: () => router.push('/avatar3d') },
      { icon: 'image', label: 'Bild, Banner & Farben', keys: 'profilbild hintergrund farbe', onPress: () => open('look') },
      { icon: 'sparkle', label: 'Profilrahmen', sub: frameName || 'Keiner', keys: 'rahmen deko', onPress: () => open('frame') },
      { icon: 'edit', label: 'Namens-Stil', keys: 'schrift name farbe', onPress: () => open('name') },
      { icon: 'moon', label: 'Profil-Effekt', keys: 'effekt schnee herzen', onPress: () => open('effect') },
    ]],
    ['Mehr', [
      { icon: 'user', label: 'So sehen dich andere', keys: 'profil ansehen', onPress: () => router.push({ pathname: '/user/[id]', params: { id: me.id } }) },
      { icon: 'sparkle', label: 'Feed', keys: 'beiträge posts', onPress: () => router.push('/feed') },
      { icon: 'compass', label: 'Server entdecken', keys: 'suchen beitreten', onPress: () => router.push({ pathname: '/server-new', params: { tab: 'discover' } }) },
      ...(me.is_admin ? [{ icon: 'shield' as IconName, label: 'Admin-Bereich', keys: 'verwaltung', onPress: () => router.push('/admin') }] : []),
      { icon: 'globe', label: 'Rechtliches', sub: 'Regeln, Datenschutz, Impressum', keys: 'agb', onPress: () => open('legal') },
    ]],
    ['', [
      { icon: 'logout', label: 'Abmelden', danger: true, keys: 'ausloggen', onPress: () => signOut() },
      { icon: 'trash', label: 'Konto löschen', danger: true, keys: 'entfernen', onPress: () => open('delete') },
    ]],
  ];
  const term = q.trim().toLowerCase();
  const shown = term ? groups.map(([t, items]) => [t, items.filter((i) => `${i.label} ${i.sub || ''} ${i.keys || ''}`.toLowerCase().includes(term))] as [string, Item[]]).filter(([, items]) => items.length) : groups;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[sh.sheet, { marginTop: ins.top + 4 }]}>
        <View style={sh.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={sh.close}>
            <Icon name="x" size={24} color={C.text} stroke={2.3} />
          </Pressable>
          <T style={sh.title}>Einstellungen</T>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + ins.bottom }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={sh.search}>
            <Icon name="search" size={19} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Suchen" placeholderTextColor={C.faint} style={sh.input} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
          </View>
          {!shown.length ? <T style={{ color: C.muted, textAlign: 'center', marginTop: 24 }}>Nichts gefunden.</T> : null}
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
      <Field label="Anzeigename" value={display} onChangeText={setDisplay} maxLength={32} />
      <Field label="Status-Text" value={custom} onChangeText={setCustom} maxLength={80} placeholder="z. B. „Zocke gerade 🎮“" />
      <Field label="Pronomen" value={pronouns} onChangeText={setPronouns} maxLength={40} placeholder="z. B. sie/ihr" />
      <Field label="Über mich" value={bio} onChangeText={setBio} maxLength={300} multiline />
      <Btn title="Speichern" disabled={!dirty || !display.trim()} onPress={() => patch({ display: display.trim(), bio, custom_status: custom, pronouns })} style={{ marginTop: 14 }} />
    </Glass>
  );
}

function FramePage({ me, patch }: PP) {
  return (
    <View style={s.grid}>
      {[['none', 'Keiner'], ...Object.entries(FRAMES).map(([k, f]) => [k, f.name])].map(([k, name]) => {
        const on = (me.deco || 'none') === k;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ deco: k }, 'Rahmen gesetzt ✓')} style={[s.frame, on && s.on]}>
            <View style={{ height: 62, alignItems: 'center', justifyContent: 'center' }}><Avatar user={{ ...me, deco: k }} force size={k === 'none' ? 38 : Math.min(38, 70 / Math.max(FRAMES[k].w, FRAMES[k].h))} /></View>
            <T style={s.cap} numberOfLines={1}>{name}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
function NamePage({ me, patch }: PP) {
  return (
    <View style={s.grid}>
      {NAME_STYLES.map(([k, l]) => {
        const on = (me.name_style || 'default') === k;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ name_style: k }, 'Namens-Stil gesetzt ✓')} style={[s.style, on && s.on]}>
            <NameText name={me.display} styleId={k} style={s.styleName} />
            <T style={s.cap} numberOfLines={1}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
function EffectPage({ me, patch }: PP) {
  return (
    <View style={s.grid}>
      {[['none', 'Kein Effekt'] as [string, string], ...EFFECTS.map(([k, l]) => [k, l] as [string, string])].map(([k, l]) => {
        const on = (me.effect || 'none') === k;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ effect: k }, 'Effekt gesetzt ✓')} style={[s.fx, on && s.on]}>
            <View style={s.fxDemo}><ProfileFx id={k} dense={0.6} /></View>
            <T style={s.cap} numberOfLines={1}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
function PasswordPage({ say }: { say: (t: string) => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const change = async () => {
    setBusy(true);
    try { await api('POST', '/api/me/password', { old: oldPw, new: newPw }); setOldPw(''); setNewPw(''); say('Passwort geändert ✓'); } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  return (
    <Glass style={s.card} intensity={20}>
      <Field label="Aktuelles Passwort" value={oldPw} onChangeText={setOldPw} secureTextEntry textContentType="password" autoCapitalize="none" />
      <Field label="Neues Passwort" value={newPw} onChangeText={setNewPw} secureTextEntry textContentType="newPassword" autoCapitalize="none" placeholder="mindestens 8 Zeichen" />
      <Btn title="Passwort ändern" busy={busy} onPress={change} disabled={!oldPw || newPw.length < 8} style={{ marginTop: 14 }} />
    </Glass>
  );
}
/** Anrufe und Sprachräume direkt in der App – oder (Ersatzweg) wie früher über die Web-Ansicht. */
function VoicePage() {
  const webCalls = useCalls((c) => c.webCalls);
  return (
    <>
      <Card style={{ padding: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <Icon name="phone" size={20} color={C.accent} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>Anrufe direkt in der App</T>
            <T style={{ color: C.muted, fontSize: 12.5 }}>Anrufe und Sprachräume laufen schneller und stabiler, auch mit gesperrtem Handy.</T>
          </View>
          <Switch value={!webCalls} onValueChange={(on) => setWebCalls(!on)} trackColor={{ true: C.accent, false: C.bg5 }} />
        </View>
      </Card>
      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 10, paddingHorizontal: 4 }}>
        Klappt etwas nicht, schalte es aus – dann laufen Anrufe wie früher über die Web-Ansicht. 3D-Räume und Spiele laufen immer über die Web-Ansicht.
      </T>
    </>
  );
}

function LegalPage() {
  const Link = ({ icon, label, page, last }: { icon: IconName; label: string; page: string; last?: boolean }) => (
    <MenuRow icon={icon} label={label} onPress={() => WebBrowser.openBrowserAsync(LEGAL(page)).catch(() => {})} last={last} />
  );
  return <Card><Link icon="shield" label="Regeln" page="regeln" /><Link icon="lock" label="Datenschutz" page="datenschutz" /><Link icon="globe" label="Impressum" page="impressum" last /></Card>;
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
    Alert.alert('Konto endgültig löschen?', text, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: really }]);
  };
  return (
    <Glass style={[s.card, { borderColor: 'rgba(255,77,94,0.3)' }]} intensity={20}>
      <T style={{ color: C.text2, lineHeight: 21 }}>Dein Konto und alles, was du geschrieben und hochgeladen hast, wird endgültig gelöscht.</T>
      <Field label="Passwort zur Bestätigung" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
      <Btn title="Konto endgültig löschen" kind="danger" icon="trash" disabled={!pw} onPress={del} style={{ marginTop: 14 }} />
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
