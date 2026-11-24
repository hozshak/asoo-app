// „Mitspieler finden“ – Likes & Matches: „Mag dich“ (anonyme Karten, zurück-liken = sofort Match), „Besucher“
// (wer die eigene Karte angesehen hat, anonym) und „Matches“ (ab hier mit Namen: schreiben, Profil, Match auflösen).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { putUsers, useStore } from '@/lib/store';
import { agoShort, likeCard, loadLikes, loadMatches, matchErr, showParty, unmatch, type MatchCard, type MatchPair } from '@/lib/match';
import { Art, CardMenu, CardPeek, GameChip, MiniCard } from '@/components/MatchBits';
import { Avatar, Badge, Btn, Glow, Sheet, T, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { C, HOME } from '@/lib/theme';

type Tab = 'likes' | 'views' | 'matches';

export default function MatchLikes() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const want = useLocalSearchParams<{ tab?: string }>();
  const badge = useStore((st) => st.match);
  // Zähler beim Öffnen merken – die Listen setzen sie beim Laden zurück, die Reiter sollen sie trotzdem noch zeigen
  const [counts] = useState(() => ({ likes: badge.likes, views: badge.views, matches: badge.matches }));
  const [tab, setTab] = useState<Tab>(want.tab === 'views' || want.tab === 'matches' ? want.tab : badge.likes ? 'likes' : badge.matches ? 'matches' : 'likes');
  const [likes, setLikes] = useState<MatchCard[] | null>(null);
  const [views, setViews] = useState<MatchCard[] | null>(null);
  const [pairs, setPairs] = useState<MatchPair[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [peek, setPeek] = useState<MatchCard | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [menuCard, setMenuCard] = useState<MatchCard | null>(null);
  const openMenu = (c: MatchCard) => { setMenuCard(c); setPeek(null); setTimeout(() => setMenu(c.pid), 280); };
  const [pairMenu, setPairMenu] = useState<MatchPair | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 3200); return () => clearTimeout(t); }, [note]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, m] = await Promise.all([loadLikes(), loadMatches()]);
      putUsers(m.matches.map((x) => x.user));
      setLikes(l.likes); setViews(l.views); setPairs(m.matches);
    } catch (e) { setNote(matchErr(e)); setLikes((x) => x || []); setViews((x) => x || []); setPairs((x) => x || []); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const like = async (c: MatchCard) => {
    if (!c.pid) return;
    try {
      const d = await likeCard(c.pid);
      setPeek(null);
      if (d.match) { showParty(d.match); load(); }
      else { setNote('Gelikt! Wenn die Person dich auch likt, habt ihr ein Match.'); setViews((l) => l && l.map((x) => (x.pid === c.pid ? { ...x, liked: true } : x))); }
    } catch (e) { setNote(matchErr(e)); }
  };
  const drop = (pid: string | null) => { setPeek(null); setLikes((l) => l && l.filter((x) => x.pid !== pid)); setViews((l) => l && l.filter((x) => x.pid !== pid)); };
  const askUnmatch = (p: MatchPair) => {
    const go = async () => { try { await unmatch(p.user.id); setNote('Match aufgelöst.'); load(); } catch (e) { setNote(matchErr(e)); } };
    const text = 'Ihr seid dann nicht mehr verbunden und könnt euch nicht mehr schreiben. Die Person bekommt keine Nachricht darüber.';
    if (Platform.OS === 'web') { if (confirm(`Match mit ${p.user.display} auflösen?\n\n${text}`)) go(); return; }
    Alert.alert(`Match mit ${p.user.display} auflösen?`, text, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Auflösen', style: 'destructive', onPress: go }]);
  };

  const tabs: [Tab, string, number][] = [['likes', 'Mag dich', counts.likes], ['views', 'Besucher', counts.views], ['matches', 'Matches', counts.matches]];
  const list = tab === 'likes' ? likes : tab === 'views' ? views : null;
  const rows: MatchCard[][] = [];
  if (list) for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <TopBar title="Likes & Matches" onBack={() => (router.canGoBack() ? router.back() : router.replace('/match'))} />
      <View style={s.tabs}>
        {tabs.map(([k, label, n]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <T style={[s.tabText, tab === k && { color: C.text }]} numberOfLines={1}>{label}</T>
            {n ? <Badge n={n} style={{ borderWidth: 0 }} /> : null}
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: ins.bottom + 40 }} refreshControl={<RefreshControl refreshing={loading && !!likes} onRefresh={load} tintColor={C.accent} />}>
        {tab !== 'matches' ? (
          !list ? <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />
          : !list.length ? (
            <Hole title={tab === 'likes' ? 'Noch keine Likes' : 'Noch keine Besucher'} text={tab === 'likes' ? 'Sobald jemand deine Karte likt, steht sie hier – du kannst direkt zurück-liken.' : 'Hier siehst du, wer sich deine Karte angesehen hat – ohne Namen, bis ihr ein Match habt.'} onGo={() => router.replace('/match')} />
          ) : <>
            <T style={s.lead}>{tab === 'likes' ? 'Diese Leute mögen deine Karte. Like zurück – dann habt ihr sofort ein Match.' : 'Diese Leute haben sich deine Karte angesehen (letzte 30 Tage).'}</T>
            {rows.map((row, i) => (
              <Animated.View key={row[0].pid} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)} style={s.row2}>
                {row.map((c) => <MiniCard key={c.pid} c={c} kind={tab} onOpen={() => setPeek(c)} onLike={() => like(c)} />)}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </Animated.View>
            ))}
          </>
        ) : !pairs ? <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />
          : !pairs.length ? <Hole title="Noch kein Match" text="Like Karten, die zu dir passen. Likt dich die Person auch, landet ihr hier – mit Namen und Chat." onGo={() => router.replace('/match')} />
          : pairs.map((p, i) => (
            <Animated.View key={p.user.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)}>
              <View style={[s.pair, p.fresh && s.pairFresh]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Nachricht an ${p.user.display}`} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: p.dm } })} onLongPress={() => setPairMenu(p)} style={({ pressed }) => [s.pairMain, pressed && { opacity: 0.7 }]}>
                <Avatar user={p.user} size={54} status />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T style={{ fontSize: 16.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{p.user.display}</T>
                    {p.fresh ? <View style={s.new}><T style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Neu</T></View> : null}
                  </View>
                  <T style={{ color: C.muted, fontSize: 12.5 }}>Match {agoShort(p.created)}</T>
                  {p.games.length ? <View style={s.pairGames}>{p.games.slice(0, 2).map((g) => <GameChip key={g} name={g} small />)}</View> : null}
                </View>
                <View style={s.write}><Icon name="comment" size={18} color="#fff" /></View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Mehr" hitSlop={10} onPress={() => setPairMenu(p)} style={{ padding: 4 }}><Icon name="more" size={20} color={C.muted} /></Pressable>
              </View>
            </Animated.View>
          ))}
      </ScrollView>
      {note ? <View style={[s.note, { bottom: ins.bottom + 24 }]} pointerEvents="none"><T style={{ fontWeight: '700', textAlign: 'center' }}>{note}</T></View> : null}
      <CardPeek c={peek} kind={tab === 'views' ? 'views' : 'likes'} onClose={() => setPeek(null)} onLike={() => peek && like(peek)} onMore={() => peek && openMenu(peek)} />
      <CardMenu pid={menu} onClose={() => setMenu(null)} say={setNote} done={() => drop(menuCard?.pid || null)} />
      <Sheet open={!!pairMenu} onClose={() => setPairMenu(null)} title={pairMenu?.user.display} items={pairMenu ? [
        { label: 'Nachricht schreiben', icon: 'comment', onPress: () => router.push({ pathname: '/chat/[id]', params: { id: pairMenu.dm } }) },
        { label: 'Profil ansehen', icon: 'user', onPress: () => router.push({ pathname: '/user/[id]', params: { id: pairMenu.user.id } }) },
        { label: 'Match auflösen', icon: 'x', danger: true, onPress: () => askUnmatch(pairMenu) },
      ] : []} />
    </View>
  );
}

function Hole({ title, text, onGo }: { title: string; text: string; onGo: () => void }) {
  return (
    <View style={s.hole}>
      <Art size={64} />
      <T style={{ fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' }}>{title}</T>
      <T style={{ color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 }}>{text}</T>
      <Btn title="Karten ansehen" icon="pad" onPress={onGo} style={{ alignSelf: 'stretch', marginTop: 18 }} />
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, marginHorizontal: 12, marginTop: 10, padding: 4, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: C.line },
  tab: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  tabOn: { backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line },
  tabText: { color: C.muted, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  lead: { color: C.muted, marginBottom: 12, lineHeight: 20, paddingHorizontal: 2 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, marginBottom: 10 },
  pairFresh: { borderColor: C.accentLine },
  pairMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pairGames: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  new: { paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  write: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  hole: { alignItems: 'center', padding: 26, marginTop: 20, borderRadius: 26, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accentLine, backgroundColor: HOME.panel },
  note: { position: 'absolute', left: 24, right: 24, padding: 12, borderRadius: 14, backgroundColor: 'rgba(32,33,49,0.97)', borderWidth: 1, borderColor: C.line },
});
