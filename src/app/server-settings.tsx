// Server-Einstellungen – nativ (vorher die Web-Ansicht): Übersicht, Kanäle, Rollen, Mitglieder, Einladungen, Banns,
// Protokoll, Server löschen. Gleiche Schnittstellen wie die Web-App (zuno-app/public/js/settings.js, serverSettings).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { pickImage as chooseImage } from '@/lib/pick';
import { api, BASE, errText, mediaSource, upload } from '@/lib/api';
import { bootstrap, can, loadMembers, putUsers, RANK, serverOf, useStore, type Channel, type Role, type User } from '@/lib/store';
import { timeLabel } from '@/lib/text';
import { Avatar, Btn, Glass, Glow, Section, Seg, Sheet, SheetHead, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { C, F, R } from '@/lib/theme';

type Tab = 'overview' | 'channels' | 'roles' | 'members' | 'invites' | 'bans' | 'audit' | 'danger';
type Member = User & { role: string; base?: string; roles?: string[]; nick?: string | null; joined?: number; muted_until?: number };
const SERVER_COLORS = ['#5865f2', '#7c5cff', '#ff5c8a', '#ff6b3d', '#ffb02e', '#3ddc97', '#2ec5ff', '#1f1f2e'];
const ROLE_COLORS = ['#ff5c8a', '#ff6b3d', '#ffb02e', '#f5d90a', '#3ddc97', '#1abc9c', '#2ec5ff', '#5865f2', '#7c5cff', '#b45cff', '#e91e63', '#95a5a6'];
const THEMES: [string, string][] = [['lounge', 'Skylounge'], ['beach', 'Strand'], ['orbit', 'Raumstation'], ['theater', 'Kino'], ['wedding', 'Dawet (Hochzeit)'], ['gaming', 'Gaming'], ['hangout', 'Wohnzimmer'], ['office', 'Büro']];
const SLOW: [number, string][] = [[0, 'Aus'], [5, '5 s'], [10, '10 s'], [30, '30 s'], [60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, '1 h']];
const LIMITS = [0, 2, 3, 4, 5, 6, 8, 10, 12];
const RANK_NAME: Record<string, string> = { member: 'Mitglied', mod: 'Moderator', admin: 'Admin', owner: 'Besitzer' };

const ask = (title: string, text: string, ok: string, fn: () => void) => {
  if (Platform.OS === 'web') { if (confirm(`${title}\n\n${text}`)) fn(); return; }
  Alert.alert(title, text, [{ text: 'Abbrechen', style: 'cancel' }, { text: ok, style: 'destructive', onPress: fn }]);
};

export default function ServerSettings() {
  const p = useLocalSearchParams<{ sid: string; tab?: Tab }>();
  const router = useRouter();
  const server = useStore((s) => s.servers.find((x) => x.id === p.sid) || null);
  const [note, setNote] = useState('');
  const say = (t: string) => { setNote(t); setTimeout(() => setNote((x) => (x === t ? '' : x)), 2400); };
  const admin = server ? can(server.id, 'admin') : false;
  const tabs = useMemo(() => ([admin && ['overview', 'Übersicht'], admin && ['channels', 'Kanäle'], admin && ['roles', 'Rollen'], ['members', 'Mitglieder'], admin && ['invites', 'Einladungen'],
    ['bans', 'Banns'], ['audit', 'Protokoll'], server?.role === 'owner' && ['danger', 'Löschen']].filter(Boolean) as [Tab, string][]), [admin, server?.role]);
  const [tab, setTab] = useState<Tab>(tabs.some((x) => x[0] === p.tab) ? p.tab! : tabs[0]?.[0] || 'members');
  if (!server) return <View style={{ flex: 1, backgroundColor: C.bg0 }}><SheetHead title="Server-Einstellungen" onClose={() => router.back()} /><T style={s.empty}>Server nicht gefunden.</T></View>;
  const props = { sid: server.id, say };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <SheetHead title={server.name} onClose={() => router.back()} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabs}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <T style={[s.tabText, tab === k && { color: '#fff' }, k === 'danger' && { color: C.danger }]}>{l}</T>
          </Pressable>
        ))}
      </ScrollView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          {tab === 'overview' ? <Overview {...props} /> : tab === 'channels' ? <Channels {...props} /> : tab === 'roles' ? <Roles {...props} />
            : tab === 'members' ? <Members {...props} /> : tab === 'invites' ? <Invites {...props} /> : tab === 'bans' ? <Bans {...props} />
              : tab === 'audit' ? <Audit {...props} /> : <Danger {...props} onGone={() => { router.dismissAll?.(); router.replace('/'); }} />}
        </ScrollView>
      </KeyboardAvoidingView>
      {note ? <View style={s.note} pointerEvents="none"><T style={{ fontWeight: '700' }}>{note}</T></View> : null}
    </View>
  );
}

type P = { sid: string; say: (t: string) => void };

// ---------- Übersicht ----------
function Overview({ sid, say }: P) {
  const sv = serverOf(sid)!;
  const [d, setD] = useState({ name: sv.name, description: sv.description || '', icon: sv.icon || null, icon_emoji: sv.icon_emoji || '', color: sv.color || '#5865f2', banner: sv.banner || null, public: !!(sv as any).public });
  const [busy, setBusy] = useState('');
  const pick = async (kind: 'icon' | 'banner') => {
    const r = await chooseImage({ title: kind === 'icon' ? 'Server-Bild' : 'Server-Banner', crop: kind === 'icon' ? [1, 1] : [16, 6], quality: 0.75, maxSide: kind === 'icon' ? 1024 : 1600 });
    if (!r) return;
    setBusy(kind);
    try { const up = await upload(kind, r.uri, r.mime); setD((x) => ({ ...x, [kind]: up.key })); } catch (e) { say(errText(e)); }
    setBusy('');
  };
  const save = async () => {
    setBusy('save');
    try { await api('PATCH', '/api/servers/' + sid, d); await bootstrap(); say('Gespeichert ✓'); } catch (e) { say(errText(e)); }
    setBusy('');
  };
  const icon = mediaSource(d.icon), banner = mediaSource(d.banner);
  return (
    <Glass style={s.card} intensity={20}>
      <View style={s.bannerBox}>
        {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg3 }]} />}
        <View style={[s.serverIcon, { backgroundColor: d.color }]}>
          {icon ? <Image source={icon} style={StyleSheet.absoluteFill} contentFit="cover" /> : <T style={{ fontSize: 30, fontWeight: '800', color: '#fff' }}>{d.icon_emoji || d.name[0] || '?'}</T>}
        </View>
      </View>
      <View style={s.row2}>
        <Btn title="Icon ändern" small kind="secondary" busy={busy === 'icon'} onPress={() => pick('icon')} style={{ flex: 1 }} />
        <Btn title="Banner ändern" small kind="secondary" busy={busy === 'banner'} onPress={() => pick('banner')} style={{ flex: 1 }} />
      </View>
      {d.icon || d.banner ? <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        {d.icon ? <T style={s.link} onPress={() => setD({ ...d, icon: null })}>Icon entfernen</T> : null}
        {d.banner ? <T style={s.link} onPress={() => setD({ ...d, banner: null })}>Banner entfernen</T> : null}
      </View> : null}
      <T style={s.label}>Farbe</T>
      <View style={s.colors}>{SERVER_COLORS.map((c) => <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: d.color === c }} onPress={() => setD({ ...d, color: c })} style={[s.dot, { backgroundColor: c }, d.color === c && s.dotOn]} />)}</View>
      <T style={s.label}>Server-Name</T>
      <TextInput value={d.name} onChangeText={(v) => setD({ ...d, name: v })} maxLength={50} style={s.input} placeholderTextColor={C.faint} />
      <T style={s.label}>Emoji als Icon (wenn kein Bild)</T>
      <TextInput value={d.icon_emoji} onChangeText={(v) => setD({ ...d, icon_emoji: v })} maxLength={8} style={[s.input, { width: 90 }]} placeholderTextColor={C.faint} />
      <T style={s.label}>Beschreibung</T>
      <TextInput value={d.description} onChangeText={(v) => setD({ ...d, description: v })} maxLength={300} multiline style={[s.input, s.multi]} placeholderTextColor={C.faint} />
      <View style={[s.switchRow, { marginTop: 14 }]}>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>Öffentlich</T><T style={s.hint}>Der Server erscheint unter „Entdecken“ und jeder kann ohne Einladung beitreten.</T></View>
        <Switch value={d.public} onValueChange={(v) => setD({ ...d, public: v })} trackColor={{ true: C.accent }} />
      </View>
      <Btn title="Speichern" busy={busy === 'save'} disabled={!d.name.trim()} onPress={save} style={{ marginTop: 16 }} />
    </Glass>
  );
}

// ---------- Kanäle ----------
function Channels({ sid, say }: P) {
  const sv = useStore((s) => s.servers.find((x) => x.id === sid))!;
  const [open, setOpen] = useState<string | null>(null);
  const cats = sv.categories || [];
  const known = new Set(cats.map((c) => c.id));
  const groups = [{ cat: null as any, chs: sv.channels.filter((c) => !c.parent || !known.has(c.parent)) }, ...cats.map((cat) => ({ cat, chs: sv.channels.filter((c) => c.parent === cat.id) }))];
  const saveLayout = async (gs: typeof groups) => {
    try {
      await api('POST', `/api/servers/${sid}/layout`, { categories: gs.filter((g) => g.cat).map((g) => g.cat.id), channels: gs.flatMap((g) => g.chs.map((c) => ({ id: c.id, parent: g.cat ? g.cat.id : null }))) });
      await bootstrap();
    } catch (e) { say(errText(e)); }
  };
  const moveCh = (gi: number, i: number, dir: number) => { const gs = groups.map((g) => ({ ...g, chs: [...g.chs] })); const a = gs[gi].chs; [a[i], a[i + dir]] = [a[i + dir], a[i]]; saveLayout(gs); };
  const moveCat = (gi: number, dir: number) => { const gs = [...groups]; [gs[gi], gs[gi + dir]] = [gs[gi + dir], gs[gi]]; if (!gs[0].cat || gi + dir > 0) saveLayout(gs); };
  const renameCat = (cat: any) => {
    if (Platform.OS === 'ios') Alert.prompt('Kategorie umbenennen', undefined, async (v) => { if (!v?.trim()) return; try { await api('PATCH', '/api/categories/' + cat.id, { name: v.trim() }); await bootstrap(); } catch (e) { say(errText(e)); } }, 'plain-text', cat.name);
    else { const v = prompt('Kategorie umbenennen', cat.name); if (v?.trim()) api('PATCH', '/api/categories/' + cat.id, { name: v.trim() }).then(bootstrap).catch((e) => say(errText(e))); }
  };
  const delCat = (cat: any) => ask(`Kategorie „${cat.name}“ löschen?`, 'Die Kanäle darin bleiben erhalten und stehen danach ohne Kategorie.', 'Löschen', async () => { try { await api('DELETE', '/api/categories/' + cat.id); await bootstrap(); } catch (e) { say(errText(e)); } });
  return (
    <>
      <T style={s.hint}>Tippe einen Kanal an, um ihn zu bearbeiten. Mit den Pfeilen änderst du die Reihenfolge.</T>
      {groups.map((g, gi) => (!g.cat && !g.chs.length) ? null : (
        <View key={g.cat?.id || '_'} style={{ marginTop: 14 }}>
          {g.cat ? (
            <View style={s.catRow}>
              <Section style={{ flex: 1 }}>{g.cat.name}</Section>
              <Arrow dir="up" disabled={gi <= 1} onPress={() => moveCat(gi, -1)} />
              <Arrow dir="down" disabled={gi === groups.length - 1} onPress={() => moveCat(gi, 1)} />
              <Pressable accessibilityRole="button" accessibilityLabel="Umbenennen" onPress={() => renameCat(g.cat)} style={s.small}><Icon name="edit" size={15} color={C.text2} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Kategorie löschen" onPress={() => delCat(g.cat)} style={s.small}><Icon name="trash" size={15} color={C.danger} /></Pressable>
            </View>
          ) : null}
          {g.chs.map((c, i) => (
            <Glass key={c.id} style={[s.card, { marginTop: 8, padding: 0 }]} intensity={20}>
              <View style={s.chHead}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Kanal ${c.name} bearbeiten`} onPress={() => setOpen(open === c.id ? null : c.id)} style={s.chMain}>
                  <Icon name={c.type === 'text' ? 'hash' : c.type === 'voice3d' ? 'cube' : 'volume'} size={17} color={C.muted} />
                  <T style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{c.name}</T>
                  {c.view_role && c.view_role !== 'member' ? <Icon name="lock" size={13} color={C.muted} /> : null}
                </Pressable>
                <Arrow dir="up" disabled={i === 0} onPress={() => moveCh(gi, i, -1)} />
                <Arrow dir="down" disabled={i === g.chs.length - 1} onPress={() => moveCh(gi, i, 1)} />
              </View>
              {open === c.id ? <ChannelEdit c={c} cats={cats} say={say} onGone={() => setOpen(null)} /> : null}
            </Glass>
          ))}
        </View>
      ))}
    </>
  );
}
const Arrow = ({ dir, disabled, onPress }: { dir: 'up' | 'down'; disabled?: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={dir === 'up' ? 'Nach oben' : 'Nach unten'} disabled={disabled} onPress={onPress} hitSlop={4} style={[s.small, disabled && { opacity: 0.3 }]}>
    <View style={{ transform: [{ rotate: dir === 'up' ? '180deg' : '0deg' }] }}><Icon name="chevron" size={14} color={C.text2} stroke={2.4} /></View>
  </Pressable>
);
function ChannelEdit({ c, cats, say, onGone }: { c: Channel; cats: any[]; say: (t: string) => void; onGone: () => void }) {
  const [d, setD] = useState({ name: c.name, topic: c.topic || '', slowmode: (c as any).slowmode || 0, theme: (c as any).theme || 'lounge', user_limit: c.user_limit || 0, parent: c.parent || null as string | null, view_role: c.view_role || 'member' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api('PATCH', '/api/channels/' + c.id, { name: d.name, topic: d.topic, slowmode: d.slowmode, ...(c.type === 'voice3d' ? { theme: d.theme } : {}), ...(cats.length ? { parent: d.parent } : {}),
        ...(c.type !== 'text' ? { user_limit: d.user_limit } : {}), view_role: d.view_role });
      await bootstrap(); say('Gespeichert ✓');
    } catch (e) { say(errText(e)); }
    setBusy(false);
  };
  const del = () => ask(`Kanal „${c.name}“ löschen?`, 'Alle Nachrichten darin werden gelöscht.', 'Löschen', async () => { try { await api('DELETE', '/api/channels/' + c.id); onGone(); await bootstrap(); } catch (e) { say(errText(e)); } });
  const chips = <K extends string | number | null>(items: [K, string][], val: K, set: (v: K) => void) => (
    <View style={s.chips}>{items.map(([k, l]) => <Pressable key={String(k)} accessibilityRole="radio" accessibilityState={{ checked: val === k }} onPress={() => set(k)} style={[s.chip, val === k && s.chipOn]}><T style={[s.chipText, val === k && { color: '#fff' }]}>{l}</T></Pressable>)}</View>
  );
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <T style={s.label}>Name</T>
      <TextInput value={d.name} onChangeText={(v) => setD({ ...d, name: v })} maxLength={32} style={s.input} />
      <T style={s.label}>Thema</T>
      <TextInput value={d.topic} onChangeText={(v) => setD({ ...d, topic: v })} maxLength={200} placeholder="Thema (freiwillig)" placeholderTextColor={C.faint} style={s.input} />
      {c.type === 'text' ? <><T style={s.label}>Langsamer Modus</T>{chips(SLOW, d.slowmode, (v) => setD({ ...d, slowmode: v }))}</> : null}
      {c.type === 'voice3d' ? <><T style={s.label}>Raum-Design</T>{chips(THEMES, d.theme, (v) => setD({ ...d, theme: v }))}</> : null}
      {c.type !== 'text' ? <><T style={s.label}>Personenlimit</T>{chips(LIMITS.map((n) => [n, n ? String(n) : 'Kein Limit'] as [number, string]), d.user_limit, (v) => setD({ ...d, user_limit: v }))}</> : null}
      {cats.length ? <><T style={s.label}>Kategorie</T>{chips([[null, 'Ohne'], ...cats.map((x) => [x.id, x.name] as [string, string])], d.parent, (v) => setD({ ...d, parent: v }))}</> : null}
      <T style={s.label}>Wer darf den Kanal sehen?</T>
      {chips([['member', 'Alle'], ['mod', 'Ab Moderator'], ['admin', 'Nur Admins']], d.view_role, (v) => setD({ ...d, view_role: v }))}
      <View style={s.row2}>
        <Btn title="Speichern" small busy={busy} disabled={!d.name.trim()} onPress={save} style={{ flex: 1 }} />
        <Btn title="Löschen" small kind="danger" onPress={del} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ---------- Rollen ----------
function Roles({ sid, say }: P) {
  const sv = useStore((s) => s.servers.find((x) => x.id === sid))!;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const reload = () => loadMembers(sid).then((m) => setMembers(m as Member[])).catch(() => setMembers([]));
  useEffect(() => { reload(); }, []);
  const mine = sv.role;
  const rankOk = (rank?: string) => mine === 'owner' || RANK[rank || 'member'] < RANK[mine];
  const roles = sv.roles || [];
  const move = async (i: number, dir: number) => {
    const ids = roles.map((r) => r.id); [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    try { await api('POST', `/api/servers/${sid}/roles/order`, { ids }); await bootstrap(); } catch (e) { say(errText(e)); }
  };
  const create = async () => {
    try { const d = await api<any>('POST', `/api/servers/${sid}/roles`, { name: 'Neue Rolle', color: ROLE_COLORS[roles.length % ROLE_COLORS.length] }); await bootstrap(); setOpen(d.role.id); }
    catch (e) { say(errText(e)); }
  };
  return (
    <>
      <Btn title="Rolle erstellen" icon="plus" small onPress={create} />
      <T style={[s.hint, { marginTop: 10 }]}>Die oberste Rolle mit Farbe bestimmt die Namensfarbe. Schieb wichtige Rollen mit den Pfeilen nach oben.</T>
      {!roles.length ? <T style={[s.hint, { marginTop: 14 }]}>Noch keine eigenen Rollen. Rollen geben Leuten eine Farbe, ein Abzeichen und – wenn du willst – Mod- oder Admin-Rechte.</T> : null}
      {roles.map((r, i) => {
        const n = (members || []).filter((m) => (m.roles || []).includes(r.id)).length;
        return (
          <Glass key={r.id} style={[s.card, { marginTop: 8, padding: 0 }]} intensity={20}>
            <View style={s.chHead}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Rolle ${r.name} bearbeiten`} onPress={() => setOpen(open === r.id ? null : r.id)} style={s.chMain}>
                <View style={[s.roleDot, { backgroundColor: r.color || C.muted }]} />
                <T style={{ flex: 1, fontWeight: '700', color: r.color || C.text }} numberOfLines={1}>{r.name}</T>
                {r.rank && r.rank !== 'member' ? <View style={s.pill}><Icon name="shield" size={11} color={C.text2} /><T style={s.pillText}>{r.rank === 'admin' ? 'Admin' : 'Mod'}</T></View> : null}
                <T style={[s.hint, { marginTop: 0 }]}>{members ? n : ''}</T>
              </Pressable>
              <Arrow dir="up" disabled={i === 0} onPress={() => move(i, -1)} />
              <Arrow dir="down" disabled={i === roles.length - 1} onPress={() => move(i, 1)} />
            </View>
            {open === r.id ? <RoleEdit sid={sid} r={r} editable={rankOk(r.rank)} rankOk={rankOk} members={members} say={say} onChanged={reload} onGone={() => setOpen(null)} /> : null}
          </Glass>
        );
      })}
    </>
  );
}
function RoleEdit({ sid, r, editable, rankOk, members, say, onChanged, onGone }: { sid: string; r: Role; editable: boolean; rankOk: (k?: string) => boolean; members: Member[] | null; say: (t: string) => void; onChanged: () => void; onGone: () => void }) {
  const [d, setD] = useState({ name: r.name, color: r.color || null as string | null, rank: r.rank || 'member', hoist: !!r.hoist, mentionable: !!r.mentionable });
  const [q, setQ] = useState('');
  const save = async () => {
    try { await api('PATCH', '/api/roles/' + r.id, d); await bootstrap(); say('Gespeichert ✓'); } catch (e) { say(errText(e)); }
  };
  const del = () => ask(`Rolle „${r.name}“ löschen?`, 'Alle verlieren diese Rolle und die Rechte, die sie mitbringt.', 'Löschen', async () => { try { await api('DELETE', '/api/roles/' + r.id); onGone(); await bootstrap(); } catch (e) { say(errText(e)); } });
  const setHolder = async (m: Member, on: boolean) => {
    const cur = new Set(m.roles || []); on ? cur.add(r.id) : cur.delete(r.id);
    try { await api('PUT', `/api/servers/${sid}/members/${m.id}/roles`, { roles: [...cur] }); onChanged(); } catch (e) { say(errText(e)); }
  };
  const holders = (members || []).filter((m) => (m.roles || []).includes(r.id));
  const found = q.trim().length >= 1 ? (members || []).filter((m) => !(m.roles || []).includes(r.id) && (m.username.includes(q.trim().toLowerCase()) || (m.display || '').toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 8) : [];
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      {!editable ? <T style={s.hint}>Diese Rolle hat Admin-Rechte. Nur der Besitzer kann sie ändern.</T> : null}
      <T style={s.label}>Name</T>
      <TextInput value={d.name} onChangeText={(v) => setD({ ...d, name: v })} maxLength={32} editable={editable} style={s.input} />
      <T style={s.label}>Farbe</T>
      <View style={s.colors}>
        <Pressable disabled={!editable} accessibilityRole="radio" accessibilityLabel="Keine Farbe" onPress={() => setD({ ...d, color: null })} style={[s.dot, s.noColor, !d.color && s.dotOn]}><T style={{ color: C.muted }}>∅</T></Pressable>
        {ROLE_COLORS.map((c) => <Pressable key={c} disabled={!editable} accessibilityRole="radio" onPress={() => setD({ ...d, color: c })} style={[s.dot, { backgroundColor: c }, d.color === c && s.dotOn]} />)}
      </View>
      <T style={s.label}>Rechte</T>
      <View style={s.chips}>{(['member', 'mod', 'admin'] as const).map((k) => <Pressable key={k} disabled={!editable || !rankOk(k)} onPress={() => setD({ ...d, rank: k })} style={[s.chip, d.rank === k && s.chipOn, (!editable || !rankOk(k)) && { opacity: 0.4 }]}>
        <T style={[s.chipText, d.rank === k && { color: '#fff' }]}>{k === 'member' ? 'Nur Abzeichen' : k === 'mod' ? 'Moderator' : 'Admin'}</T></Pressable>)}</View>
      <T style={s.hint}>Moderator: rauswerfen, bannen, Timeout, Nachrichten löschen, im Sprachraum stummschalten und verschieben. Admin: dazu Kanäle, Rollen und Server-Einstellungen.</T>
      <View style={[s.switchRow, { marginTop: 12 }]}><T style={{ flex: 1 }}>In der Mitgliederliste getrennt anzeigen</T><Switch disabled={!editable} value={d.hoist} onValueChange={(v) => setD({ ...d, hoist: v })} trackColor={{ true: C.accent }} /></View>
      <View style={s.switchRow}><T style={{ flex: 1 }}>Jeder darf @{r.name} erwähnen</T><Switch disabled={!editable} value={d.mentionable} onValueChange={(v) => setD({ ...d, mentionable: v })} trackColor={{ true: C.accent }} /></View>
      {editable ? <View style={s.row2}><Btn title="Speichern" small onPress={save} style={{ flex: 1 }} /><Btn title="Löschen" small kind="danger" onPress={del} style={{ flex: 1 }} /></View> : null}
      <T style={s.label}>Mitglieder mit dieser Rolle</T>
      {!members ? <ActivityIndicator color={C.accent} /> : !holders.length ? <T style={s.hint}>Noch niemand.</T> : holders.map((m) => (
        <View key={m.id} style={s.person}>
          <Avatar user={m} size={30} frame={false} /><T style={{ flex: 1 }} numberOfLines={1}>{m.nick || m.display}</T>
          {editable ? <Pressable accessibilityRole="button" accessibilityLabel="Rolle wegnehmen" onPress={() => setHolder(m, false)} style={s.small}><Icon name="x" size={14} color={C.muted} /></Pressable> : null}
        </View>
      ))}
      {editable ? <>
        <TextInput value={q} onChangeText={setQ} placeholder="Mitglied hinzufügen …" placeholderTextColor={C.faint} style={[s.input, { marginTop: 8 }]} autoCapitalize="none" />
        {found.map((m) => (
          <Pressable key={m.id} accessibilityRole="button" onPress={() => { setHolder(m, true); setQ(''); }} style={s.person}>
            <Avatar user={m} size={30} frame={false} /><T style={{ flex: 1 }} numberOfLines={1}>{m.nick || m.display} <T style={s.hint}>@{m.username}</T></T><Icon name="plus" size={16} color={C.accent} />
          </Pressable>
        ))}
      </> : null}
    </View>
  );
}

// ---------- Mitglieder ----------
function Members({ sid, say }: P) {
  const sv = useStore((s) => s.servers.find((x) => x.id === sid))!;
  const me = useStore((s) => s.me);
  const router = useRouter();
  const [list, setList] = useState<Member[] | null>(null);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<Member | null>(null);
  const [act, setAct] = useState<'' | 'nick' | 'timeout' | 'ban' | 'roles' | 'base'>('');
  const [nick, setNick] = useState('');
  const [reason, setReason] = useState('');
  const reload = () => loadMembers(sid).then((m) => setList(m as Member[])).catch((e) => { setList([]); say(errText(e)); });
  useEffect(() => { reload(); }, []);
  const mine = sv.role, mod = can(sid, 'mod'), admin = can(sid, 'admin');
  const over = (m: Member) => m.id !== me?.id && (mine === 'owner' || RANK[mine] > RANK[m.role]);
  const run = async (fn: () => Promise<any>, ok: string) => { try { await fn(); say(ok); reload(); } catch (e) { say(errText(e)); } setAct(''); setMenu(null); };
  const ql = q.trim().toLowerCase();
  const rows = (list || []).filter((m) => !ql || m.username.includes(ql) || (m.display || '').toLowerCase().includes(ql) || (m.nick || '').toLowerCase().includes(ql))
    .sort((a, b) => RANK[b.role] - RANK[a.role] || (a.joined || 0) - (b.joined || 0)).slice(0, 300);
  const m = menu;
  return (
    <>
      <TextInput value={q} onChangeText={setQ} placeholder="Mitglied suchen …" placeholderTextColor={C.faint} style={s.input} autoCapitalize="none" />
      {!list ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : rows.map((x) => {
        const roles = (sv.roles || []).filter((r) => (x.roles || []).includes(r.id));
        const muted = (x.muted_until || 0) > Date.now();
        return (
          <Pressable key={x.id} accessibilityRole="button" onPress={() => setMenu(x)} style={s.person}>
            <Avatar user={x} size={38} status frame={false} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontWeight: '700' }} numberOfLines={1}>{x.nick || x.display}{muted ? '  ⏳' : ''}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {x.role !== 'member' ? <View style={s.pill}><T style={s.pillText}>{RANK_NAME[x.role] || x.role}</T></View> : null}
                {roles.map((r) => <View key={r.id} style={s.pill}><View style={[s.roleDot, { width: 8, height: 8, backgroundColor: r.color || C.muted }]} /><T style={s.pillText}>{r.name}</T></View>)}
              </View>
            </View>
            <Icon name="more" size={18} color={C.muted} />
          </Pressable>
        );
      })}
      <Sheet open={!!m && !act} onClose={() => setMenu(null)} title={m ? (m.nick || m.display) : ''} items={m ? [
        { label: 'Profil ansehen', icon: 'user', onPress: () => { const id = m.id; setMenu(null); router.push({ pathname: '/user/[id]', params: { id } }); } },
        (m.id === me?.id || (mod && over(m))) ? { label: 'Spitzname ändern', icon: 'edit', onPress: () => { setNick(m.nick || ''); setMenu(m); setAct('nick'); } } : null,
        admin && over(m) ? { label: 'Rollen', icon: 'shield', onPress: () => { setMenu(m); setAct('roles'); } } : null,
        admin && over(m) ? { label: 'Rang (Mitglied, Mod, Admin)', icon: 'shield', onPress: () => { setMenu(m); setAct('base'); } } : null,
        mod && over(m) ? { label: (m.muted_until || 0) > Date.now() ? 'Timeout beenden' : 'Timeout geben', icon: 'clock', onPress: () => {
          if ((m.muted_until || 0) > Date.now()) run(() => api('PATCH', `/api/servers/${sid}/members/${m.id}`, { timeout_minutes: 0 }), 'Timeout beendet'); else { setMenu(m); setAct('timeout'); }
        } } : null,
        mod && over(m) ? { label: 'Rauswerfen', icon: 'logout', danger: true, onPress: () => ask(`${m.display} rauswerfen?`, 'Die Person kann mit einer neuen Einladung wieder beitreten.', 'Rauswerfen', () => run(() => api('POST', `/api/servers/${sid}/kick/${m.id}`, {}), 'Rausgeworfen')) } : null,
        mod && over(m) ? { label: 'Bannen', icon: 'ban', danger: true, onPress: () => { setReason(''); setMenu(m); setAct('ban'); } } : null,
        mine === 'owner' && m.id !== me?.id ? { label: 'Besitz übertragen', icon: 'shield', danger: true, onPress: () => ask(`Server an ${m.display} übertragen?`, 'Du bist danach Admin, nicht mehr Besitzer. Das kann nur der neue Besitzer rückgängig machen.', 'Übertragen', () => run(() => api('POST', `/api/servers/${sid}/transfer`, { user_id: m.id }).then(bootstrap), 'Übertragen')) } : null,
      ] : []} />
      <Sheet open={!!m && act === 'timeout'} onClose={() => setAct('')} title="Timeout für …" items={[[5, '5 Minuten'], [60, '1 Stunde'], [1440, '1 Tag'], [10080, '1 Woche']].map(([n, l]) => ({ label: l as string, onPress: () => run(() => api('PATCH', `/api/servers/${sid}/members/${m!.id}`, { timeout_minutes: n }), 'Timeout gesetzt') }))} />
      <Sheet open={!!m && act === 'base'} onClose={() => setAct('')} title="Rang" items={(['member', 'mod', 'admin'] as const).filter((k) => mine === 'owner' || RANK[k] < RANK[mine]).map((k) => ({ label: (m?.role === k ? '✓ ' : '') + RANK_NAME[k], onPress: () => run(() => api('PATCH', `/api/servers/${sid}/members/${m!.id}`, { role: k }).then(bootstrap), 'Rang geändert') }))} />
      <Sheet open={!!m && act === 'roles'} onClose={() => setAct('')} title="Rollen" items={(sv.roles || []).filter((r) => mine === 'owner' || RANK[r.rank || 'member'] < RANK[mine]).map((r) => {
        const has = (m?.roles || []).includes(r.id);
        return { label: (has ? '✓ ' : '') + r.name, onPress: () => { const cur = new Set(m!.roles || []); has ? cur.delete(r.id) : cur.add(r.id); run(() => api('PUT', `/api/servers/${sid}/members/${m!.id}/roles`, { roles: [...cur] }), 'Rollen geändert'); } };
      })} />
      {m && (act === 'nick' || act === 'ban') ? (
        <View style={s.overlay}>
          <Glass style={[s.card, { width: '100%' }]} intensity={50} tint="rgba(19,20,32,0.95)">
            <T style={{ fontSize: 17, fontWeight: '800', marginBottom: 8 }}>{act === 'nick' ? 'Spitzname' : `${m.display} bannen`}</T>
            <TextInput autoFocus value={act === 'nick' ? nick : reason} onChangeText={act === 'nick' ? setNick : setReason} maxLength={act === 'nick' ? 32 : 200} placeholder={act === 'nick' ? 'leer = keiner' : 'Grund (freiwillig)'} placeholderTextColor={C.faint} style={s.input} />
            <View style={s.row2}>
              <Btn title="Abbrechen" small kind="secondary" onPress={() => setAct('')} style={{ flex: 1 }} />
              <Btn title={act === 'nick' ? 'Speichern' : 'Bannen'} small kind={act === 'ban' ? 'danger' : 'primary'} style={{ flex: 1 }}
                onPress={() => act === 'nick' ? run(() => api('PATCH', `/api/servers/${sid}/members/${m.id}`, { nick: nick.trim() || null }), 'Gespeichert ✓')
                  : run(() => api('POST', `/api/servers/${sid}/bans/${m.id}`, { reason, delete_messages: false }), 'Gebannt')} />
            </View>
          </Glass>
        </View>
      ) : null}
    </>
  );
}

// ---------- Einladungen, Banns, Protokoll ----------
function Invites({ sid, say }: P) {
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api<any>('GET', `/api/servers/${sid}/invites`).then((d) => setList(d.invites || [])).catch((e) => { setList([]); say(errText(e)); });
  useEffect(() => { load(); }, []);
  const url = (code: string) => `${BASE || 'https://zuno-app.altraex.workers.dev'}/i/${code}`;
  if (!list) return <ActivityIndicator color={C.accent} />;
  if (!list.length) return <T style={s.hint}>Keine aktiven Einladungen.</T>;
  return <>{list.map((inv) => (
    <Glass key={inv.code} style={[s.card, { marginBottom: 8 }]} intensity={20}>
      <T style={{ fontWeight: '800', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{inv.code}</T>
      <T style={s.hint}>{(inv.creator ? inv.creator.display + ' · ' : '') + `${inv.uses} mal benutzt · ` + (inv.expires ? `läuft ab ${new Date(inv.expires).toLocaleString('de-DE')}` : 'läuft nie ab')}</T>
      <View style={s.row2}>
        <Btn title="Link kopieren" small kind="secondary" style={{ flex: 1 }} onPress={async () => { await Clipboard.setStringAsync(url(inv.code)).catch(() => {}); say('Link kopiert'); }} />
        <Btn title="Löschen" small kind="danger" style={{ flex: 1 }} onPress={async () => { await api('DELETE', '/api/invites/' + inv.code).catch((e) => say(errText(e))); load(); }} />
      </View>
    </Glass>
  ))}</>;
}
function Bans({ sid, say }: P) {
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api<any>('GET', `/api/servers/${sid}/bans`).then((d) => { putUsers((d.bans || []).map((b: any) => b.user)); setList(d.bans || []); }).catch((e) => { setList([]); say(errText(e)); });
  useEffect(() => { load(); }, []);
  if (!list) return <ActivityIndicator color={C.accent} />;
  if (!list.length) return <T style={s.hint}>Niemand ist gebannt.</T>;
  return <>{list.map((b) => (
    <View key={b.user?.id} style={s.person}>
      <Avatar user={b.user} size={36} frame={false} />
      <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{b.user?.display || '?'}</T><T style={s.hint}>{b.reason || 'Kein Grund angegeben'}</T></View>
      <Btn title="Aufheben" small kind="secondary" onPress={async () => { await api('DELETE', `/api/servers/${sid}/bans/${b.user.id}`).catch((e) => say(errText(e))); load(); }} />
    </View>
  ))}</>;
}
const AUDIT: Record<string, string> = { kick: 'hat {b} rausgeworfen', ban: 'hat {b} gebannt', unban: 'hat den Bann von {b} aufgehoben', role: 'hat die Rolle von {b} geändert', timeout: 'hat {b} einen Timeout gegeben', timeout_end: 'hat den Timeout von {b} beendet',
  channel_create: 'hat einen Kanal erstellt', channel_update: 'hat einen Kanal geändert', channel_delete: 'hat einen Kanal gelöscht', server_update: 'hat den Server geändert', message_delete: 'hat eine Nachricht von {b} gelöscht', transfer: 'hat den Server an {b} übertragen' };
function Audit({ sid, say }: P) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { api<any>('GET', `/api/servers/${sid}/audit`).then((d) => setList(d.entries || [])).catch((e) => { setList([]); say(errText(e)); }); }, []);
  if (!list) return <ActivityIndicator color={C.accent} />;
  if (!list.length) return <T style={s.hint}>Noch keine Einträge.</T>;
  return <>{list.map((e, i) => (
    <View key={e.id || i} style={[s.person, { alignItems: 'flex-start' }]}>
      <Avatar user={e.actor} size={30} frame={false} />
      <View style={{ flex: 1 }}>
        <T><T style={{ fontWeight: '800' }}>{e.actor?.display || '?'}</T> {(AUDIT[e.action] || e.action).replace('{b}', e.target_user?.display || '')}</T>
        {e.detail ? <T style={s.hint}>{e.detail}</T> : null}
        <T style={[s.hint, { marginTop: 0 }]}>{timeLabel(e.created)}</T>
      </View>
    </View>
  ))}</>;
}
function Danger({ sid, say, onGone }: P & { onGone: () => void }) {
  const sv = serverOf(sid)!;
  const [name, setName] = useState('');
  const del = () => ask(`„${sv.name}“ endgültig löschen?`, 'Alle Kanäle, Nachrichten und Bilder werden gelöscht. Das kann nicht rückgängig gemacht werden.', 'Löschen', async () => {
    try { await api('DELETE', '/api/servers/' + sid); await bootstrap(); onGone(); } catch (e) { say(errText(e)); }
  });
  return (
    <Glass style={s.card} intensity={20}>
      <T style={{ color: C.text2, lineHeight: 21 }}>Alle Kanäle, Nachrichten und Bilder werden endgültig gelöscht. Das kann nicht rückgängig gemacht werden.</T>
      <T style={s.label}>Gib zur Bestätigung den Server-Namen ein</T>
      <TextInput value={name} onChangeText={setName} placeholder={sv.name} placeholderTextColor={C.faint} style={s.input} autoCapitalize="none" />
      <Btn title="Server endgültig löschen" kind="danger" disabled={name.trim() !== sv.name} onPress={del} style={{ marginTop: 14 }} />
    </Glass>
  );
}

const s = StyleSheet.create({
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  tabs: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { color: C.text2, fontWeight: '700', fontSize: 14 },
  card: { borderRadius: R.lg, padding: 14 },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 14, marginBottom: 6 },
  hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 13, minHeight: 44, fontSize: 15.5, fontFamily: F.medium, position: 'relative' },
  multi: { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' },
  link: { color: C.accent, fontWeight: '700', fontSize: 13.5 },
  row2: { flexDirection: 'row', gap: 8, marginTop: 12 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderColor: '#fff', transform: [{ scale: 1.08 }] },
  noColor: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: C.line },
  bannerBox: { height: 110, borderRadius: 16, overflow: 'visible', marginBottom: 46 },
  serverIcon: { position: 'absolute', left: 14, bottom: -40, width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, borderColor: C.bg2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chHead: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8, minHeight: 48 },
  chMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, minHeight: 48 },
  small: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text2, fontWeight: '700', fontSize: 13 },
  roleDot: { width: 12, height: 12, borderRadius: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  pillText: { color: C.text2, fontSize: 11.5, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  overlay: { position: 'absolute', left: -14, right: -14, top: -14, bottom: -400, backgroundColor: 'rgba(0,0,0,0.6)', padding: 20, paddingTop: 60 },
  note: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
});
