// Ein Beitrag mit allen Kommentaren – nativ (vorher die Web-Seite /post/<id>). Kommentieren, eigene Kommentare
// (und als Autor des Beitrags auch fremde) löschen, fremde melden.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errText } from '@/lib/api';
import { getState, putUsers, userOf, useStore } from '@/lib/store';
import { RichText, timeLabel } from '@/lib/text';
import { openLink } from '@/lib/links';
import { Avatar, Empty, Glow, Sheet, T, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { NameText } from '@/components/NameText';
import { PostCard, REPORT_REASONS, type Post } from '@/components/PostCard';
import { C, F } from '@/lib/theme';
import { useComposerPad, useHeaderOffset } from '@/lib/keyboard';

type Comment = { id: string; post_id?: string; author_id: string; content: string; created: number };

export default function PostView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Comment | null>(null);
  const [report, setReport] = useState<Comment | null>(null);
  const [note, setNote] = useState('');
  const headerOffset = useHeaderOffset();
  const composerPad = useComposerPad(8);
  const say = (t: string) => { setNote(t); setTimeout(() => setNote((x) => (x === t ? '' : x)), 2200); };
  useEffect(() => {
    (async () => {
      try {
        const d = await api<any>('GET', '/api/posts/' + id); putUsers(d.users || {}); setPost(d.post);
        const c = await api<any>('GET', `/api/posts/${id}/comments`); putUsers(c.users || {}); setComments(c.comments || []);
      } catch (e) { setErr(errText(e)); }
    })();
  }, [id]);
  const send = async () => {
    if (!text.trim() || busy || !post) return;
    setBusy(true);
    try {
      const r = await api<any>('POST', `/api/posts/${post.id}/comments`, { content: text });
      putUsers(r.users || {}); setText('');
      setComments((l) => [...(l || []), r.comment]); setPost({ ...post, comment_count: post.comment_count + 1 });
    } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  const del = async (c: Comment) => {
    try { await api('DELETE', '/api/comments/' + c.id); setComments((l) => (l || []).filter((x) => x.id !== c.id)); if (post) setPost({ ...post, comment_count: Math.max(0, post.comment_count - 1) }); }
    catch (e) { say(errText(e)); }
  };
  const canDel = (c: Comment) => c.author_id === me?.id || post?.author_id === me?.id || !!(getState().me as any)?.is_admin;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow />
      <TopBar title={'Beitrag'} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerOffset}>
        {err ? <Empty icon="sparkle" title="Beitrag nicht gefunden" text={err} /> : !post ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={comments || []}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
            ListHeaderComponent={<PostCard post={post} onChange={setPost} onRemove={() => router.back()} onNote={say} />}
            ListEmptyComponent={comments ? <T style={s.none}>Noch keine Kommentare.</T> : <ActivityIndicator color={C.accent} />}
            renderItem={({ item: c }) => {
              const u = userOf(c.author_id);
              return (
                <Pressable onLongPress={() => setMenu(c)} style={s.row}>
                  <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}><Avatar user={u} size={32} frame={false} /></Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.bubble}>
                      <NameText name={u.display} styleId={(u as any).name_style} style={s.name} />
                      <RichText text={c.content} meName={me?.username} style={s.text} onLink={(l: string) => openLink(router, l)} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingTop: 3 }}>
                      <T style={s.meta}>{timeLabel(c.created)}</T>
                      {canDel(c) ? <T style={s.meta} onPress={() => del(c)}>Löschen</T> : null}
                      {c.author_id !== me?.id ? <T style={s.meta} onPress={() => setReport(c)}>Melden</T> : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        {post ? (
          <View style={[s.bar, { paddingBottom: composerPad }]}>
            <TextInput value={text} onChangeText={setText} placeholder="Kommentieren …" placeholderTextColor={C.faint} maxLength={1000} multiline style={s.input} />
            <Pressable accessibilityRole="button" accessibilityLabel="Senden" onPress={send} disabled={!text.trim() || busy} style={[s.send, (!text.trim() || busy) && { opacity: 0.5 }]}>
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <Sheet open={!!menu} onClose={() => setMenu(null)} items={menu ? [
        canDel(menu) ? { label: 'Löschen', icon: 'trash', danger: true, onPress: () => del(menu) } : null,
        menu.author_id !== me?.id ? { label: 'Melden', icon: 'flag', danger: true, onPress: () => setReport(menu) } : null,
      ] : []} />
      <Sheet open={!!report} onClose={() => setReport(null)} title="Warum meldest du diesen Kommentar?" items={REPORT_REASONS.map(([k, l]) => ({ label: l, onPress: async () => {
        const c = report; if (!c) return;
        try { await api('POST', '/api/reports', { type: 'comment', id: c.id, reason: k }); say('Danke – wir sehen uns die Meldung an.'); } catch (e) { say(errText(e)); }
      } }))} />
      {note ? <View style={s.note} pointerEvents="none"><T style={{ fontWeight: '700' }}>{note}</T></View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  none: { color: C.muted, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 5 },
  bubble: { backgroundColor: C.bg3, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  name: { fontSize: 13.5, fontWeight: '800' },
  text: { fontSize: 15, lineHeight: 20, color: C.text },
  meta: { color: C.faint, fontSize: 12, fontWeight: '600' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg1 },
  input: { flex: 1, color: C.text, fontSize: 16, fontFamily: F.regular, minHeight: 42, maxHeight: 120, paddingHorizontal: 14, paddingTop: 10, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  note: { position: 'absolute', left: 20, right: 20, bottom: 90, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
});
