// Mitglieder eines Servers – wie die Liste rechts in der Web-App: Besitzer, getrennt angezeigte Rollen, Admins, Mods,
// Online, Offline. Antippen öffnet das Profil.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { errText } from '@/lib/api';
import { loadMembers, serverOf, useStore, type User } from '@/lib/store';
import { Avatar, Empty, Glow, Section, T, TopBar } from '@/components/ui';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

type Member = User & { role: string; roles?: string[]; nick?: string | null };
const LABEL: Record<string, string> = { owner: t("Besitzer"), admin: t("Admins"), mod: t("Moderatoren"), online: t("Online"), offline: t("Offline") };

export default function Members() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const router = useRouter();
  const users = useStore((s) => s.users); // Online-Status kommt live über den Store
  const server = useStore((s) => s.servers.find((x) => x.id === sid) || null);
  const [list, setList] = useState<Member[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { loadMembers(sid).then(setList).catch((e) => setErr(errText(e))); }, [sid]);

  const hoisted = (serverOf(sid)?.roles || []).filter((r) => r.hoist).sort((a, b) => a.position - b.position);
  const groups: [string, string, string | null, Member[]][] = [['owner', LABEL.owner, null, []], ...hoisted.map((r) => ['r:' + r.id, r.name, r.color || null, []] as [string, string, string | null, Member[]]),
    ['admin', LABEL.admin, null, []], ['mod', LABEL.mod, null, []], ['online', LABEL.online, null, []], ['offline', LABEL.offline, null, []]];
  const add = (k: string, m: Member) => groups.find((g) => g[0] === k)![3].push(m);
  for (const m0 of list || []) {
    const m = { ...m0, ...(users[m0.id] || {}), role: m0.role, roles: m0.roles, nick: m0.nick } as Member;
    const off = !m.status || m.status === 'offline';
    const top = hoisted.find((r) => (m.roles || []).includes(r.id));
    if (off) add('offline', m);
    else if (m.role === 'owner') add('owner', m);
    else if (top) add('r:' + top.id, m);
    else if (m.role === 'admin' || m.role === 'mod') add(m.role, m);
    else add('online', m);
  }
  const colorOf = (m: Member) => (serverOf(sid)?.roles || []).find((r) => r.color && (m.roles || []).includes(r.id))?.color || C.text;
  let i = 0;
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <TopBar title={server ? t("Mitglieder · {0}", { 0: server.name }) : t("Mitglieder")} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {!list && !err ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {err ? <T style={s.err}>{err}</T> : null}
          {list && !list.length ? <Empty icon="users" title={t("Noch keine Mitglieder")} text={t("Lade Leute über eine Einladung ein.")} /> : null}
          {groups.filter((g) => g[3].length).map(([k, label, color, ms]) => (
            <View key={k}>
              <Section style={s.sec}>{`${label} – ${ms.length}`}</Section>
              {ms.sort((a, b) => (a.nick || a.display).localeCompare(b.nick || b.display)).map((m) => (
                <Animated.View key={m.id} entering={FadeInDown.delay(Math.min(i++, 20) * 20).duration(240)}>
                  <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/user/[id]', params: { id: m.id } })} style={({ pressed }) => [s.row, k === 'offline' && { opacity: 0.55 }, pressed && { backgroundColor: C.accentSoft }]}>
                    <Avatar user={m} size={42} status frame={false} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={[s.name, { color: color || colorOf(m) }]} numberOfLines={1}>{m.nick || m.display}</T>
                      {m.custom_status ? <T style={s.sub} numberOfLines={1}>{m.custom_status}</T> : <T style={s.sub} numberOfLines={1}>@{m.username}</T>}
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sec: { marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 14 },
  name: { fontSize: 16, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13, marginTop: -2 },
  err: { color: C.warn, marginBottom: 10 },
});
