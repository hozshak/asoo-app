// Mitteilungen: Erwähnungen, Antworten, Freundschaftsanfragen … Tippen öffnet die Stelle.
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '@/lib/api';
import { setState, type Notif } from '@/lib/store';
import { Avatar, Empty, Glow, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { timeLabel } from '@/lib/text';
import { C } from '@/lib/theme';

const KIND: Record<string, [string, IconName, string]> = {
  mention: ['hat dich erwähnt', 'at', C.warn], reply: ['hat dir geantwortet', 'reply', C.accent], friend_request: ['möchte mit dir befreundet sein', 'userPlus', C.accent2],
  friend_accept: ['hat deine Anfrage angenommen', 'check', C.ok], call: ['hat dich angerufen', 'phone', C.ok], follow: ['folgt dir jetzt', 'user', C.info], like: ['gefällt dein Beitrag', 'heart', C.accent2], comment: ['hat deinen Beitrag kommentiert', 'comment', C.info],
};

export default function Notifications() {
  const router = useRouter();
  const [list, setList] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<any>('GET', '/api/notifications');
      setList(d.notifications);
      api('POST', '/api/notifications/read', {}).catch(() => {});
      setState(() => ({ notifUnread: 0 }));
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const open = (n: Notif) => {
    const ch = /\/channels\/([^/?]+)\/([^/?]+)/.exec(n.url || '')?.[2];
    if (ch) router.push({ pathname: '/chat/[id]', params: { id: ch } });
    else if (/^\/post\/[\w-]+/.test(n.url || '')) router.push({ pathname: '/post/[id]', params: { id: n.url!.split('/')[2].split('?')[0] } });
    else if (/^\/feed/.test(n.url || '')) router.push('/feed');
    else if (n.actor) router.push({ pathname: '/user/[id]', params: { id: n.actor.id } });
  };
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <T style={s.h1}>Mitteilungen</T>
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
          ListEmptyComponent={!loading ? <Empty icon="bell" title="Alles ruhig" text="Hier erscheint, wenn dich jemand erwähnt oder dir eine Anfrage schickt." /> : undefined}
          renderItem={({ item: n, index }) => {
            const [label, icon, color] = KIND[n.kind] || ['', 'bell', C.muted];
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(260)}>
                <Pressable accessibilityRole="button" onPress={() => open(n)} style={({ pressed }) => [s.row, !n.read && s.unread, pressed && { backgroundColor: C.accentSoft }]}>
                  <View>
                    <Avatar user={n.actor} size={44} frame={false} />
                    <View style={[s.kind, { backgroundColor: color }]}><Icon name={icon} size={11} color="#fff" stroke={2.6} /></View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.title}><T style={{ fontWeight: '800' }}>{n.actor?.display || 'Asoo'}</T> {label}</T>
                    {n.text ? <T style={s.text} numberOfLines={2}>{n.text}</T> : null}
                    <T style={s.time}>{timeLabel(n.created)}</T>
                  </View>
                  {!n.read ? <View style={s.dot} /> : null}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 12, marginHorizontal: 8, marginVertical: 3, borderRadius: 16 },
  unread: { backgroundColor: 'rgba(132,104,255,0.08)', borderWidth: 1, borderColor: 'rgba(132,104,255,0.2)' },
  kind: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg1 },
  title: { color: C.text2, fontSize: 15, lineHeight: 20 },
  text: { color: C.muted, marginTop: 2, fontSize: 14, lineHeight: 19 },
  time: { color: C.faint, fontSize: 12, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent2, alignSelf: 'center' },
});
