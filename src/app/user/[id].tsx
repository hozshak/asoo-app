// Profil einer Person als großes Blatt wie die Profilkarte der Web-App: Banner, Rahmen, Über mich,
// Nachricht, Freund werden, Blockieren, Melden (Pflicht für Apps mit Inhalten von Nutzern).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, errText, mediaSource } from '@/lib/api';
import { bootstrap, putUsers, useStore } from '@/lib/store';
import { Avatar, Btn, Glass, Glow, Section, ServerIcon, Sheet, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { openDm, setFriend } from '../(tabs)/friends';
import { C } from '@/lib/theme';

const REASONS: [string, string][] = [['spam', 'Spam'], ['harassment', 'Belästigung oder Mobbing'], ['hate', 'Hass oder Hetze'], ['violence', 'Gewalt oder Drohung'], ['sexual', 'Sexuelle Inhalte'], ['minor_safety', 'Gefahr für Minderjährige'], ['impersonation', 'Gibt sich als jemand anderes aus'], ['other', 'Etwas anderes']];

export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const meId = useStore((s) => s.me?.id);
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState(false);
  const [more, setMore] = useState(false);
  const load = async () => { try { const x = await api<any>('GET', `/api/users/${id}`); putUsers([x.user]); setD(x); } catch (e) { setMsg(errText(e)); } };
  useEffect(() => { load(); }, [id]);
  if (!d) return <View style={{ flex: 1, backgroundColor: C.bg1, alignItems: 'center', justifyContent: 'center' }}>{msg ? <T style={{ color: C.muted }}>{msg}</T> : <ActivityIndicator color={C.accent} />}</View>;
  const u = d.user, me = u.id === meId;
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); await load(); if (ok) setMsg(ok); } catch (e) { setMsg(errText(e)); } };
  const banner = mediaSource(u.banner);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={s.banner}>
          {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <LinearGradient colors={[u.banner_color || u.accent || C.accent, '#ff5c9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['transparent', 'rgba(7,7,13,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={s.grab} />
          <Pressable accessibilityLabel="Schließen" onPress={() => router.back()} style={s.close}><Icon name="x" size={18} color="#fff" /></Pressable>
          {!me && !u.deleted ? <Pressable accessibilityLabel="Mehr" onPress={() => setMore(true)} style={[s.close, { left: undefined, right: 12 }]}><Icon name="more" size={18} color="#fff" /></Pressable> : null}
        </View>
        <Animated.View entering={FadeInDown.duration(350)} style={s.head}>
          <View style={s.avWrap}><Avatar user={u} size={100} status live /></View>
          <T style={s.name}>{u.display}</T>
          <T style={s.handle}>@{u.username}{u.pronouns ? ' · ' + u.pronouns : ''}</T>
          {u.custom_status ? <View style={s.bubble}><T style={{ color: C.text2 }}>{u.custom_status}</T></View> : null}
        </Animated.View>
        {!me && !u.deleted && !d.blocked ? <View style={s.actions}>
          {d.friend === 'friends' ? <Btn title="Nachricht" icon="comment" onPress={() => openDm(router, u.id).catch((e) => setMsg(errText(e)))} style={{ flex: 1 }} /> : null}
          {d.friend === 'none' ? <Btn title="Freund hinzufügen" icon="userPlus" onPress={() => act(() => setFriend(u.id, true), 'Anfrage geschickt ✓')} style={{ flex: 1 }} /> : null}
          {d.friend === 'in' ? <Btn title="Anfrage annehmen" icon="check" onPress={() => act(() => setFriend(u.id, true))} style={{ flex: 1 }} /> : null}
          {d.friend === 'out' ? <Btn title="Anfrage gesendet" icon="clock" kind="secondary" onPress={() => act(() => setFriend(u.id, false))} style={{ flex: 1 }} /> : null}
        </View> : null}
        {d.blocked ? <View style={s.actions}><Btn title="Blockierung aufheben" icon="ban" kind="secondary" onPress={() => act(() => api('POST', `/api/users/${u.id}/block`, { on: false }).then(bootstrap))} style={{ flex: 1 }} /></View> : null}
        {msg ? <T style={s.msg}>{msg}</T> : null}
        {u.bio ? <Glass style={s.card} intensity={20}><Section>Über mich</Section><T style={s.bio}>{u.bio}</T></Glass> : null}
        <Glass style={s.card} intensity={20}>
          <Section>Dabei seit</Section>
          <T style={s.bio}>{new Date(u.created).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</T>
          {d.mutual_servers?.length && !me ? <>
            <Section style={{ marginTop: 14 }}>{d.mutual_servers.length} gemeinsame Server</Section>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{d.mutual_servers.slice(0, 8).map((sv: any) => <ServerIcon key={sv.id} server={sv} size={36} />)}</View>
          </> : null}
        </Glass>
      </ScrollView>
      <Sheet open={more} onClose={() => setMore(false)} items={[
        d.friend === 'friends' ? { label: 'Freundschaft beenden', icon: 'minusCircle', onPress: () => act(() => setFriend(u.id, false)) } : null,
        !d.blocked ? { label: 'Blockieren', icon: 'ban', danger: true, onPress: () => act(() => api('POST', `/api/users/${u.id}/block`, { on: true }).then(bootstrap), 'Blockiert. Ihr seht keine Nachrichten mehr voneinander.') } : null,
        { label: 'Melden', icon: 'flag', danger: true, onPress: () => setReport(true) },
      ]} />
      <Sheet open={report} onClose={() => setReport(false)} title="Warum meldest du diese Person?" items={REASONS.map(([k, l]) => ({ label: l, onPress: () => act(() => api('POST', '/api/reports', { type: 'user', id: u.id, reason: k }), 'Danke – wir sehen uns die Meldung an.') }))} />
    </View>
  );
}
const s = StyleSheet.create({
  banner: { height: 150, overflow: 'hidden' },
  grab: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  close: { position: 'absolute', left: 12, top: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -56, paddingHorizontal: 16 },
  avWrap: { borderRadius: 70, borderWidth: 6, borderColor: C.bg0 },
  name: { fontSize: 27, fontWeight: '800', marginTop: 10, letterSpacing: -0.4 },
  handle: { color: C.muted, fontSize: 15, marginTop: -2 },
  bubble: { marginTop: 10, backgroundColor: C.bg3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 },
  card: { marginHorizontal: 16, marginTop: 14, borderRadius: 18, padding: 14 },
  bio: { color: C.text2, lineHeight: 22, marginTop: 4 },
  msg: { color: C.warn, textAlign: 'center', padding: 10 },
});
