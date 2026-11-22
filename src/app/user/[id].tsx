// Profil einer Person (Tippen auf jemanden im Chat): Banner, Rahmen, Name, Status, darunter klare Knöpfe
// (Nachricht, Anrufen, Freund …), Über mich, gemeinsame Server. Blockieren und Melden über „…“ (Pflicht im App Store).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, errText, mediaSource } from '@/lib/api';
import { bootstrap, putUsers, useStore } from '@/lib/store';
import { openWeb } from '@/lib/web';
import { openServer } from '@/components/InviteCard';
import { ProfileHead } from '@/components/ProfileHead';
import { Avatar, Btn, Card, Glow, Section, ServerIcon, Sheet, T } from '@/components/ui';
import { CallConfirm, type CallKind } from '@/components/CallConfirm';
import { Icon, type IconName } from '@/components/Icon';
import { openDm, setFriend } from '../(tabs)/friends';
import { C, statusColor } from '@/lib/theme';

const REASONS: [string, string][] = [['spam', 'Spam'], ['harassment', 'Belästigung oder Mobbing'], ['hate', 'Hass oder Hetze'], ['violence', 'Gewalt oder Drohung'], ['sexual', 'Sexuelle Inhalte'], ['minor_safety', 'Gefahr für Minderjährige'], ['impersonation', 'Gibt sich als jemand anderes aus'], ['other', 'Etwas anderes']];
const STATUS_TEXT: Record<string, string> = { online: 'Online', idle: 'Abwesend', dnd: 'Bitte nicht stören', offline: 'Offline' };

function Action({ icon, label, onPress, color = C.accent }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}>
      <View style={[s.actionIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}><Icon name={icon} size={20} color={color} stroke={2.2} /></View>
      <T style={s.actionText} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const meId = useStore((s) => s.me?.id);
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState<CallKind | null>(null);
  const [report, setReport] = useState(false);
  const [more, setMore] = useState(false);
  const load = async () => { try { const x = await api<any>('GET', `/api/users/${id}`); putUsers([x.user]); setD(x); } catch (e) { setMsg(errText(e)); } };
  useEffect(() => { load(); }, [id]);
  if (!d) return <View style={{ flex: 1, backgroundColor: C.bg1, alignItems: 'center', justifyContent: 'center' }}>{msg ? <T style={{ color: C.muted }}>{msg}</T> : <ActivityIndicator color={C.accent} />}</View>;
  const u = d.user, me = u.id === meId;
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); await load(); if (ok) setMsg(ok); } catch (e) { setMsg(errText(e)); } };
  const banner = mediaSource(u.banner);
  const call = async () => { try { const x = await api<any>('POST', '/api/dms', { user_id: u.id }); openWeb(router, `/channels/@me/${x.dm.id}?call=1`); } catch (e) { setMsg(errText(e)); } };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <CallConfirm kind={ask} who={u} name={u?.display || ''} onClose={() => setAsk(null)} onStart={() => call()} />
      <Glow />
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 30 }} bounces>
        <ProfileHead u={u}
          topLeft={<Pressable accessibilityLabel="Schließen" hitSlop={8} onPress={() => router.back()} style={s.round}><Icon name="x" size={17} color="#fff" stroke={2.4} /></Pressable>}
          topRight={!me && !u.deleted ? <Pressable accessibilityLabel="Mehr" hitSlop={8} onPress={() => setMore(true)} style={s.round}><Icon name="more" size={18} color="#fff" /></Pressable> : undefined} />
        <View style={s.grab} />

        {!me && !u.deleted && !d.blocked ? <View style={s.actions}>
          {d.friend === 'friends' ? <>
            <Action icon="comment" label="Nachricht" onPress={() => openDm(router, u.id).catch((e) => setMsg(errText(e)))} />
            <Action icon="phone" label="Anrufen" color={C.ok} onPress={() => setAsk('voice')} />
          </> : null}
          {d.friend === 'none' ? <Action icon="userPlus" label="Hinzufügen" onPress={() => act(() => setFriend(u.id, true), 'Anfrage geschickt ✓')} /> : null}
          {d.friend === 'in' ? <Action icon="check" label="Annehmen" color={C.ok} onPress={() => act(() => setFriend(u.id, true))} /> : null}
          {d.friend === 'out' ? <Action icon="clock" label="Angefragt" color={C.muted} onPress={() => act(() => setFriend(u.id, false), 'Anfrage zurückgezogen')} /> : null}
          <Action icon="more" label="Mehr" color={C.text2} onPress={() => setMore(true)} />
        </View> : null}
        {d.blocked ? <View style={{ paddingHorizontal: 16, marginTop: 16 }}><Btn title="Blockierung aufheben" icon="ban" kind="secondary" onPress={() => act(() => api('POST', `/api/users/${u.id}/block`, { on: false }).then(bootstrap))} /></View> : null}
        {msg ? <T style={s.msg}>{msg}</T> : null}

        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 16 }}>
          {u.bio ? <Card style={s.card}><Section>Über mich</Section><T style={s.bio}>{u.bio}</T></Card> : null}
          <Card style={s.card}>
            <Section>Dabei seit</Section>
            <T style={s.bio}>{new Date(u.created).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</T>
            {d.mutual_servers?.length && !me ? <>
              <Section style={{ marginTop: 14 }}>{d.mutual_servers.length === 1 ? '1 gemeinsamer Server' : `${d.mutual_servers.length} gemeinsame Server`}</Section>
              <View style={s.servers}>{d.mutual_servers.slice(0, 12).map((sv: any) => (
                <Pressable key={sv.id} accessibilityLabel={sv.name} onPress={() => openServer(router, sv.id)} style={s.server}>
                  <ServerIcon server={sv} size={34} />
                  <T style={s.serverName} numberOfLines={1}>{sv.name}</T>
                </Pressable>
              ))}</View>
            </> : null}
          </Card>
        </View>
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
  banner: { height: 130, overflow: 'hidden' },
  grab: { position: 'absolute', top: 6, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -54, paddingHorizontal: 20 },
  avWrap: { borderRadius: 60, borderWidth: 5, borderColor: C.bg0 },
  name: { fontSize: 25, fontWeight: '800', marginTop: 8, letterSpacing: -0.3, maxWidth: '100%' },
  handle: { color: C.muted, fontSize: 14.5, marginTop: -2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { color: C.text2, fontSize: 13, fontWeight: '700' },
  bubble: { marginTop: 10, backgroundColor: C.bg3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, maxWidth: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 18, paddingHorizontal: 16 },
  action: { alignItems: 'center', gap: 6, minWidth: 64 },
  actionIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionText: { color: C.text2, fontSize: 12.5, fontWeight: '700' },
  card: { padding: 14 },
  bio: { color: C.text2, lineHeight: 21, marginTop: 4 },
  servers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  server: { width: 64, alignItems: 'center', gap: 4 },
  serverName: { color: C.muted, fontSize: 11, maxWidth: 64 },
  msg: { color: C.warn, textAlign: 'center', padding: 10 },
});
