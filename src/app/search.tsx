// Suche (in einem Server oder in den eigenen Direktnachrichten) und angeheftete Nachrichten eines Kanals – nativ.
// Tippen auf einen Treffer öffnet den Chat.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errText } from '@/lib/api';
import { channelInfo, dmTitle, getState, putUsers, serverOf, userOf } from '@/lib/store';
import { plainText, timeLabel } from '@/lib/text';
import { Avatar, Empty, Glow, Seg, SheetHead, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { C } from '@/lib/theme';

type Mode = 'search' | 'pins';

export default function Search() {
  const p = useLocalSearchParams<{ sid?: string; ch?: string; mode?: Mode }>();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(p.mode === 'pins' && p.ch ? 'pins' : 'search');
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const sid = p.sid || null;
  const server = serverOf(sid);
  useEffect(() => {
    setErr('');
    if (mode === 'pins') {
      setList(null);
      api<any>('GET', `/api/channels/${p.ch}/pins`).then((d) => { putUsers(d.users || {}); setList(d.messages || []); }).catch((e) => setErr(errText(e)));
      return;
    }
    if (q.trim().length < 2) { setList([]); return; }
    setList(null);
    const t = setTimeout(() => {
      api<any>('GET', '/api/search?q=' + encodeURIComponent(q.trim()) + (sid ? '&server=' + sid : p.ch ? '&channel=' + p.ch : '')).then((d) => { putUsers(d.users || {}); setList(d.messages || []); }).catch((e) => setErr(errText(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);
  const where = (ch: string) => {
    const info = channelInfo(ch);
    if (info) return '#' + info.channel.name;
    const dm = getState().dms.find((d) => d.id === ch);
    return dm ? dmTitle(dm, getState().me?.id) : '';
  };
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title={mode === 'pins' ? 'Angeheftete Nachrichten' : server ? `Suchen in „${server.name}“` : p.ch ? 'In dieser Unterhaltung suchen' : 'In Direktnachrichten suchen'} onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
        {p.ch ? <Seg<Mode> items={[['search', 'Suchen'], ['pins', 'Angeheftet']]} value={mode} onChange={setMode} /> : null}
        {mode === 'search' ? <Field value={q} onChangeText={setQ} placeholder="Wonach suchst du?" autoFocus autoCapitalize="none" returnKeyType="search" /> : null}
        {err ? <T style={{ color: C.danger }}>{err}</T> : null}
      </View>
      {list === null ? <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 8, paddingBottom: 40 }}
          ListEmptyComponent={mode === 'pins' ? <Empty icon="pin" title="Nichts angeheftet" text="Lange auf eine Nachricht drücken → „Anheften“." /> : q.trim().length < 2 ? <Empty icon="search" title="Suche starten" text="Mindestens 2 Zeichen eingeben." /> : <Empty icon="search" title="Nichts gefunden" />}
          renderItem={({ item: m }) => {
            const u = userOf(m.author_id);
            return (
              <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: m.ch } })} style={({ pressed }) => [s.hit, pressed && { backgroundColor: C.accentSoft }]}>
                <Avatar user={u} size={34} frame={false} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <T style={{ fontWeight: '700' }} numberOfLines={1}>{u.display}</T>
                    <T style={s.meta} numberOfLines={1}>{where(m.ch)} · {timeLabel(m.created)}</T>
                  </View>
                  <T style={s.text} numberOfLines={3}>{plainText(m.content, sid) || (m.attachments?.length ? '📷 Bild' : '')}</T>
                </View>
                <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={14} color={C.faint} /></View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  meta: { color: C.faint, fontSize: 12, flexShrink: 1 },
  text: { color: C.text2, fontSize: 14.5, lineHeight: 20 },
});
