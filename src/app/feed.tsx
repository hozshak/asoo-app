// Feed – nativ (vorher die Web-Seite /feed): „Für dich“ und „Folge ich“, Beitrag schreiben mit Bild, Gefällt mir,
// Kommentare (post/[id]). Weiter unten lädt ältere Beiträge nach, nach unten ziehen lädt neu.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { pickImage as chooseImage } from '@/lib/pick';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { putUsers, useStore } from '@/lib/store';
import { Avatar, Btn, Empty, Glow, Seg, T, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { PostCard, type Post } from '@/components/PostCard';
import { C, F } from '@/lib/theme';
import { useHeaderOffset } from '@/lib/keyboard';
import { t } from '@/lib/i18n';

type Mode = 'all' | 'following';

export default function Feed() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const [mode, setMode] = useState<Mode>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const busy = useRef(false);
  const headerOffset = useHeaderOffset();
  const say = (t: string) => { setNote(t); setTimeout(() => setNote((x) => (x === t ? '' : x)), 2200); };

  const load = useCallback(async (reset: boolean, m: Mode = mode) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setErr('');
    try {
      const before = !reset && posts.length ? '&before=' + posts[posts.length - 1].id : '';
      const d = await api<any>('GET', `/api/feed?mode=${m}${before}`);
      putUsers(d.users || {});
      setPosts((p) => (reset ? d.posts : [...p, ...d.posts.filter((x: Post) => !p.some((y) => y.id === x.id))]));
      setDone(d.posts.length < 20);
    } catch (e) { setErr(errText(e)); }
    busy.current = false; setLoading(false); setRefreshing(false);
  }, [mode, posts]);
  useEffect(() => { setPosts([]); setDone(false); load(true, mode); }, [mode]);

  const update = (p: Post) => setPosts((l) => l.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => setPosts((l) => l.filter((x) => x.id !== id));
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow />
      <TopBar title={t("Feed")} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerOffset}>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setDone(false); load(true); }} tintColor={C.accent} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (!done && !loading && posts.length) load(false); }}
          ListHeaderComponent={<>
            {me ? <Composer onPosted={(p) => { setPosts((l) => [p, ...l]); say(t("Gepostet!")); }} /> : null}
            <Seg items={[['all', 'Für dich'], ['following', 'Folge ich']]} value={mode} onChange={setMode} style={{ marginHorizontal: 12, marginBottom: 12 }} />
          </>}
          ListEmptyComponent={loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} /> : err ? <Empty icon="sparkle" title={t("Konnte nicht laden")} text={err} />
            : <Empty icon="sparkle" title={mode === 'following' ? t("Noch nichts hier") : t("Noch keine Beiträge")} text={mode === 'following' ? t("Folge Leuten, um hier ihre Beiträge zu sehen.") : t("Schreib den ersten!")} />}
          ListFooterComponent={posts.length ? (loading ? <ActivityIndicator color={C.accent} style={{ margin: 16 }} /> : done ? <T style={s.end}>{t("Das war alles. ✨")}</T> : undefined) : undefined}
          renderItem={({ item }) => <PostCard post={item} onChange={update} onRemove={() => remove(item.id)} onNote={say}
            onOpen={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })} />}
        />
      </KeyboardAvoidingView>
      {note ? <View style={s.note} pointerEvents="none"><T style={{ fontWeight: '700' }}>{note}</T></View> : null}
    </View>
  );
}

function Composer({ onPosted }: { onPosted: (p: Post) => void }) {
  const me = useStore((s) => s.me);
  const [text, setText] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async () => {
    const r = await chooseImage({ title: t("Bild zum Beitrag"), quality: 0.75, maxSide: 1600 });
    if (!r) return;
    setBusy(true); setErr('');
    try { const up = await upload('post', r.uri, r.mime); setImg(up.key); }
    catch (e) { setErr(errText(e)); }
    setBusy(false);
  };
  const post = async () => {
    if ((!text.trim() && !img) || busy) return;
    setBusy(true); setErr('');
    try { const d = await api<any>('POST', '/api/posts', { content: text, image: img }); putUsers(d.users || {}); setText(''); setImg(null); onPosted(d.post); }
    catch (e) { setErr(errText(e)); }
    setBusy(false);
  };
  const prev = mediaSource(img);
  return (
    <View style={s.composer}>
      <Avatar user={me} size={40} />
      <View style={{ flex: 1, gap: 8 }}>
        <TextInput value={text} onChangeText={setText} placeholder={t("Was gibt’s Neues, {0}?", { 0: me?.display || '' })} placeholderTextColor={C.faint} multiline maxLength={2000} style={s.input} />
        {prev ? <View><Image source={prev} style={s.prev} contentFit="cover" />
          <Pressable accessibilityRole="button" accessibilityLabel={t("Bild entfernen")} onPress={() => setImg(null)} style={s.prevX}><Icon name="x" size={14} color="#fff" stroke={2.6} /></Pressable></View> : null}
        {err ? <T style={{ color: C.danger, fontSize: 13 }}>{err}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Bild anhängen")} onPress={pick} style={s.iconBtn}><Icon name="image" size={20} color={C.text2} /></Pressable>
          <View style={{ flex: 1 }} />
          <Btn title={t("Posten")} small busy={busy} disabled={!text.trim() && !img} onPress={post} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  composer: { flexDirection: 'row', gap: 10, margin: 12, padding: 12, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  input: { color: C.text, fontSize: 16, fontFamily: F.regular, minHeight: 44, maxHeight: 160, paddingTop: 10, textAlignVertical: 'top' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  prev: { width: 140, height: 140, borderRadius: 12 },
  prevX: { position: 'absolute', left: 112, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  end: { color: C.muted, textAlign: 'center', margin: 18 },
  note: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
});
