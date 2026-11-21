// Ein Beitrag im Feed – wie in der Web-App (zuno-app/public/js/pages.js, postEl): Kopf mit Person und Zeit, Text, Bild,
// Gefällt mir, Kommentare, Teilen. Lange drücken oder „…“ = Menü (Link kopieren, Löschen, Melden).
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { api, BASE, errText, mediaSource } from '@/lib/api';
import { getState, userOf, useStore } from '@/lib/store';
import { RichText, timeLabel } from '@/lib/text';
import { openLink } from '@/lib/links';
import { NameText } from './NameText';
import { Avatar, Sheet, T } from './ui';
import { Icon } from './Icon';
import { C } from '@/lib/theme';

export type Post = { id: string; author_id: string; content?: string | null; image?: string | null; created: number; like_count: number; comment_count: number; liked?: boolean | number };

export const REPORT_REASONS: [string, string][] = [['spam', 'Spam'], ['harassment', 'Belästigung oder Mobbing'], ['hate', 'Hass oder Hetze'], ['violence', 'Gewalt oder Drohung'], ['sexual', 'Sexuelle Inhalte'], ['other', 'Etwas anderes']];
export const postLink = (id: string) => `${BASE || 'https://zuno-app.altraex.workers.dev'}/post/${id}`;

export function PostCard({ post, onChange, onRemove, onOpen, onNote }: { post: Post; onChange?: (p: Post) => void; onRemove?: () => void; onOpen?: () => void; onNote?: (t: string) => void }) {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const u = useStore((s) => s.users[post.author_id]) || userOf(post.author_id);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const img = mediaSource(post.image);
  const mine = post.author_id === me?.id;
  const like = async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const on = !post.liked;
    onChange?.({ ...post, liked: on, like_count: post.like_count + (on ? 1 : -1) });
    try { const d = await api<any>('POST', `/api/posts/${post.id}/like`, { on }); onChange?.({ ...post, liked: on, like_count: d.like_count }); }
    catch (e) { onChange?.(post); onNote?.(errText(e)); }
  };
  const share = async () => {
    const url = postLink(post.id);
    if (Platform.OS === 'web') { await Clipboard.setStringAsync(url).catch(() => {}); onNote?.('Link kopiert'); return; }
    Share.share({ message: url, url }).catch(() => {});
  };
  const del = async () => {
    try { await api('DELETE', '/api/posts/' + post.id); onRemove?.(); onNote?.('Beitrag gelöscht'); } catch (e) { onNote?.(errText(e)); }
  };
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Profil von ${u.display}`} onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}>
          <Avatar user={u} size={42} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <NameText name={u.display} styleId={(u as any).name_style} style={s.name} onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })} />
          <Pressable onPress={onOpen} disabled={!onOpen}><T style={s.time}>{timeLabel(post.created)}</T></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Mehr" hitSlop={10} onPress={() => setMenu(true)} style={s.more}><Icon name="more" size={18} color={C.muted} /></Pressable>
      </View>
      {post.content ? <Pressable onPress={onOpen} onLongPress={() => setMenu(true)} disabled={!onOpen}><RichText text={post.content} meName={me?.username} style={s.body} onLink={(l: string) => openLink(router, l)} /></Pressable> : null}
      {img ? <Pressable onPress={onOpen} onLongPress={() => setMenu(true)} disabled={!onOpen}><Image source={img} style={s.img} contentFit="cover" transition={150} /></Pressable> : null}
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Gefällt mir" onPress={like} style={s.act}>
          <Icon name="heart" size={18} color={post.liked ? C.accent2 : C.muted} />
          <T style={[s.count, post.liked ? { color: C.accent2 } : null]}>{post.like_count || ''}</T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Kommentare" onPress={onOpen} style={s.act}>
          <Icon name="comment" size={18} color={C.muted} />
          <T style={s.count}>{post.comment_count || ''}</T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Teilen" onPress={share} style={s.act}>
          <Icon name="link" size={17} color={C.muted} /><T style={s.count}>Teilen</T>
        </Pressable>
      </View>
      <Sheet open={menu} onClose={() => setMenu(false)} items={[
        { label: 'Link kopieren', icon: 'link', onPress: async () => { await Clipboard.setStringAsync(postLink(post.id)).catch(() => {}); onNote?.('Link kopiert'); } },
        mine || (getState().me as any)?.is_admin ? { label: 'Löschen', icon: 'trash', danger: true, onPress: del } : null,
        !mine ? { label: 'Melden', icon: 'flag', danger: true, onPress: () => setReport(true) } : null,
      ]} />
      <Sheet open={report} onClose={() => setReport(false)} title="Warum meldest du diesen Beitrag?" items={REPORT_REASONS.map(([k, l]) => ({ label: l, onPress: async () => {
        try { await api('POST', '/api/reports', { type: 'post', id: post.id, reason: k }); onNote?.('Danke – wir sehen uns die Meldung an.'); } catch (e) { onNote?.(errText(e)); }
      } }))} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 12, marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontSize: 15.5, fontWeight: '800' },
  time: { color: C.faint, fontSize: 12.5, marginTop: -2 },
  more: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 15.5, lineHeight: 22, color: C.text },
  img: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginTop: 10, backgroundColor: C.bg3 },
  actions: { flexDirection: 'row', gap: 4, marginTop: 10, marginHorizontal: -6 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 34, borderRadius: 12 },
  count: { color: C.muted, fontSize: 13.5, fontWeight: '700' },
});
