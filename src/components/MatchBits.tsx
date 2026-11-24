// Bausteine für „Mitspieler finden“: Spiel-Chip, Wochenraster, die große anonyme Karte, kleine Karte für Listen,
// Menü (Melden/Blockieren) und die Feier nach einem Match (liegt über der ganzen App).
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { mediaSource } from '@/lib/api';
import { useStore } from '@/lib/store';
import { ACTIVE, DAYS, LANG_NAME, LOOKING, PLATFORM, REASONS, SLOTS, STYLE, agoShort, blockCard, gameTile, matchErr, reportCard, showParty, useParty, type MatchCard } from '@/lib/match';
import { Avatar, Btn, Sheet, T } from './ui';
import { Icon, type IconName } from './Icon';
import { ProfileFx } from './ProfileFx';
import { C, GRAD, GRAD_POS, HOME } from '@/lib/theme';

const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

/** Spiel als Chip mit eigener Farb-Kachel (keine fremden Logos). common = spielt ihr beide, on = gewählt. */
export function GameChip({ name, common, on, onPress, x, small }: { name: string; common?: boolean; on?: boolean; onPress?: () => void; x?: boolean; small?: boolean }) {
  const g = gameTile(name);
  const sz = small ? 22 : 26;
  const body = (
    <View style={[s.game, small && s.gameSmall, common && s.gameCommon, on && s.gameOn]}>
      <LinearGradient colors={[g.a, g.b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: sz, height: sz, borderRadius: small ? 7 : 8, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ color: '#fff', fontSize: small ? 10 : 11, fontWeight: '800', lineHeight: small ? 13 : 15 }}>{g.t}</T>
      </LinearGradient>
      <T style={[s.gameText, small && { fontSize: 12.5 }]} numberOfLines={1}>{name}</T>
      {common ? <Icon name="check" size={14} color={C.ok} stroke={2.8} /> : null}
      {x ? <Icon name="x" size={14} color={C.muted} stroke={2.4} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ maxWidth: '100%' }, pressed && { opacity: 0.7 }]}>{body}</Pressable>;
}

/** Wochenraster: Zeilen = Tageszeiten, Spalten = Tage. overlap = Felder, in denen beide Zeit haben. onToggle = antippbar. */
export function TimeGrid({ mask, overlap = 0, onToggle, compact }: { mask: number; overlap?: number; onToggle?: (bit: number) => void; compact?: boolean }) {
  const h = onToggle ? 38 : compact ? 16 : 26;
  return (
    <View style={{ gap: compact ? 4 : 6 }}>
      <View style={s.gridRow}>
        <View style={{ width: compact ? 84 : 92 }} />
        {DAYS.map((d) => <T key={d} style={s.gridDay}>{d}</T>)}
      </View>
      {SLOTS.map((sl, si) => (
        <View key={sl} style={s.gridRow}>
          <T style={[s.gridSlot, { width: compact ? 84 : 92 }]} numberOfLines={1}>{sl}</T>
          {DAYS.map((d, di) => {
            const bit = 1 << (di * 4 + si), has = !!(mask & bit), both = !!(overlap & bit);
            const cell = [s.cell, { height: h, borderRadius: onToggle ? 10 : compact ? 5 : 8 }, has && s.cellOn, both && s.cellBoth];
            if (!onToggle) return <View key={d} style={cell} />;
            return (
              <Pressable key={d} accessibilityRole="checkbox" aria-checked={has} accessibilityLabel={`${d} ${sl}`} onPress={() => { tap(); onToggle(bit); }} style={[cell, { overflow: 'hidden' }]}>
                {has ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Gamepad auf Farbverlauf (Begrüßung, leere Seiten) */
export function Art({ size = 86 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
      <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View><Icon name="pad" size={size * 0.52} color="#fff" stroke={2} /></View>
    </View>
  );
}

const Pill = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.pill, style]}>{children}</View>;
const Tag = ({ icon, label, soft }: { icon?: IconName; label: string; soft?: boolean }) => (
  <View style={[s.tag, soft && s.tagSoft]}>{icon ? <Icon name={icon} size={13} color={soft ? C.accent : C.text2} /> : null}<T style={[s.tagText, soft && { color: '#c9bcff' }]}>{label}</T></View>
);
const Label = ({ children, right }: { children: string; right?: ReactNode }) => <View style={s.labelRow}><T style={s.label}>{children}</T>{right}</View>;

/** Profilbild der Karte (mit Rahmen aus dem Asoo-Profil); ohne Bild: Gamepad statt Buchstaben – es gibt ja noch keinen Namen. */
export function CardAvatar({ c, size }: { c: MatchCard; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Avatar user={{ id: c.pid || 'me', username: '', display: ' ', avatar: c.avatar, accent: c.accent, deco: c.deco } as any} size={size} live force={size >= 56} />
      {!c.avatar ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Icon name="pad" size={size * 0.46} color="#fff" stroke={2} /></View> : null}
    </View>
  );
}
function Banner({ c, height, children }: { c: MatchCard; height: number; children?: ReactNode }) {
  const src = mediaSource(c.banner);
  const second = c.banner_color && c.banner_color.toLowerCase() !== String(c.accent).toLowerCase() ? c.banner_color : '#ff5c8a';
  return (
    <View style={{ height, overflow: 'hidden' }}>
      {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        : <LinearGradient colors={[c.accent || '#8468ff', second]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent', 'rgba(20,21,31,0.96)']} locations={[0, 0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/** Große Karte einer Person – ohne Namen. preview = die eigene Karte („So sehen dich andere“). */
export function MatchCardView({ c, onMore, preview, style }: { c: MatchCard; onMore?: () => void; preview?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      <Banner c={c} height={148}>
        <View style={s.badges}>
          {c.boost ? <LinearGradient colors={['#ffb02e', '#ff7a3d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.pill, { borderWidth: 0 }]}><Icon name="bolt" size={12} color="#2a1500" stroke={2.6} /><T style={[s.pillText, { color: '#2a1500' }]}>Boost</T></LinearGradient> : null}
          {ACTIVE[c.active] ? <Pill>{c.active === 'now' ? <View style={s.liveDot} /> : null}<T style={s.pillText}>{ACTIVE[c.active]}</T></Pill> : null}
        </View>
        <View style={s.topRight}>
          {typeof c.score === 'number' && c.score >= 25 ? <Pill><T style={[s.pillText, { color: '#d9ceff', fontSize: 13.5 }]}>{c.score} %</T><T style={s.pillText}>passt</T></Pill> : null}
          {onMore ? <Pressable accessibilityRole="button" accessibilityLabel="Melden oder blockieren" hitSlop={8} onPress={() => { tap(); onMore(); }} style={s.more}><Icon name="more" size={18} color="#fff" /></Pressable> : null}
        </View>
      </Banner>
      <View style={s.body}>
        <View style={s.who}>
          <View style={s.avRing}><CardAvatar c={c} size={88} /></View>
          <View style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
            <T style={s.h} numberOfLines={1}>{preview ? 'So sehen dich andere' : 'Mitspieler'}</T>
            <View style={s.tags}>
              <Tag label={STYLE[c.style] || STYLE.both} />
              <Tag icon={c.mic ? 'mic' : 'micOff'} label={c.mic ? 'Mit Mikro' : 'Ohne Mikro'} />
            </View>
          </View>
        </View>
        {c.looking?.length ? <View style={[s.tags, { marginBottom: 10 }]}>{c.looking.map((l) => <Tag key={l} soft label={LOOKING[l] || l} />)}</View> : null}
        {c.about ? <T style={s.about}>{c.about}</T> : null}
        <Label>Spielt</Label>
        <View style={s.wrap}>{(c.games || []).map((g) => <GameChip key={g.n} name={g.n} common={g.c} />)}</View>
        {(c.platforms?.length || c.langs?.length) ? (
          <View style={[s.wrap, { marginTop: 12 }]}>
            {(c.platforms || []).map((p) => <View key={p} style={s.mini}><T style={s.miniText}>{PLATFORM[p] || p}</T></View>)}
            {(c.langs || []).map((l) => <View key={l} style={s.mini}><Icon name="globe" size={12} color={C.muted} /><T style={[s.miniText, { color: C.muted }]}>{LANG_NAME[l] || l}</T></View>)}
          </View>
        ) : null}
        {c.times ? <>
          <Label right={c.overlap ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.ok }} /><T style={{ color: C.ok, fontSize: 12, fontWeight: '700' }}>ihr beide</T></View> : undefined}>Spielzeiten</Label>
          <TimeGrid mask={c.times} overlap={c.overlap} compact />
        </> : null}
      </View>
      <ProfileFx id={c.effect} dense={0.6} />
    </View>
  );
}

/** Kleine Karte für „Mag dich“ und „Besucher“ (zwei nebeneinander). */
export function MiniCard({ c, kind, onOpen, onLike }: { c: MatchCard; kind: 'likes' | 'views'; onOpen: () => void; onLike: () => void }) {
  return (
    <View style={[s.miniCard, c.fresh && s.fresh]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Karte ansehen" onPress={() => { tap(); onOpen(); }}>
        <Banner c={c} height={70}>
          {typeof c.score === 'number' && c.score >= 25 ? <Pill style={{ position: 'absolute', right: 8, top: 8 }}><T style={[s.pillText, { color: '#d9ceff' }]}>{c.score} %</T></Pill> : null}
        </Banner>
        <View style={{ marginTop: -30, marginLeft: 12, alignItems: 'flex-start' }}><View style={[s.avRing, { padding: 4 }]}><CardAvatar c={c} size={56} /></View></View>
      </Pressable>
      <View style={{ padding: 12, paddingTop: 6, gap: 8, flex: 1 }}>
        <T style={{ color: C.muted, fontSize: 12.5 }} numberOfLines={1}>{kind === 'likes' ? 'Mag dich' : 'War da'} · {agoShort(c.at)}</T>
        <View style={{ gap: 5, flex: 1 }}>{(c.games || []).slice(0, 2).map((g) => <GameChip key={g.n} name={g.n} common={g.c} small />)}{(c.games || []).length > 2 ? <T style={{ color: C.muted, fontSize: 12 }}>+{c.games.length - 2} weitere</T> : null}</View>
        {c.liked ? <View style={s.likedRow}><Icon name="check" size={14} color={C.ok} stroke={2.8} /><T style={{ color: C.ok, fontWeight: '700', fontSize: 13 }}>Gelikt</T></View>
          : <Btn small title={kind === 'likes' ? 'Zurück-liken' : 'Liken'} icon="heart" onPress={onLike} />}
      </View>
    </View>
  );
}

/** Menü einer Karte: Melden (mit Grund) oder Blockieren. done() nach Erfolg (Karte aus dem Stapel nehmen). */
export function CardMenu({ pid, onClose, done, say }: { pid: string | null; onClose: () => void; done: () => void; say: (t: string) => void }) {
  const [step, setStep] = useState<'menu' | 'report' | 'block'>('menu');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const ins = useSafeAreaInsets();
  // Das Menü schließt sich beim Antippen selbst (dann ist pid schon wieder leer) – die Karte deshalb hier merken
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { if (pid) { setActive(pid); setStep('menu'); setReason(null); setDetails(''); } }, [pid]);
  const close = () => { setStep('menu'); setActive(null); };
  const send = async () => {
    const pid = active;
    if (!pid || !reason) return;
    setBusy(true);
    try { await reportCard(pid, reason, details); say('Danke! Wir schauen uns das an.'); close(); done(); } catch (e) { say(matchErr(e)); } finally { setBusy(false); }
  };
  const block = async () => {
    const pid = active;
    if (!pid) return;
    setBusy(true);
    try { await blockCard(pid); say('Blockiert.'); close(); done(); } catch (e) { say(matchErr(e)); } finally { setBusy(false); }
  };
  if (step === 'menu' || !active) {
    return <Sheet open={!!pid} onClose={onClose} title="Diese Karte" items={[
      { label: 'Melden', icon: 'flag', danger: true, onPress: () => setStep('report') },
      { label: 'Blockieren', icon: 'ban', danger: true, onPress: () => setStep('block') },
    ]} />;
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Schließen" />
      <View style={[s.sheet, { paddingBottom: ins.bottom + 14 }]}>
        <View style={s.grab} />
        {step === 'block' ? <>
          <T style={s.sheetTitle}>Diese Karte blockieren?</T>
          <T style={s.sheetText}>Ihr seht euch hier nie wieder und könnt euch auch sonst nicht schreiben. Die Person erfährt davon nichts.</T>
          <Btn title="Blockieren" kind="danger" icon="ban" busy={busy} onPress={block} style={{ marginTop: 16 }} />
          <Btn title="Abbrechen" kind="ghost" onPress={close} style={{ marginTop: 6 }} />
        </> : <>
          <T style={s.sheetTitle}>Karte melden</T>
          <T style={s.sheetText}>Deine Meldung geht vertraulich an das Asoo-Team. Die gemeldete Person erfährt nicht, wer gemeldet hat.</T>
          <ScrollView style={{ maxHeight: 330, marginTop: 10 }}>
            {REASONS.map(([k, label]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: reason === k }} onPress={() => { tap(); setReason(k); }} style={s.reason}>
                <View style={[s.radio, reason === k && { borderColor: C.accent }]}>{reason === k ? <View style={s.radioDot} /> : null}</View>
                <T style={{ flex: 1, fontSize: 15.5 }}>{label}</T>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput value={details} onChangeText={setDetails} placeholder="Was ist passiert? (freiwillig)" placeholderTextColor={C.faint} maxLength={1000} multiline style={s.details} />
          <Btn title="Meldung senden" kind="danger" icon="flag" busy={busy} disabled={!reason} onPress={send} style={{ marginTop: 12 }} />
          <Btn title="Abbrechen" kind="ghost" onPress={close} style={{ marginTop: 6 }} />
        </>}
      </View>
    </Modal>
  );
}

/** Feier nach einem Match – liegt über der ganzen App (eigenes Like oder Live-Meldung). Ab hier mit Namen. */
export function MatchParty() {
  const m = useParty();
  const me = useStore((st) => st.me);
  const router = useRouter();
  const glow = useSharedValue(0.6);
  useEffect(() => {
    if (!m) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    glow.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
  }, [m?.dm?.id]);
  const g = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.9 + glow.value * 0.2 }] }));
  if (!m || !me) return null;
  const close = () => showParty(null);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.partyBack}>
        <Animated.View entering={FadeInDown.duration(260)} style={s.party}>
          <Animated.View pointerEvents="none" style={[s.partyGlow, g]}><LinearGradient colors={['rgba(132,104,255,0.55)', 'rgba(255,92,154,0.18)', 'transparent']} style={StyleSheet.absoluteFill} /></Animated.View>
          <View style={s.partyAvs}>
            <Animated.View entering={ZoomIn.duration(380)} style={[s.avRing, { marginRight: -14 }]}><Avatar user={me as any} size={92} live force /></Animated.View>
            <Animated.View entering={ZoomIn.delay(160).duration(380)} style={s.partyPad}><LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View><Icon name="pad" size={26} color="#fff" stroke={2.2} /></View></Animated.View>
            <Animated.View entering={ZoomIn.delay(80).duration(380)} style={[s.avRing, { marginLeft: -14 }]}><Avatar user={m.user as any} size={92} live force /></Animated.View>
          </View>
          <T style={s.partyTitle}>Match!</T>
          <T style={s.partyText}><T style={{ fontWeight: '800', color: C.text }}>{m.user.display}</T> und du wollt zusammen spielen. Ihr seid jetzt verbunden und könnt euch schreiben.</T>
          <Btn title="Nachricht schreiben" icon="comment" onPress={() => { close(); router.push({ pathname: '/chat/[id]', params: { id: m.dm.id } }); }} style={{ alignSelf: 'stretch', marginTop: 20 }} />
          <Btn title="Weiter suchen" kind="secondary" onPress={close} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Karte groß ansehen (aus „Mag dich“/„Besucher“) mit Like-Knopf. */
export function CardPeek({ c, kind, onClose, onLike, onMore }: { c: MatchCard | null; kind: 'likes' | 'views'; onClose: () => void; onLike: () => void; onMore: () => void }) {
  const ins = useSafeAreaInsets();
  if (!c) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.partyBack, { padding: 14, paddingTop: ins.top + 14, paddingBottom: ins.bottom + 14 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <Animated.View entering={FadeIn.duration(180)} style={{ width: '100%', maxWidth: 440, flexShrink: 1 }}>
          <ScrollView style={{ borderRadius: 26 }} showsVerticalScrollIndicator={false}><MatchCardView c={c} onMore={onMore} /></ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Btn title="Schließen" kind="secondary" onPress={onClose} style={{ flex: 1 }} />
            {c.liked ? null : <Btn title={kind === 'likes' ? 'Zurück-liken' : 'Liken'} icon="heart" onPress={onLike} style={{ flex: 1.3 }} />}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  game: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 4, paddingRight: 11, height: 36, borderRadius: 12, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, maxWidth: '100%' },
  gameSmall: { height: 30, paddingLeft: 3, paddingRight: 9, borderRadius: 10, alignSelf: 'flex-start' },
  gameCommon: { borderColor: 'rgba(61,220,151,0.55)', backgroundColor: 'rgba(61,220,151,0.12)' },
  gameOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  gameText: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gridDay: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 11.5, fontWeight: '800' },
  gridSlot: { color: C.muted, fontSize: 12, fontWeight: '700' },
  cell: { flex: 1, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge },
  cellOn: { backgroundColor: '#5c4bc4', borderColor: 'transparent' },
  cellBoth: { backgroundColor: C.ok },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: HOME.panel, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  badges: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: '58%' },
  topRight: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(10,10,18,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok },
  more: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,10,18,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 18 },
  who: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: -42, marginBottom: 12 },
  avRing: { padding: 5, borderRadius: 100, backgroundColor: HOME.panel },
  h: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: HOME.bar },
  tagSoft: { backgroundColor: C.accentSoft },
  tagText: { fontSize: 12.5, fontWeight: '700', color: C.text2 },
  about: { color: C.text2, fontSize: 15, lineHeight: 21 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  label: { color: C.faint, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 9, borderRadius: 8, backgroundColor: HOME.raised },
  miniText: { fontSize: 12.5, fontWeight: '700', color: C.text2 },
  miniCard: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: HOME.panel, borderWidth: 1, borderColor: HOME.edge },
  fresh: { borderColor: C.accentLine, shadowColor: '#8468ff', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  likedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: '#161724', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: C.line },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.bg5, marginBottom: 10 },
  sheetTitle: { fontSize: 19, fontWeight: '800' },
  sheetText: { color: C.muted, marginTop: 4, lineHeight: 20 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.bg5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  details: { marginTop: 8, minHeight: 64, maxHeight: 110, borderRadius: 12, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, color: C.text, padding: 10, fontSize: 15, textAlignVertical: 'top' },
  partyBack: { flex: 1, backgroundColor: 'rgba(4,4,10,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  party: { width: '100%', maxWidth: 400, borderRadius: 28, paddingHorizontal: 22, paddingTop: 30, paddingBottom: 22, alignItems: 'center', backgroundColor: '#14151f', borderWidth: 1, borderColor: C.accentLine, overflow: 'hidden' },
  partyGlow: { position: 'absolute', left: -40, right: -40, top: -90, height: 300, borderRadius: 200, overflow: 'hidden' },
  partyAvs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  partyPad: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', zIndex: 3, borderWidth: 4, borderColor: '#14151f' },
  partyTitle: { fontSize: 34, fontWeight: '800', color: '#c9b8ff' },
  partyText: { color: C.text2, textAlign: 'center', marginTop: 6, lineHeight: 21 },
});
