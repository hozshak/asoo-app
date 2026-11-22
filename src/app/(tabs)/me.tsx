// Ich – wie bei Discord: großes Banner bis unter die Statusleiste, Profilbild links mit Rahmen, Name und Status,
// „Profil bearbeiten“, Status-Zeile, „Über mich“ und „Mitglied seit“. Alles Weitere (3D-Avatar, Feed, Server entdecken,
// Admin, Abmelden) steckt hinter dem Zahnrad in den Einstellungen – keine lange Knopf-Liste mehr.
// Der Profil-Effekt liegt über dem ganzen Bildschirm, damit er nirgends abgeschnitten wird.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { pickImage as chooseImage } from '@/lib/pick';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { signOut } from '@/lib/session';
import { openWeb } from '@/lib/web';
import { Card, Glow, MenuRow, T, Btn } from '@/components/ui';
import { ProfileHead } from '@/components/ProfileHead';
import { ProfileFx } from '@/components/ProfileFx';
import { Icon } from '@/components/Icon';
import { StatusGlyph, StatusSheet, statusLabel } from '@/components/MeBar';
import { frameOf } from '@/lib/frames';
import { C, statusColor } from '@/lib/theme';

const STATUS: [string, string][] = [['online', 'Online'], ['idle', 'Abwesend'], ['dnd', 'Bitte nicht stören'], ['invisible', 'Unsichtbar']];

export default function Me() {
  const router = useRouter();
  const me = useStore((s) => s.me) as any;
  const [msg, setMsg] = useState('');
  const [sheet, setSheet] = useState(false);
  if (!me) return null;
  const patch = async (body: any) => {
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); } catch (e) { setMsg(errText(e)); }
  };
  const pickAvatar = async () => {
    const r = await chooseImage({ title: 'Profilbild ändern', crop: [1, 1], maxSide: 768, onWork: () => setMsg('Bild wird vorbereitet …') });
    if (!r) return;
    setMsg('Profilbild wird hochgeladen …');
    try { const up = await upload('avatar', r.uri, r.mime); await patch({ avatar: up.key }); setMsg('Profilbild gespeichert ✓'); } catch (e) { setMsg(errText(e)); }
  };
  const banner = mediaSource(me.banner);
  const raw = me.status_raw || me.status;
  const frame = frameOf(me.deco)?.name || '';
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ProfileHead u={me} status={raw} onAvatar={pickAvatar} safeTop
          topRight={<Pressable accessibilityLabel="Einstellungen" onPress={() => router.push('/settings')} style={s.gear}><Icon name="gear" size={19} color="#fff" /></Pressable>}>
        </ProfileHead>

        {/* wie bei Discord: Status als eine Zeile (antippen = Auswahl von unten) und groß „Profil bearbeiten“ */}
        <View style={{ paddingHorizontal: 16, marginTop: 14, gap: 10 }}>
          <Btn title="Profil bearbeiten" icon="edit" onPress={() => router.push({ pathname: '/settings', params: { page: 'profile' } })} />
          <Pressable accessibilityRole="button" accessibilityLabel="Status ändern" onPress={() => setSheet(true)} style={({ pressed }) => [s.stRow, pressed && { backgroundColor: C.accentSoft }]}>
            <StatusGlyph k={raw || 'online'} size={14} />
            <T style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{statusLabel(raw)}{me.custom_status ? ' · ' + me.custom_status : ''}</T>
            <T style={{ color: C.muted, fontSize: 13 }}>Ändern</T>
            <Icon name="chevron" size={15} color={C.muted} />
          </Pressable>
        </View>
        <StatusSheet open={sheet} onClose={() => setSheet(false)} />
        {msg ? <T style={s.msg}>{msg}</T> : null}

        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 14 }}>
          {me.bio ? <Card style={s.card}><T style={s.cardTitle}>Über mich</T><T style={s.bio}>{me.bio}</T></Card> : null}
          {me.created ? <Card style={s.card}><T style={s.cardTitle}>Mitglied seit</T><T style={s.bio}>{new Date(me.created).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</T></Card> : null}
        </View>
      </ScrollView>
      <ProfileFx id={me.effect} />
    </View>
  );
}
const s = StyleSheet.create({
  banner: { height: 130, overflow: 'hidden' },
  gear: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -52, paddingHorizontal: 20 },
  avWrap: { borderRadius: 60, borderWidth: 5, borderColor: C.bg0 },
  cam: { position: 'absolute', right: 2, top: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg0 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -0.3, maxWidth: '100%' },
  handle: { color: C.muted, fontSize: 14, marginTop: -2 },
  custom: { color: C.text2, fontSize: 14, marginTop: 6, textAlign: 'center' },
  bio: { color: C.text2, fontSize: 14.5, marginTop: 4, lineHeight: 20 },
  card: { padding: 14 },
  cardTitle: { color: C.muted, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 14 },
  st: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, paddingHorizontal: 6 },
  stOn: { backgroundColor: C.accentSoft, borderColor: C.accentLine },
  stText: { color: C.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  msg: { color: C.warn, paddingHorizontal: 16, paddingTop: 8 },
});
