// Einstellungen – kompakt wie die iPhone-Einstellungen: oben eine kurze Liste, jeder Punkt öffnet eine eigene Seite
// (/settings?page=…). Alles nativ: Profil, Bild/Banner/Farben, Rahmen, Namens-Stil, Effekt, Privatsphäre, Mitteilungen,
// Passwort, Rechtliches, Konto löschen (Apple verlangt das Löschen in der App).
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, BASE, errText, saveToken } from '@/lib/api';
import { clearState, setState, useStore } from '@/lib/store';
import { disconnect } from '@/lib/live';
import { unregisterPush } from '@/lib/push';
import { Avatar, Btn, Card, Glass, Glow, MenuRow, Section, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { FRAMES } from '@/lib/frames';
import { NameText, NAME_STYLES } from '@/components/NameText';
import { EFFECTS, ProfileFx } from '@/components/ProfileFx';
import { LookSection, PrivacySection, PushSection } from '@/components/SettingsMore';
import { C, F, R } from '@/lib/theme';

const LEGAL = (p: string) => (BASE || 'https://zuno-app.altraex.workers.dev') + '/legal/' + p + '.html';
type Page = 'profile' | 'look' | 'frame' | 'name' | 'effect' | 'privacy' | 'push' | 'password' | 'legal' | 'delete';
const TITLES: Record<Page, string> = { profile: 'Profil', look: 'Bild, Banner & Farben', frame: 'Profilrahmen', name: 'Namens-Stil', effect: 'Profil-Effekt', privacy: 'Privatsphäre & Geräte', push: 'Mitteilungen', password: 'Passwort', legal: 'Rechtliches', delete: 'Konto löschen' };

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
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: p ? TITLES[p] : 'Einstellungen' }} />
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {!p ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => open('profile')}>
              <Glass style={s.head} intensity={20}>
                <Avatar user={me} size={56} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <NameText name={me.display} styleId={me.name_style} style={{ fontSize: 19, fontWeight: '800' }} />
                  <T style={s.sub} numberOfLines={1}>@{me.username}{me.custom_status ? ' · ' + me.custom_status : ''}</T>
                </View>
                <Icon name="chevron" size={14} color={C.faint} />
              </Glass>
            </Pressable>
            <Section style={s.h2}>Aussehen</Section>
            <Card>
              <MenuRow icon="image" label="Bild, Banner & Farben" onPress={() => open('look')} />
              <MenuRow icon="sparkle" label="Profilrahmen" sub={frameName || 'Keiner'} onPress={() => open('frame')} />
              <MenuRow icon="edit" label="Namens-Stil" onPress={() => open('name')} />
              <MenuRow icon="moon" label="Profil-Effekt" onPress={() => open('effect')} last />
            </Card>
            <Section style={s.h2}>Konto</Section>
            <Card>
              <MenuRow icon="lock" label="Privatsphäre & Geräte" sub="Wer schreiben darf, Blockierte, angemeldete Geräte" onPress={() => open('privacy')} />
              <MenuRow icon="bell" label="Mitteilungen" onPress={() => open('push')} />
              <MenuRow icon="shield" label="Passwort ändern" onPress={() => open('password')} last />
            </Card>
            <Section style={s.h2}>Mehr</Section>
            <Card>
              <MenuRow icon="globe" label="Rechtliches" sub="Regeln, Datenschutz, Impressum" onPress={() => open('legal')} />
              <MenuRow icon="trash" label="Konto löschen" danger onPress={() => open('delete')} last />
            </Card>
          </>
        ) : p === 'profile' ? <ProfilePage me={me} patch={patch} />
          : p === 'look' ? <LookSection patch={patch} say={setMsg} />
          : p === 'frame' ? <FramePage me={me} patch={patch} />
          : p === 'name' ? <NamePage me={me} patch={patch} />
          : p === 'effect' ? <EffectPage me={me} patch={patch} />
          : p === 'privacy' ? <PrivacySection patch={patch} say={setMsg} />
          : p === 'push' ? <PushSection say={setMsg} />
          : p === 'password' ? <PasswordPage say={setMsg} />
          : p === 'legal' ? <LegalPage />
          : <DeletePage say={setMsg} />}
      </ScrollView>
      {msg ? <View style={s.toast} pointerEvents="none"><T style={{ fontWeight: '700' }}>{msg}</T></View> : null}
    </View>
  );
}

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
