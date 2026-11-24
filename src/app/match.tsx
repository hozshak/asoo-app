// „Mitspieler finden“ – Karten-Stapel: anonyme Karten (ohne Namen), nach rechts wischen = Like, nach links = überspringen,
// darunter die Knöpfe (Zurückholen, Überspringen, Like, Boost). Gegenseitiges Like = Match (Feier → Chat).
// Ohne Gamer-Profil: Begrüßung mit Knopf zur Einrichtung. Server: /api/match/* (lib/match.ts).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { PLATFORM, boost, likeCard, loadDeck, loadSelf, matchErr, matchNew, mins, passCard, setVisible, showParty, undoPass, viewCard, type MatchCard, type MatchSelf } from '@/lib/match';
import { Art, CardMenu, GameChip, MatchCardView } from '@/components/MatchBits';
import { Badge, Btn, Glow, Sheet, T, TopBar } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { C, GRAD, GRAD_POS, HOME } from '@/lib/theme';

const buzz = (strong = false) => { if (Platform.OS !== 'web') (strong ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) : Haptics.selectionAsync()).catch(() => {}); };

type SwipeRef = { fling: (dir: 1 | -1) => void };
/** Oberste Karte: mit dem Finger ziehen (rechts = Like, links = überspringen); senkrecht lässt sich die Karte lesen. */
const SwipeCard = forwardRef<SwipeRef, { card: MatchCard; onSwipe: (dir: 1 | -1) => void; onMore: () => void }>(function SwipeCard({ card, onSwipe, onMore }, ref) {
  const tx = useSharedValue(0), ty = useSharedValue(0);
  const done = useRef(false);
  const finish = (dir: 1 | -1) => { if (done.current) return; done.current = true; onSwipe(dir); };
  const fling = (dir: 1 | -1) => {
    if (done.current) return;
    tx.value = withTiming(dir * 560, { duration: 230 }, (fin) => { if (fin) runOnJS(finish)(dir); });
    ty.value = withTiming(-30, { duration: 230 });
  };
  useImperativeHandle(ref, () => ({ fling }));
  const pan = Gesture.Pan().activeOffsetX([-14, 14]).failOffsetY([-16, 16])
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY * 0.12; })
    .onEnd((e) => {
      if (Math.abs(tx.value) > 110 || Math.abs(e.velocityX) > 950) {
        const dir = tx.value > 0 ? 1 : -1;
        tx.value = withTiming(dir * 560, { duration: 200 }, (fin) => { if (fin) runOnJS(finish)(dir as 1 | -1); });
      } else { tx.value = withSpring(0, { damping: 16, stiffness: 180 }); ty.value = withSpring(0); }
    });
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${interpolate(tx.value, [-300, 300], [-13, 13])}deg` }] }));
  const yes = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [20, 110], [0, 1], 'clamp') }));
  const no = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-110, -20], [1, 0], 'clamp') }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, move]}>
        <ScrollView style={s.cardScroll} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
          <MatchCardView c={card} onMore={onMore} style={{ flexGrow: 1 }} />
        </ScrollView>
        <Animated.View pointerEvents="none" style={[s.stamp, s.stampYes, yes]}><T style={[s.stampText, { color: C.ok }]}>Passt!</T></Animated.View>
        <Animated.View pointerEvents="none" style={[s.stamp, s.stampNo, no]}><T style={[s.stampText, { color: C.danger }]}>Weiter</T></Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

function Round({ icon, label, onPress, kind, disabled, size = 58 }: { icon: IconName; label: string; onPress: () => void; kind?: 'yes' | 'no' | 'boost' | 'boostOn'; disabled?: boolean; size?: number }) {
  const color = kind === 'yes' ? '#fff' : kind === 'no' ? C.danger : kind === 'boost' || kind === 'boostOn' ? '#ffb02e' : C.text2;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2 }, kind === 'boostOn' && s.boostOn, kind === 'yes' && s.roundYes, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}>
      {kind === 'yes' ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} /> : null}
      <View><Icon name={icon} size={size * 0.42} color={color} stroke={2.3} /></View>
    </Pressable>
  );
}

export default function Match() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const badge = useStore((st) => st.match);
  const [self, setSelf] = useState<MatchSelf | null>(null);
  const [deck, setDeck] = useState<MatchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState({ more: false, filtered: false });
  const [filter, setFilter] = useState<{ game: string; platform: string }>({ game: '', platform: '' });
  const [canUndo, setCanUndo] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [games, setGames] = useState(false);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(Date.now());
  const top = useRef<SwipeRef>(null);
  const viewed = useRef(new Set<string>());
  const busy = useRef(false);
  const say = (t: string) => setNote(t);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 3200); return () => clearTimeout(t); }, [note]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const fetchDeck = useCallback(async (f: { game: string; platform: string }, have: MatchCard[] = []) => {
    setLoading(true);
    try {
      const d = await loadDeck(f, have.map((c) => c.pid!).filter(Boolean));
      const known = new Set(have.map((c) => c.pid));
      setDeck([...have, ...d.cards.filter((c) => !known.has(c.pid))]);
      setInfo({ more: d.more, filtered: d.filtered });
    } catch (e) { say(matchErr(e)); } finally { setLoading(false); }
  }, []);
  // beim Öffnen und bei der Rückkehr (aus dem Profil, den Listen): eigenes Profil frisch laden; Stapel nur, wenn er leer ist
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    let off = false;
    loadSelf().then((d) => {
      if (off) return;
      setSelf(d);
      if (d.profile && (first.current || !deckRef.current.length)) { first.current = false; fetchDeck(filterRef.current, []); }
    }).catch((e) => say(matchErr(e)));
    return () => { off = true; };
  }, [fetchDeck]));
  const deckRef = useRef(deck); deckRef.current = deck;
  const filterRef = useRef(filter); filterRef.current = filter;

  const card = deck[0] || null;
  // die Karte liegt oben: zählt als Profil-Besuch (der Server zählt je Person nur einmal am Tag)
  useEffect(() => { if (card?.pid && !viewed.current.has(card.pid)) { viewed.current.add(card.pid); viewCard(card.pid); } }, [card?.pid]);

  const swiped = async (dir: 1 | -1) => {
    const c = deckRef.current[0];
    if (!c?.pid || busy.current) return;
    busy.current = true;
    const rest = deckRef.current.slice(1);
    setDeck(rest);
    try {
      if (dir === 1) {
        buzz(true);
        const d = await likeCard(c.pid);
        setSelf((x) => (x ? { ...x, likes_left: typeof d.left === 'number' ? d.left : Math.max(0, x.likes_left - 1) } : x));
        setCanUndo(false);
        if (d.match) showParty(d.match);
      } else { await passCard(c.pid); setCanUndo(true); }
    } catch (e) {
      say(matchErr(e));
      setDeck([c, ...rest]); // nicht geklappt (z. B. Likes aufgebraucht): Karte bleibt
    }
    busy.current = false;
    if (rest.length < 3 && info.more) fetchDeck(filterRef.current, rest);
  };
  const undo = async () => {
    buzz();
    try { const d = await undoPass(); setDeck((l) => [d.card, ...l.filter((c) => c.pid !== d.card.pid)]); } catch (e) { say(matchErr(e)); }
    setCanUndo(false);
  };
  const pickFilter = (f: { game: string; platform: string }) => { setFilter(f); setDeck([]); fetchDeck(f, []); };
  const doBoost = async () => {
    if (!self) return;
    buzz(true);
    if (self.boost.until > Date.now()) return say(`Dein Profil steht gerade ganz vorn – noch ${mins(self.boost.until - Date.now())}.`);
    if (self.boost.next > Date.now()) return say(`Boost wieder möglich in ${mins(self.boost.next - Date.now())}.`);
    try { const d = await boost(); setSelf(d); say(`Dein Profil steht jetzt ${d.boost.minutes} Minuten ganz vorn.`); } catch (e) { say(matchErr(e)); }
  };

  const likesBtn = (
    <Pressable accessibilityRole="button" accessibilityLabel="Likes und Matches" hitSlop={6} onPress={() => router.push('/match-likes')} style={({ pressed }) => [s.topBtn, pressed && { backgroundColor: C.accentSoft }]}>
      <Icon name="heart" size={18} color={C.text2} stroke={2.2} />
      {matchNew(badge) || badge.views ? <Badge n={matchNew(badge) || badge.views} style={s.topBadge} /> : null}
    </Pressable>
  );
  const profileBtn = (
    <Pressable accessibilityRole="button" accessibilityLabel="Mein Gamer-Profil" hitSlop={6} onPress={() => router.push('/match-profile')} style={({ pressed }) => [s.topBtn, pressed && { backgroundColor: C.accentSoft }]}>
      <Icon name="edit" size={17} color={C.text2} stroke={2.2} />
    </Pressable>
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const boosting = !!self && self.boost.until > now;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <TopBar onBack={back} title={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="pad" size={20} color={C.accent} /><T style={{ fontSize: 17, fontWeight: '800' }} numberOfLines={1}>Mitspieler finden</T></View>}
        right={self?.profile ? <>{likesBtn}{profileBtn}</> : undefined} />
      {!self ? <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />
        : !self.profile ? <Intro onStart={() => router.push('/match-profile')} bottom={ins.bottom} />
        : <View style={{ flex: 1 }}>
            {/* Filter: Spiel (Auswahl von unten) und Plattform */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.filters}>
              <Pressable accessibilityRole="button" accessibilityLabel="Nach Spiel filtern" onPress={() => { buzz(); setGames(true); }} style={[s.chip, !!filter.game && s.chipOn]}>
                <Icon name="filter" size={14} color={filter.game ? C.accent : C.text2} />
                <T style={[s.chipText, !!filter.game && { color: '#c9bcff' }]} numberOfLines={1}>{filter.game || 'Alle Spiele'}</T>
                <Icon name="chevron" size={12} color={C.muted} stroke={2.6} />
              </Pressable>
              {['', ...self.catalog.platforms].map((p) => (
                <Pressable key={p || 'all'} accessibilityRole="button" accessibilityState={{ selected: filter.platform === p }} onPress={() => { buzz(); pickFilter({ ...filter, platform: p }); }} style={[s.chip, filter.platform === p && s.chipOn]}>
                  <T style={[s.chipText, filter.platform === p && { color: '#c9bcff' }]}>{p ? PLATFORM[p] : 'Alle'}</T>
                </Pressable>
              ))}
            </ScrollView>
            {!self.profile.visible ? (
              <Pressable accessibilityRole="button" onPress={async () => { try { setSelf(await setVisible(true)); say('Dein Profil ist wieder sichtbar.'); } catch (e) { say(matchErr(e)); } }} style={s.paused}>
                <Icon name="moon" size={16} color={C.warn} />
                <T style={{ flex: 1, color: C.text2, fontSize: 13.5 }}>Dein Profil ist pausiert – niemand sieht deine Karte.</T>
                <T style={{ color: C.warn, fontWeight: '800', fontSize: 13.5 }}>Einschalten</T>
              </Pressable>
            ) : null}

            <View style={s.stage}>
              {deck[1] ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.under]} /> : null}
              {card ? <SwipeCard key={card.pid} ref={top} card={card} onSwipe={swiped} onMore={() => setMenu(card.pid)} />
                : loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 80 }} />
                : (
                  <Animated.View entering={FadeInDown.duration(240)} style={s.empty}>
                    <Art size={70} />
                    <T style={s.emptyTitle}>{info.filtered ? 'Mit diesem Filter ist gerade niemand da' : 'Du hast alle gesehen'}</T>
                    <T style={s.emptyText}>{info.filtered ? 'Lockere den Filter, dann findest du mehr Leute.' : 'Schau später wieder vorbei – übersprungene Karten kommen nach zwei Wochen zurück. Ein Boost bringt dich nach vorn, und mehr Spiele im Profil bringen mehr Treffer.'}</T>
                    {info.filtered ? <Btn title="Filter zurücksetzen" onPress={() => pickFilter({ game: '', platform: '' })} style={{ alignSelf: 'stretch', marginTop: 16 }} />
                      : <Btn title="Profil bearbeiten" kind="secondary" icon="edit" onPress={() => router.push('/match-profile')} style={{ alignSelf: 'stretch', marginTop: 16 }} />}
                    {canUndo ? <Btn title="Letzte Karte zurückholen" kind="ghost" icon="back" onPress={undo} style={{ alignSelf: 'stretch', marginTop: 6 }} /> : null}
                  </Animated.View>
                )}
            </View>

            <View style={[s.actions, { paddingBottom: Math.max(ins.bottom, 10) + 4 }]}>
              <View style={s.actionRow}>
                <Round icon="back" label="Letzte Karte zurückholen" size={46} disabled={!canUndo} onPress={undo} />
                <Round icon="x" label="Überspringen" kind="no" size={62} disabled={!card} onPress={() => { buzz(); top.current?.fling(-1); }} />
                <Round icon="heart" label="Liken" kind="yes" size={72} disabled={!card} onPress={() => top.current?.fling(1)} />
                <Round icon="bolt" label="Profil pushen" kind={boosting ? 'boostOn' : 'boost'} size={46} onPress={doBoost} />
              </View>
              <T style={s.hint} numberOfLines={1}>{boosting ? `Boost läuft · noch ${mins(self.boost.until - now)}` : `Noch ${self.likes_left} Likes heute`}</T>
            </View>
          </View>}

      {note ? <Animated.View entering={FadeInDown.duration(160)} style={[s.note, { bottom: ins.bottom + 150 }]} pointerEvents="none"><T style={{ fontWeight: '700', textAlign: 'center' }}>{note}</T></Animated.View> : null}
      <CardMenu pid={menu} onClose={() => setMenu(null)} say={say} done={() => setDeck((l) => l.slice(1))} />
      {self?.profile ? (
        <Sheet open={games} onClose={() => setGames(false)} title="Nach Spiel filtern" header={
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={s.gameSheet}>
            <GameFilter label="Alle Spiele" on={!filter.game} onPress={() => { setGames(false); pickFilter({ ...filter, game: '' }); }} />
            {[...new Set([...self.profile.games, ...self.catalog.games])].map((g) => (
              <GameChip key={g} name={g} on={filter.game === g} onPress={() => { setGames(false); pickFilter({ ...filter, game: g }); }} />
            ))}
          </ScrollView>
        } items={[]} />
      ) : null}
    </View>
  );
}

const GameFilter = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={[s.chip, on && s.chipOn, { height: 36 }]}><T style={[s.chipText, on && { color: '#c9bcff' }]}>{label}</T></Pressable>
);

function Intro({ onStart, bottom }: { onStart: () => void; bottom: number }) {
  const Point = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
    <View style={s.point}>
      <View style={s.pointIc}><Icon name={icon} size={19} color={C.accent} /></View>
      <View style={{ flex: 1 }}><T style={{ fontWeight: '800', fontSize: 15.5 }}>{title}</T><T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19 }}>{text}</T></View>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottom + 30, alignItems: 'center' }}>
      <Animated.View entering={FadeInDown.duration(280)} style={{ alignItems: 'center', marginTop: 18 }}>
        <Art />
        <T style={s.introTitle}>Finde Leute zum Zocken</T>
        <T style={s.introText}>Sag, was du spielst und wann du Zeit hast – wir zeigen dir Leute, die dazu passen.</T>
      </Animated.View>
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 22 }}>
        <Point icon="user" title="Erst einmal anonym" text="Andere sehen dein Profilbild, Banner und deine Spiele – aber nicht deinen Namen." />
        <Point icon="heart" title="Gegenseitiges Like = Match" text="Erst wenn ihr euch beide likt, seht ihr eure Namen und könnt in Asoo schreiben." />
        <Point icon="shield" title="Du bestimmst" text="Profil jederzeit pausieren oder löschen, Karten melden oder blockieren." />
      </View>
      <Btn title="Gamer-Profil einrichten" icon="pad" onPress={onStart} style={{ alignSelf: 'stretch', marginTop: 22 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  topBadge: { position: 'absolute', right: -6, top: -6 },
  filters: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 7, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, maxWidth: 220 },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { fontWeight: '700', fontSize: 13.5, color: C.text2, flexShrink: 1 },
  paused: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,176,46,0.1)', borderWidth: 1, borderColor: 'rgba(255,176,46,0.35)' },
  stage: { flex: 1, marginHorizontal: 12, marginTop: 4, marginBottom: 6 },
  under: { borderRadius: 26, backgroundColor: HOME.panel, borderWidth: 1, borderColor: HOME.edge, opacity: 0.6, transform: [{ translateY: 10 }, { scale: 0.95 }] },
  cardScroll: { flex: 1, borderRadius: 26, backgroundColor: HOME.panel },
  stamp: { position: 'absolute', top: 30, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, borderWidth: 3, backgroundColor: 'rgba(10,10,18,0.6)' },
  stampYes: { left: 20, borderColor: C.ok, transform: [{ rotate: '-12deg' }] },
  stampNo: { right: 20, borderColor: C.danger, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 24, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  actions: { alignItems: 'center', paddingTop: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  round: { alignItems: 'center', justifyContent: 'center', backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  roundYes: { borderColor: 'transparent', shadowColor: '#8468ff', shadowOpacity: 0.75, shadowRadius: 16 },
  boostOn: { borderColor: '#ffb02e', backgroundColor: 'rgba(255,176,46,0.16)', shadowColor: '#ffb02e', shadowOpacity: 0.7 },
  hint: { color: C.muted, fontSize: 12.5, marginTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, borderRadius: 26, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accentLine, backgroundColor: HOME.panel },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  emptyText: { color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  note: { position: 'absolute', left: 24, right: 24, padding: 12, borderRadius: 14, backgroundColor: 'rgba(32,33,49,0.97)', borderWidth: 1, borderColor: C.line },
  gameSheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 8, paddingBottom: 10 },
  introTitle: { fontSize: 27, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  introText: { color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 22, fontSize: 15.5, maxWidth: 340 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge },
  pointIc: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentSoft },
});
