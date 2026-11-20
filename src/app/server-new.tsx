// Server hinzufügen – nativ: Erstellen (mit Vorlage), Beitreten (Einladungslink/-code), Entdecken (öffentliche Server).
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { api, errText, mediaSource } from '@/lib/api';
import { bootstrap, getState, useStore } from '@/lib/store';
import { Btn, Glow, Seg, ServerIcon, SheetHead, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { openServer } from '@/components/InviteCard';
import { C } from '@/lib/theme';

const ROOMS: Record<string, any> = { lounge: require('../../assets/rooms/lounge.webp'), beach: require('../../assets/rooms/beach.webp'), wedding: require('../../assets/rooms/wedding.webp'), orbit: require('../../assets/rooms/orbit.webp'), theater: require('../../assets/rooms/theater.webp'), gaming: require('../../assets/rooms/gaming.webp') };
// wie SERVER_TPL der Web-App (pages.js); die Kanäle legt der Server an
const TPL = [
  { id: 'friends', emoji: '🛋️', color: '#ff5c8a', room: 'lounge', name: 'Freunde & Chillen', text: 'Quatschen, Fotos, Memes – dazu Rooftop-Lounge und Strandbar in 3D.' },
  { id: 'gaming', emoji: '🎮', color: '#7c5cff', room: 'gaming', name: 'Gaming-Crew', text: 'Ankündigungen, Clips, Mitspieler-Suche, Squads und eine Neon-Arena.' },
  { id: 'cinema', emoji: '🍿', color: '#ffb02e', room: 'theater', name: 'Kino & Serien', text: 'Zusammen schauen im Kinosaal – mit Film-Tipps und Spoiler-Ecke.' },
  { id: 'party', emoji: '🪩', color: '#2ec5ff', room: 'beach', name: 'Party & Musik', text: 'Club mit Aussicht, Beach-Party und Dawet.' },
  { id: 'kurdish', emoji: '☀️', color: '#3ddc97', room: 'wedding', name: 'Civata Kurdî', text: 'Nûçe, axaftin, stran – Dawet & Govend.' },
  { id: 'study', emoji: '📚', color: '#5865f2', room: 'orbit', name: 'Lernen & Arbeiten', text: 'Aufgaben, Fragen, ein ruhiger Raum und ein Büro in 3D.' },
  { id: '', emoji: '✨', color: '#9a6bff', room: 'orbit', name: 'Klassisch', text: 'Ein Textkanal, ein Sprachraum und alle 3D-Räume.' },
];
const EMOJIS = ['🎮', '🎵', '🔥', '⚽', '🎨', '📚', '🍕', '💬', '🌙', '🚀', '🐉', '👾', '🌸', '🏆', '😎', '💜'];

type Tab = 'create' | 'join' | 'discover';

export default function ServerNew() {
  const router = useRouter();
  const p = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(p.tab === 'discover' ? 'discover' : p.tab === 'join' ? 'join' : 'create');
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title="Server hinzufügen" onClose={() => router.back()} />
      <Seg<Tab> items={[['create', 'Erstellen'], ['join', 'Beitreten'], ['discover', 'Entdecken']]} value={tab} onChange={setTab} style={{ marginHorizontal: 16, marginBottom: 8 }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {tab === 'create' ? <Create /> : tab === 'join' ? <Join /> : <Discover />}
      </KeyboardAvoidingView>
    </View>
  );
}

function Create() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const [tpl, setTpl] = useState(TPL[0]);
  const [emoji, setEmoji] = useState(TPL[0].emoji);
  const [name, setName] = useState(`Server von ${me?.display || 'mir'}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const create = async () => {
    setBusy(true); setErr('');
    try {
      const d = await api<any>('POST', '/api/servers', { name: name.trim(), icon_emoji: emoji, color: tpl.color, template: tpl.id || undefined });
      await bootstrap();
      openServer(router, d.server?.id || d.id);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <T style={s.hint}>Such dir eine Vorlage aus – Kanäle und 3D-Räume sind dann schon fertig. Ändern kannst du alles später.</T>
      <View style={s.grid}>
        {TPL.map((v) => {
          const on = tpl === v;
          return (
            <Pressable key={v.id || 'klassisch'} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setTpl(v); setEmoji(v.emoji); }} style={[s.tpl, on && { borderColor: v.color, backgroundColor: v.color + '18' }]}>
              <View style={s.tplImg}>
                <Image source={ROOMS[v.room]} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(7,7,13,0.85)']} style={StyleSheet.absoluteFill} />
                <T style={s.tplEmoji}>{v.emoji}</T>
              </View>
              <T style={s.tplName} numberOfLines={1}>{v.name}</T>
              <T style={s.tplText} numberOfLines={2}>{v.text}</T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ServerIcon server={{ id: 'x', name, icon_emoji: emoji, color: tpl.color, owner_id: '', role: 'owner', channels: [] }} size={56} />
        <View style={{ flex: 1 }}><Field label="Server-Name" value={name} onChangeText={setName} maxLength={50} /></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {EMOJIS.map((e) => <Pressable key={e} accessibilityLabel={`Symbol ${e}`} onPress={() => setEmoji(e)} style={[s.emo, emoji === e && s.emoOn]}><T style={{ fontSize: 20, lineHeight: 28 }}>{e}</T></Pressable>)}
      </ScrollView>
      {err ? <T style={s.err}>{err}</T> : null}
      <Btn title="Server erstellen" icon="plus" busy={busy} disabled={name.trim().length < 2} onPress={create} />
    </ScrollView>
  );
}

function Join() {
  const router = useRouter();
  const [val, setVal] = useState('');
  const code = (val.trim().match(/([A-Za-z0-9]{6,12})\/?$/) || [])[1];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 14 }} keyboardShouldPersistTaps="handled">
      <T style={s.hint}>Gib einen Einladungslink oder -code ein, z. B. https://…/i/AbCd1234</T>
      <Field label="Einladung" value={val} onChangeText={setVal} autoCapitalize="none" autoCorrect={false} placeholder="Link oder Code" maxLength={200} autoFocus />
      <Btn title="Weiter" icon="link" disabled={!code} onPress={() => code && router.replace({ pathname: '/invite/[code]', params: { code } })} />
    </ScrollView>
  );
}

function Discover() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { api<any>('GET', '/api/discover' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')).then((d) => setList(d.servers || [])).catch((e) => setErr(errText(e))); }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);
  const join = async (sid: string) => {
    if (getState().servers.some((x) => x.id === sid)) return openServer(router, sid);
    setBusy(sid);
    try { await api('POST', `/api/servers/${sid}/join`, {}); await bootstrap(); openServer(router, sid); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Field value={q} onChangeText={setQ} placeholder="Öffentliche Server suchen" autoCapitalize="none" />
      {err ? <T style={s.err}>{err}</T> : null}
      {!list ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : !list.length ? <T style={[s.hint, { textAlign: 'center', marginTop: 20 }]}>Nichts gefunden.</T> : list.map((sv) => {
        const banner = mediaSource(sv.banner);
        const member = getState().servers.some((x) => x.id === sv.id);
        return (
          <View key={sv.id} style={s.disc}>
            {banner ? <Image source={banner} style={s.discBanner} contentFit="cover" /> : <View style={[s.discBanner, { backgroundColor: (sv.color || C.accent) + '55' }]} />}
            <View style={s.discBody}>
              <ServerIcon server={{ ...sv, owner_id: '', role: 'member', channels: [] }} size={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{sv.name}</T>
                <T style={s.discMeta} numberOfLines={2}>{sv.description || `${sv.member_count || 0} Mitglieder`}</T>
              </View>
              <Btn small title={member ? 'Öffnen' : 'Beitreten'} kind={member ? 'secondary' : 'primary'} busy={busy === sv.id} onPress={() => join(sv.id)} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hint: { color: C.muted, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tpl: { width: '48%', flexGrow: 1, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg2, overflow: 'hidden', paddingBottom: 10 },
  tplImg: { height: 72, marginBottom: 8, justifyContent: 'flex-end', padding: 8 },
  tplEmoji: { fontSize: 24, lineHeight: 30 },
  tplName: { fontWeight: '800', fontSize: 14.5, paddingHorizontal: 10 },
  tplText: { color: C.muted, fontSize: 12, lineHeight: 16, paddingHorizontal: 10, marginTop: 2 },
  emo: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line },
  emoOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  err: { color: C.danger, fontSize: 14 },
  disc: { borderRadius: 16, overflow: 'hidden', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  discBanner: { height: 54 },
  discBody: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: -24 },
  discMeta: { color: C.muted, fontSize: 12.5 },
});
