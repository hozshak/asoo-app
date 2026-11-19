// Start wie die Web-App am Handy: links die Leiste (Direktnachrichten, Server im Farbverlauf, wenn ausgewählt),
// rechts eine schwebende Glasfläche mit Direktnachrichten oder den Kanälen des Servers (Banner, Kategorien, Schloss).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { Avatar, Badge, Empty, Glass, Glow, Press, Section, ServerIcon, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { mediaSource } from '@/lib/api';
import { dmTitle, markRead, useStore, type Channel, type Server } from '@/lib/store';
import { C, GRAD, GRAD_POS } from '@/lib/theme';

export default function Home() {
  const servers = useStore((s) => s.servers);
  const unread = useStore((s) => s.unread);
  const mentions = useStore((s) => s.mentions);
  const dmUnread = useStore((s) => s.dms.reduce((n, d) => n + (s.unread[d.id] || 0), 0));
  const [sel, setSel] = useState<string | null>(null); // null = Direktnachrichten
  const server = servers.find((x) => x.id === sel) || null;
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SafeAreaView edges={['top']} style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView style={s.rail} contentContainerStyle={{ alignItems: 'center', paddingVertical: 12, gap: 10, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          <RailItem active={!sel} onPress={() => setSel(null)} label="Direktnachrichten" badge={dmUnread}>
            {!sel ? <View style={[s.dmBtn, s.dmOn]}><LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View><Icon name="comment" size={24} color="#fff" stroke={2.2} /></View></View>
              : <View style={s.dmBtn}><Icon name="comment" size={24} color={C.text2} /></View>}
          </RailItem>
          <View style={s.railSep} />
          {servers.map((sv) => {
            const has = sv.channels.some((c) => unread[c.id]);
            const ment = sv.channels.reduce((n, c) => n + (mentions[c.id] || 0), 0);
            return <RailItem key={sv.id} active={sel === sv.id} unread={has} badge={ment} onPress={() => setSel(sv.id)} label={sv.name}><ServerIcon server={sv} size={48} active={sel === sv.id} /></RailItem>;
          })}
        </ScrollView>
        <Glass style={s.panel} intensity={30} tint="rgba(14,15,24,0.86)">
          {server ? <ServerPanel key={server.id} server={server} /> : <DmPanel />}
        </Glass>
      </SafeAreaView>
    </View>
  );
}

function RailItem({ active, unread, badge, onPress, label, children }: { active: boolean; unread?: boolean; badge?: number; onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 72, alignItems: 'center' }}>
      {active ? <Animated.View entering={FadeIn} style={[s.pip, { height: 40 }]} /> : unread ? <View style={[s.pip, { height: 8, backgroundColor: C.text }]} /> : null}
      <Press onPress={onPress} label={label} scale={0.92}>{children}</Press>
      {badge ? <Badge n={badge} style={{ position: 'absolute', right: 8, bottom: -4 }} /> : null}
    </View>
  );
}

function DmPanel() {
  const dms = useStore((s) => s.dms);
  const me = useStore((s) => s.me);
  const unread = useStore((s) => s.unread);
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={s.head}><T style={s.headText}>Direktnachrichten</T></View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/friends')} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
        <View style={[s.iconBubble]}><Icon name="userPlus" size={20} color={C.accent} /></View>
        <T style={[s.rowName, { color: C.text2 }]}>Freunde finden</T>
      </Pressable>
      <Section style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 4 }}>Gespräche</Section>
      {!dms.length ? <Empty icon="comment" title="Noch keine Gespräche" text="Unter „Freunde“ findest du Leute und kannst ihnen schreiben." /> : null}
      {dms.map((d, i) => {
        const other = d.kind === 'dm' ? d.members.find((u) => u.id !== me?.id) : null;
        const n = unread[d.id];
        return (
          <Animated.View key={d.id} entering={FadeInRight.delay(i * 30).duration(300)} layout={LinearTransition}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: d.id } })} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
              {other ? <Avatar user={other} size={42} status /> : <LinearGradient colors={GRAD as any} style={s.group}><Icon name="users" size={20} color="#fff" /></LinearGradient>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={[s.rowName, n ? { color: C.text, fontWeight: '800' } : null]} numberOfLines={1}>{dmTitle(d, me?.id)}</T>
                {other?.custom_status ? <T style={s.rowSub} numberOfLines={1}>{other.custom_status}</T> : d.kind === 'group' ? <T style={s.rowSub}>{d.members.length} Mitglieder</T> : null}
              </View>
              {n ? <Badge n={n} /> : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

function ServerPanel({ server }: { server: Server }) {
  const router = useRouter();
  const unread = useStore((s) => s.unread);
  const mentions = useStore((s) => s.mentions);
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const cats = server.categories || [];
    const known = new Set(cats.map((c) => c.id));
    if (!cats.length) return [
      { id: '_t', name: 'Textkanäle', chs: server.channels.filter((c) => c.type === 'text') },
      { id: '_v', name: 'Sprachräume', chs: server.channels.filter((c) => c.type !== 'text') },
    ];
    return [{ id: '_', name: '', chs: server.channels.filter((c) => !c.parent || !known.has(c.parent)) }, ...cats.map((cat) => ({ id: cat.id, name: cat.name, chs: server.channels.filter((c) => c.parent === cat.id) }))];
  }, [server]);
  // Textkanäle nativ, Sprach- und 3D-Räume aus der Web-App (room.tsx)
  const open = (c: Channel) => {
    if (c.type !== 'text') return router.push({ pathname: '/room', params: { path: `/channels/${server.id}/${c.id}` } });
    markRead(c.id); router.push({ pathname: '/chat/[id]', params: { id: c.id } });
  };
  const banner = mediaSource(server.banner);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
      {banner ? <View style={s.banner}><Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={['transparent', 'rgba(14,15,24,0.95)']} style={StyleSheet.absoluteFill} /><T style={[s.headText, { position: 'absolute', left: 16, bottom: 10 }]} numberOfLines={1}>{server.name}</T></View>
        : <View style={s.head}><T style={s.headText} numberOfLines={1}>{server.name}</T>{server.member_count ? <T style={s.headSub}>{server.member_count} Mitglieder</T> : null}</View>}
      {groups.map((g) => (!g.chs.length && g.id !== '_') ? null : (
        <View key={g.id}>
          {g.name ? <Pressable accessibilityRole="button" onPress={() => setShut((x) => ({ ...x, [g.id]: !x[g.id] }))} style={s.cat}>
            <View style={{ transform: [{ rotate: shut[g.id] ? '-90deg' : '0deg' }] }}><Icon name="chevron" size={12} color={C.faint} stroke={2.6} /></View>
            <Section style={{ flex: 1 }}>{g.name}</Section>
          </Pressable> : null}
          {(shut[g.id] ? [] : g.chs).map((c) => {
            const priv = c.view_role && c.view_role !== 'member';
            const n = unread[c.id], m = mentions[c.id];
            return (
              <Pressable key={c.id} accessibilityRole="button" onPress={() => open(c)} style={({ pressed }) => [s.ch, pressed && s.chPressed]}>
                <View>
                  <Icon name={c.type === 'text' ? 'hash' : c.type === 'voice3d' ? 'cube' : 'volume'} size={18} color={n ? C.text : C.faint} />
                  {priv ? <View style={s.lock}><Icon name="lock" size={9} color={C.text2} stroke={2.6} /></View> : null}
                </View>
                <T style={[s.chName, n ? { color: C.text, fontWeight: '700' } : null]} numberOfLines={1}>{c.name}</T>
                {m ? <Badge n={m} /> : n ? <View style={s.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { width: 72, flexGrow: 0 },
  dmBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dmOn: { borderColor: 'transparent', shadowColor: '#8468ff', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  railSep: { width: 28, height: 1, backgroundColor: C.line },
  pip: { position: 'absolute', left: 0, top: '50%', marginTop: -20, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.accent },
  panel: { flex: 1, borderTopLeftRadius: 22, borderRightWidth: 0, borderBottomWidth: 0 },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 6 },
  headText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  headSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  banner: { height: 120, overflow: 'hidden', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: 8, borderRadius: 14 },
  rowPressed: { backgroundColor: C.accentSoft },
  rowName: { color: C.text2, fontSize: 16, fontWeight: '600' },
  rowSub: { color: C.muted, fontSize: 13, marginTop: -2 },
  iconBubble: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center' },
  group: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 42, marginHorizontal: 8, borderRadius: 12 },
  chPressed: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine },
  chName: { color: C.muted, fontSize: 16, flex: 1, fontWeight: '500' },
  lock: { position: 'absolute', right: -5, bottom: -4, backgroundColor: C.bg2, borderRadius: 6, padding: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.text },
});
