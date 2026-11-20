// Einstellungen: Profil, Profilrahmen, Passwort, Rechtliches, Konto löschen (Apple verlangt das Löschen in der App).
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { api, BASE, errText, saveToken } from '@/lib/api';
import { clearState, setState, useStore } from '@/lib/store';
import { disconnect } from '@/lib/live';
import { unregisterPush } from '@/lib/push';
import { Avatar, Btn, Glass, Glow, Section, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { FRAMES } from '@/lib/frames';
import { NameText, NAME_STYLES } from '@/components/NameText';
import { EFFECTS, ProfileFx } from '@/components/ProfileFx';
import { C, F, R } from '@/lib/theme';

const LEGAL = (p: string) => (BASE || 'https://zuno-app.altraex.workers.dev') + '/legal/' + p + '.html';

export default function Settings() {
  const me = useStore((s) => s.me) as any;
  const [display, setDisplay] = useState(me?.display || '');
  const [bio, setBio] = useState(me?.bio || '');
  const [custom, setCustom] = useState(me?.custom_status || '');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [delPw, setDelPw] = useState('');
  const [msg, setMsg] = useState('');
  if (!me) return null;
  const patch = async (body: any, ok = 'Gespeichert ✓') => {
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); setMsg(ok); } catch (e) { setMsg(errText(e)); }
  };
  const changePw = async () => {
    try { await api('POST', '/api/me/password', { old: oldPw, new: newPw }); setOldPw(''); setNewPw(''); setMsg('Passwort geändert ✓'); } catch (e) { setMsg(errText(e)); }
  };
  const reallyDelete = async () => {
    try { await api('POST', '/api/me/delete', { password: delPw }); await unregisterPush(); disconnect(); await saveToken(null); clearState(); }
    catch (e) { setMsg(errText(e)); }
  };
  const del = () => {
    if (!delPw) { setMsg('Gib zur Bestätigung dein Passwort ein.'); return; }
    const text = 'Profil, Nachrichten, Bilder, Freundschaften und Mitgliedschaften werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.';
    if (Platform.OS === 'web') { if (confirm(text)) reallyDelete(); return; }
    Alert.alert('Konto endgültig löschen?', text, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: reallyDelete }]);
  };
  const field = ({ label, ...p }: any) => (<><T style={s.label}>{label}</T><TextInput placeholderTextColor={C.faint} {...p} style={[s.input, p.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }]} /></>);
  const Link = ({ icon, label, page }: { icon: IconName; label: string; page: string }) => (
    <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(LEGAL(page))} style={({ pressed }) => [s.link, pressed && { backgroundColor: C.accentSoft }]}>
      <Icon name={icon} size={18} color={C.text2} /><T style={{ flex: 1, fontWeight: '600' }}>{label}</T><Icon name="chevron" size={14} color={C.faint} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {msg ? <View style={s.msg}><T style={{ color: C.text }}>{msg}</T></View> : null}
        <Section style={s.h2}>Profil</Section>
        <Glass style={s.card} intensity={20}>
          {field({ label: "Anzeigename", value: display, onChangeText: setDisplay, maxLength: 32, })}
          {field({ label: "Status-Text", value: custom, onChangeText: setCustom, maxLength: 80, placeholder: "z. B. „Zocke gerade 🎮“", })}
          {field({ label: "Über mich", value: bio, onChangeText: setBio, maxLength: 300, multiline: true, })}
          <Btn title="Speichern" onPress={() => patch({ display, bio, custom_status: custom })} small style={{ marginTop: 12 }} />
        </Glass>
        <Section style={s.h2}>Profilrahmen</Section>
        <Glass style={s.card} intensity={20}>
          <View style={s.frames}>
            {[['none', 'Keiner'], ...Object.entries(FRAMES).map(([k, f]) => [k, f.name])].map(([k, name]) => {
              const on = (me.deco || 'none') === k;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ deco: k }, 'Rahmen gesetzt ✓')} style={[s.frame, on && s.frameOn]}>
                  <View style={{ height: 62, alignItems: 'center', justifyContent: 'center' }}><Avatar user={{ ...me, deco: k }} force size={k === 'none' ? 38 : Math.min(38, 70 / Math.max(FRAMES[k].w, FRAMES[k].h))} /></View>
                  <T style={s.frameName} numberOfLines={1}>{name}</T>
                </Pressable>
              );
            })}
          </View>
        </Glass>
        <Section style={s.h2}>Namens-Stil</Section>
        <Glass style={s.card} intensity={20}>
          <View style={s.frames}>
            {NAME_STYLES.map(([k, l]) => {
              const on = (me.name_style || 'default') === k;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ name_style: k }, 'Namens-Stil gesetzt ✓')} style={[s.style, on && s.frameOn]}>
                  <NameText name={me.display} styleId={k} style={s.styleName} />
                  <T style={s.frameName} numberOfLines={1}>{l}</T>
                </Pressable>
              );
            })}
          </View>
        </Glass>
        <Section style={s.h2}>Profil-Effekt</Section>
        <Glass style={s.card} intensity={20}>
          <View style={s.frames}>
            {[['none', 'Kein Effekt'] as [string, string], ...EFFECTS.map(([k, l]) => [k, l] as [string, string])].map(([k, l]) => {
              const on = (me.effect || 'none') === k;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ effect: k }, 'Effekt gesetzt ✓')} style={[s.fx, on && s.frameOn]}>
                  <View style={s.fxDemo}><ProfileFx id={k} dense={0.6} /></View>
                  <T style={s.frameName} numberOfLines={1}>{l}</T>
                </Pressable>
              );
            })}
          </View>
        </Glass>
        <Section style={s.h2}>Passwort ändern</Section>
        <Glass style={s.card} intensity={20}>
          {field({ label: "Aktuelles Passwort", value: oldPw, onChangeText: setOldPw, secureTextEntry: true, textContentType: "password", })}
          {field({ label: "Neues Passwort", value: newPw, onChangeText: setNewPw, secureTextEntry: true, textContentType: "newPassword", placeholder: "mindestens 8 Zeichen", })}
          <Btn title="Passwort ändern" kind="secondary" onPress={changePw} disabled={!oldPw || newPw.length < 8} small style={{ marginTop: 12 }} />
        </Glass>
        <Section style={s.h2}>Rechtliches</Section>
        <Glass style={[s.card, { padding: 6 }]} intensity={20}>
          <Link icon="shield" label="Regeln" page="regeln" />
          <Link icon="lock" label="Datenschutz" page="datenschutz" />
          <Link icon="globe" label="Impressum" page="impressum" />
        </Glass>
        <Section style={[s.h2, { color: C.danger }]}>Konto löschen</Section>
        <Glass style={[s.card, { borderColor: 'rgba(255,77,94,0.3)' }]} intensity={20}>
          <T style={{ color: C.text2, lineHeight: 21 }}>Dein Konto und alles, was du geschrieben und hochgeladen hast, wird endgültig gelöscht.</T>
          {field({ label: "Passwort zur Bestätigung", value: delPw, onChangeText: setDelPw, secureTextEntry: true, })}
          <Btn title="Konto endgültig löschen" kind="danger" icon="trash" onPress={del} small style={{ marginTop: 12 }} />
        </Glass>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  h2: { marginTop: 16, marginBottom: 6 },
  card: { borderRadius: 16, padding: 12 },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 8, marginBottom: 5 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 13, minHeight: 44, fontSize: 15.5, fontFamily: F.medium },
  msg: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, borderRadius: 14, padding: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 44, borderRadius: 12 },
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frame: { width: '23.3%', alignItems: 'center', paddingVertical: 4, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)' },
  frameOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  style: { width: '31.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 2, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)' },
  styleName: { fontSize: 16, fontWeight: '800', maxWidth: '100%' },
  fx: { width: '31.5%', alignItems: 'center', paddingBottom: 6, gap: 4, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)', overflow: 'hidden' },
  fxDemo: { width: '100%', height: 54, backgroundColor: '#1d1838' },
  frameName: { fontSize: 11, color: C.text2, marginTop: 0, fontWeight: '600', paddingHorizontal: 2 },
});
