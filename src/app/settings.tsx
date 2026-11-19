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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {msg ? <View style={s.msg}><T style={{ color: C.text }}>{msg}</T></View> : null}
        <Section style={s.h2}>Profil</Section>
        <Glass style={s.card} intensity={20}>
          {field({ label: "Anzeigename", value: display, onChangeText: setDisplay, maxLength: 32, })}
          {field({ label: "Status-Text", value: custom, onChangeText: setCustom, maxLength: 80, placeholder: "z. B. „Zocke gerade 🎮“", })}
          {field({ label: "Über mich", value: bio, onChangeText: setBio, maxLength: 300, multiline: true, })}
          <Btn title="Speichern" onPress={() => patch({ display, bio, custom_status: custom })} style={{ marginTop: 14 }} />
        </Glass>
        <Section style={s.h2}>Profilrahmen</Section>
        <Glass style={s.card} intensity={20}>
          <View style={s.frames}>
            {[['none', 'Keiner'], ...Object.entries(FRAMES).map(([k, f]) => [k, f.name])].map(([k, name]) => {
              const on = (me.deco || 'none') === k;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => patch({ deco: k }, 'Rahmen gesetzt ✓')} style={[s.frame, on && s.frameOn]}>
                  <View style={{ height: 84, alignItems: 'center', justifyContent: 'center' }}><Avatar user={{ ...me, deco: k }} force size={k === 'none' ? 48 : Math.min(48, 92 / Math.max(FRAMES[k].w, FRAMES[k].h))} /></View>
                  <T style={s.frameName} numberOfLines={1}>{name}</T>
                </Pressable>
              );
            })}
          </View>
        </Glass>
        <Section style={s.h2}>Passwort ändern</Section>
        <Glass style={s.card} intensity={20}>
          {field({ label: "Aktuelles Passwort", value: oldPw, onChangeText: setOldPw, secureTextEntry: true, textContentType: "password", })}
          {field({ label: "Neues Passwort", value: newPw, onChangeText: setNewPw, secureTextEntry: true, textContentType: "newPassword", placeholder: "mindestens 8 Zeichen", })}
          <Btn title="Passwort ändern" kind="secondary" onPress={changePw} disabled={!oldPw || newPw.length < 8} style={{ marginTop: 14 }} />
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
          <Btn title="Konto endgültig löschen" kind="danger" icon="trash" onPress={del} style={{ marginTop: 14 }} />
        </Glass>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  h2: { marginTop: 22, marginBottom: 8 },
  card: { borderRadius: 18, padding: 14 },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, minHeight: 48, fontSize: 16, fontFamily: F.medium },
  msg: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, borderRadius: 14, padding: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 50, borderRadius: 12 },
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  frame: { width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 8, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.2)' },
  frameOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  frameName: { fontSize: 12, color: C.text2, marginTop: 2, fontWeight: '600' },
});
