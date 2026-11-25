// Freunde: Liste, offene Anfragen, jemanden über den genauen Namen finden (kein Durchblättern – wie in der Web-App).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { api, errText } from '@/lib/api';
import { bootstrap, putUsers, useStore, type User } from '@/lib/store';
import { Avatar, Empty, Glass, Glow, Press, Section, T, TopBar } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { C, F, GRAD, GRAD_POS, R, statusColor } from '@/lib/theme';
import { t } from '@/lib/i18n';

export async function openDm(router: ReturnType<typeof useRouter>, uid: string) {
  const d = await api<any>('POST', '/api/dms', { user_id: uid });
  router.push({ pathname: '/chat/[id]', params: { id: d.dm.id } });
}
export async function setFriend(uid: string, on: boolean) {
  await api('POST', `/api/users/${uid}/friend`, { on });
  await bootstrap();
}
function IconBtn({ name, onPress, label, color = C.text2 }: { name: IconName; onPress: () => void; label: string; color?: string }) {
  return <Press label={label} onPress={onPress} style={s.icon} scale={0.88}><Icon name={name} size={19} color={color} /></Press>;
}
const STATUS_LABEL: Record<string, string> = { online: t("Online"), idle: t("Abwesend"), dnd: t("Bitte nicht stören"), offline: t("Offline") };

export default function Friends() {
  const router = useRouter();
  const f = useStore((s) => s.friends);
  const users = useStore((s) => s.users);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<User[] | null>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'online' | 'all' | 'requests'>('online');
  const search = async () => {
    setMsg('');
    if (q.trim().length < 2) return;
    try { const d = await api<any>('GET', `/api/users?q=${encodeURIComponent(q.trim())}`); putUsers(d.users); setFound(d.users); if (!d.users.length) setMsg(t("Niemand mit genau diesem Namen gefunden.")); }
    catch (e) { setMsg(errText(e)); }
  };
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { setMsg(errText(e)); } };
  const live = (u: User) => users[u.id] || u;
  const online = f.friends.filter((u) => live(u).status && live(u).status !== 'offline');
  const list = tab === 'online' ? online : f.friends;
  const row = (u: User, right: React.ReactNode, i: number) => (
    // Knöpfe rechts stehen NEBEN der antippbaren Zeile, nicht darin (verschachtelte Knöpfe fangen sich gegenseitig die Berührung ab)
    <Animated.View key={u.id} entering={FadeInDown.delay(i * 25).duration(260)} style={s.rowWrap}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })} style={({ pressed }) => [s.row, { flex: 1 }, pressed && { backgroundColor: C.accentSoft }]}>
        <Avatar user={live(u)} size={44} status frame={false} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={s.name} numberOfLines={1}>{live(u).display}</T>
          <T style={s.sub} numberOfLines={1}>{live(u).custom_status || STATUS_LABEL[live(u).status || 'offline'] || '@' + u.username}</T>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, paddingRight: 14 }}>{right}</View>
    </Animated.View>
  );
  const tabs: [typeof tab, string, number][] = [['online', 'Online', online.length], ['all', 'Alle', f.friends.length], ['requests', 'Anfragen', f.incoming.length + f.outgoing.length]];
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <TopBar title={t("Freunde")} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Glass style={s.search} intensity={20} tint="rgba(19,20,32,0.8)">
            <Icon name="search" size={18} color={C.faint} />
            <TextInput style={s.input} value={q} onChangeText={setQ} onSubmitEditing={search} placeholder={t("Genauen Namen eingeben, z. B. @lena")} placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
            <Press label={t("Suchen")} onPress={search} style={s.searchBtn} scale={0.9}><LinearGradient colors={GRAD as any} locations={GRAD_POS as any} style={StyleSheet.absoluteFill} /><View><Icon name="userPlus" size={18} color="#fff" /></View></Press>
          </Glass>
          {msg ? <T style={s.msg}>{msg}</T> : null}
          {found?.map((u, i) => row(u, <IconBtn name="userPlus" color={C.accent} label={t("Freund hinzufügen")} onPress={() => act(() => setFriend(u.id, true).then(() => setMsg(t("Anfrage geschickt ✓"))))} />, i))}
          <View style={s.tabs}>
            {tabs.map(([k, l, n]) => (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
                <T style={[s.tabText, tab === k && { color: C.text }]}>{l}</T>
                {n ? <View style={[s.count, k === 'requests' && f.incoming.length ? { backgroundColor: C.accent2 } : null]}><T style={s.countText}>{n}</T></View> : null}
              </Pressable>
            ))}
          </View>
          {tab === 'requests' ? <>
            {f.incoming.length ? <Section style={s.sec}>{t("Eingegangen –")}{' '}{f.incoming.length}</Section> : null}
            {f.incoming.map((u, i) => row(u, <><IconBtn name="check" color={C.ok} label={t("Annehmen")} onPress={() => act(() => setFriend(u.id, true))} /><IconBtn name="x" color={C.danger} label={t("Ablehnen")} onPress={() => act(() => setFriend(u.id, false))} /></>, i))}
            {f.outgoing.length ? <Section style={s.sec}>{t("Gesendet –")}{' '}{f.outgoing.length}</Section> : null}
            {f.outgoing.map((u, i) => row(u, <IconBtn name="x" label={t("Anfrage zurückziehen")} onPress={() => act(() => setFriend(u.id, false))} />, i))}
            {!f.incoming.length && !f.outgoing.length ? <Empty icon="userPlus" title={t("Keine offenen Anfragen")} text={t("Such oben nach dem genauen Namen, um jemanden hinzuzufügen.")} /> : null}
          </> : <>
            <Section style={s.sec}>{tab === 'online' ? t("Online") : t("Alle Freunde")} – {list.length}</Section>
            {!list.length ? <Empty icon="users" title={tab === 'online' ? t("Gerade niemand online") : t("Noch keine Freunde")} text={tab === 'online' ? t("Schau später nochmal vorbei.") : t("Such oben nach dem genauen Namen und schick eine Anfrage.")} /> : null}
            {list.map((u, i) => row(u, <IconBtn name="comment" label={t("Nachricht")} onPress={() => act(() => openDm(router, u.id))} />, i))}
          </>}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingLeft: 14, paddingRight: 6, height: 54 },
  input: { flex: 1, color: C.text, fontSize: 16, fontFamily: F.medium, height: 50 },
  searchBtn: { width: 42, height: 42, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  msg: { color: C.muted, marginTop: 10 },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 18, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.line },
  tab: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tabOn: { backgroundColor: C.bg4 },
  tabText: { color: C.muted, fontWeight: '700', fontSize: 14 },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: C.bg5, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  sec: { marginTop: 20, marginBottom: 6 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14 },
  name: { fontSize: 16, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13, marginTop: -2 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
