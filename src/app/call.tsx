// Anruf-Bildschirm (wie bei Discord): Kacheln aller Leute – grüner Ring, wer spricht; Kamera- und Bildschirm-Bild;
// unten Kamera, Mikro, Ton, Lautsprecher, Bildschirm teilen, Auflegen. Nach unten wischen/Pfeil = verkleinern
// (der Anruf läuft weiter, oben erscheint die Anruf-Leiste). Ruft man jemanden an, klingelt es bis zu einer Minute.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { setCallScreenOpen, useVoice, voice } from '@/lib/calls';
import { getState, userOf, useStore } from '@/lib/store';
import { captureScreen, type ScreenQuality } from '@/lib/screenshare';
import { ScreenPicker } from '@/components/ScreenPicker';
import { RTCVideo } from '@/components/RTCVideo';
import { Avatar, Glow, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { C } from '@/lib/theme';
import { t as tr } from '@/lib/i18n';

type Tile = { key: string; uid: string; me: boolean; video: any | null; screen: boolean; muted: boolean; deaf: boolean; speaking: boolean; connecting: boolean };
const RING_MS = 60000;
const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0'); };

export default function CallScreen() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const st = useVoice((s) => s);
  const meId = useStore((s) => s.me?.id) || '';
  useStore((s) => s.users); // Namen/Bilder nachzeichnen, sobald sie geladen sind
  const [now, setNow] = useState(Date.now());
  const [focus, setFocus] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const picker = useRef<any>(null);
  const wasIn = useRef(false);
  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);

  useFocusEffect(useCallback(() => { setCallScreenOpen(true); return () => setCallScreenOpen(false); }, []));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Aufgelegt (oder hinausgeworfen): ohne Fehlermeldung gleich zurück, sonst erst die Meldung zeigen
  useEffect(() => {
    if (st.room) { wasIn.current = true; return; }
    if (wasIn.current && !st.error && !st.joining) close();
  }, [st.room, st.error, st.joining]);
  // kurze Hinweise (z. B. „Kein Mikrofon-Zugriff“) während des Anrufs
  useEffect(() => {
    if (!st.room || !st.error) return;
    setNote(st.error); voice.clearError();
    const t = setTimeout(() => setNote(''), 4500);
    return () => clearTimeout(t);
  }, [st.error, st.room]);

  if (!st.room) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Glow />
        {st.error ? (
          <Animated.View entering={FadeInDown.duration(220)} style={s.errCard}>
            <View style={s.errIcon}><Icon name="hang" size={26} color="#fff" stroke={2.4} /></View>
            <T style={s.errTitle}>{tr("Gespräch beendet")}</T>
            <T style={s.errText}>{st.error}</T>
            <Pressable accessibilityRole="button" onPress={() => { voice.clearError(); close(); }} style={s.errBtn}><T style={{ fontWeight: '800' }}>{tr("Schließen")}</T></Pressable>
          </Animated.View>
        ) : <T style={{ color: C.muted }}>{tr("Kein Anruf")}</T>}
      </View>
    );
  }

  const meta = st.meta;
  const isCall = meta?.kind === 'call';
  const others = st.members.filter((m) => m.uid !== meId);
  const alone = others.length === 0;
  const dm = isCall ? getState().dms.find((d) => d.id === st.room) : null;
  const partner = dm ? dm.members.find((u) => u.id !== meId) || null : null;
  const ringing = isCall && alone && !st.met && now - st.since < RING_MS;

  // Kacheln: geteilte Bildschirme zuerst, dann man selbst, dann die anderen
  const tiles: Tile[] = [];
  for (const pv of st.peers) if (pv.scr) tiles.push({ key: pv.cid + ':scr', uid: pv.uid, me: false, video: pv.scr, screen: true, muted: false, deaf: false, speaking: false, connecting: false });
  tiles.push({ key: 'me', uid: meId, me: true, video: st.localCam, screen: false, muted: st.muted || st.smute || st.noMic, deaf: st.deaf || st.sdeaf, speaking: !!st.speaking.me, connecting: !st.joined });
  for (const m of others) {
    const pv = st.peers.find((p) => p.cid === m.cid);
    tiles.push({ key: m.cid, uid: m.uid, me: false, video: pv?.cam || null, screen: false, muted: !!(m.muted || m.smute), deaf: !!(m.deaf || m.sdeaf), speaking: !!st.speaking[m.cid], connecting: !pv || pv.state !== 'connected' });
  }
  const focused = focus ? tiles.find((t) => t.key === focus) || null : null;

  // Fläche für die Kacheln
  const top = ins.top + 58, bottom = ins.bottom + 104 + (st.sharing ? 58 : 0);
  const areaW = width - 20, areaH = height - top - bottom;
  const n = tiles.length;
  const layout = (i: number) => {
    if (n === 1) return { w: areaW, h: areaH };
    if (n === 2) return { w: areaW, h: (areaH - 10) / 2 };
    if (n <= 4) return { w: (areaW - 10) / 2, h: (areaH - 10) / 2, wide: n === 3 && i === 0 };
    const w = (areaW - 10) / 2; return { w, h: Math.min(w * 1.15, (areaH - 20) / 3) };
  };

  const subtitle = !st.joined ? 'Verbinde …'
    : ringing ? 'Klingelt …'
    : isCall && alone ? (st.met ? 'Du bist allein im Anruf' : 'Niemand hat abgenommen')
    : `${clock(now - st.since)} · ${st.members.length} ${st.members.length === 1 ? 'Person' : 'Personen'}`;

  const share = () => {
    haptic();
    if (st.sharing) { voice.setScreen(null); return; }
    const opts: [string, ScreenQuality | null][] = [['720p – spart Daten', '720'], ['1080p – Full HD', '1080'], ['Volle Auflösung', 'max'], ['Abbrechen', null]];
    ActionSheetIOS.showActionSheetWithOptions({ title: tr("Bildschirm teilen"), message: tr("Dein ganzer Bildschirm wird übertragen – auch wenn du die App verlässt. Beenden hier oder über den roten Balken oben."), options: opts.map((o) => o[0]), cancelButtonIndex: opts.length - 1 }, (i) => {
      const q = opts[i]?.[1];
      if (q) captureScreen(picker.current, q).then((stream) => voice.setScreen(stream)).catch(() => Alert.alert(tr("Bildschirm teilen"), tr("Das hat nicht geklappt. Bitte versuch es noch einmal.")));
    });
  };
  const hang = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); voice.leave(); };

  return (
    <View style={s.root}>
      <Glow />
      <ScreenPicker pickRef={picker} />
      {/* Kopf: verkleinern, Name, Dauer; bei Anrufen rechts zum Chat */}
      <View style={[s.head, { paddingTop: ins.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Verkleinern")} hitSlop={10} onPress={() => { haptic(); close(); }} style={s.headBtn}>
          <Icon name="chevron" size={18} color={C.text} stroke={2.6} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
            <Icon name={isCall ? (st.video ? 'video' : 'phone') : 'volume'} size={15} color={C.muted} />
            <T style={s.title} numberOfLines={1}>{meta?.title || tr("Anruf")}</T>
          </View>
          <T style={[s.sub, st.quality === 'bad' && { color: C.warn }]} numberOfLines={1}>{st.quality === 'bad' ? tr("Verbindung schwach …") : subtitle}</T>
        </View>
        {isCall ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Zum Chat")} hitSlop={10} onPress={() => { haptic(); router.replace({ pathname: '/chat/[id]', params: { id: st.room! } }); }} style={s.headBtn}>
            <Icon name="comment" size={18} color={C.text} />
          </Pressable>
        ) : <View style={s.headBtn}><Icon name="users" size={17} color={C.muted} /></View>}
      </View>

      {/* Mitte: beim Anrufen die angerufene Person, sonst die Kacheln */}
      {isCall && alone && st.joined ? (
        <View style={[s.ringWrap, { top, bottom }]}>
          {st.localCam ? <RTCVideo stream={st.localCam} mirror={st.front} style={StyleSheet.absoluteFill} /> : null}
          {st.localCam ? <LinearGradient colors={['rgba(7,7,13,0.55)', 'rgba(7,7,13,0.85)']} style={StyleSheet.absoluteFill} /> : null}
          <Pulse on={ringing}><Avatar user={partner || (dm ? { id: dm.id, username: '', display: meta?.title || '' } : null)} size={120} frame={false} /></Pulse>
          <T style={s.ringName} numberOfLines={1}>{meta?.title}</T>
          <T style={s.ringText}>{ringing ? tr("Klingelt …") : st.met ? tr("Du bist allein im Anruf.") : tr("Niemand hat abgenommen. Du bist allein im Anruf.")}</T>
        </View>
      ) : focused ? (
        <View style={{ position: 'absolute', left: 10, right: 10, top, bottom }}>
          <TileBox t={focused} w={areaW} h={areaH} front={st.front} video={st.video} onPress={() => setFocus(null)} />
        </View>
      ) : (
        <ScrollView style={{ position: 'absolute', left: 10, right: 10, top, bottom }} contentContainerStyle={s.grid} scrollEnabled={n > 4} showsVerticalScrollIndicator={false}>
          {tiles.map((t, i) => {
            const l = layout(i);
            return <TileBox key={t.key} t={t} w={l.wide ? areaW : l.w} h={l.h} front={st.front} video={st.video} onPress={() => { haptic(); setFocus(t.key); }} />;
          })}
        </ScrollView>
      )}

      {note ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(160)} style={[s.note, { top: top + 8 }]} pointerEvents="none">
          <T style={{ color: '#fff', textAlign: 'center' }}>{note}</T>
        </Animated.View>
      ) : null}

      {/* unten: eigener Bildschirm wird geteilt + Knopfleiste */}
      <View style={[s.dock, { paddingBottom: ins.bottom + 14 }]}>
        {st.sharing ? (
          <Animated.View entering={FadeIn.duration(180)} style={s.shareBar}>
            <Icon name="screen" size={17} color={C.ok} />
            <T style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{tr("Du teilst deinen Bildschirm")}</T>
            <Pressable accessibilityRole="button" onPress={share} style={s.shareStop}><T style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{tr("Beenden")}</T></Pressable>
          </Animated.View>
        ) : null}
        <View style={s.bar}>
          <Ctl icon={st.video ? 'video' : 'videoOff'} label={st.video ? tr("Kamera aus") : tr("Kamera an")} on={st.video} onPress={() => { haptic(); voice.toggleCamera(); }} />
          <Ctl icon={st.muted || st.noMic || st.smute ? 'micOff' : 'mic'} label={st.muted ? tr("Mikro an") : tr("Stumm")} off={st.muted || st.noMic || st.smute} onPress={() => { haptic(); voice.toggleMute(); }} />
          <Ctl icon={st.deaf || st.sdeaf ? 'headOff' : 'head'} label={st.deaf ? tr("Ton an") : tr("Ton aus")} off={st.deaf || st.sdeaf} onPress={() => { haptic(); voice.toggleDeaf(); }} />
          {Platform.OS !== 'web' ? <Ctl icon={st.speaker ? 'volume' : 'ear'} label={st.speaker ? tr("Hörmuschel") : tr("Lautsprecher")} on={st.speaker} onPress={() => { haptic(); voice.toggleSpeaker(); }} /> : null}
          {Platform.OS === 'ios' ? <Ctl icon="screen" label={st.sharing ? tr("Teilen beenden") : tr("Bildschirm teilen")} on={st.sharing} onPress={share} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Auflegen")} onPress={hang} style={({ pressed }) => [s.ctl, s.hang, pressed && { opacity: 0.8 }]}>
            <Icon name="hang" size={24} color="#fff" stroke={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Knopf der Leiste: „on“ = hell (an), „off“ = rot durchgestrichen (stumm). */
function Ctl({ icon, label, on, off, onPress }: { icon: IconName; label: string; on?: boolean; off?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.ctl, on && s.ctlOn, off && s.ctlOff, pressed && { opacity: 0.75 }]}>
      <Icon name={icon} size={22} color={on ? '#11121c' : off ? '#fff' : C.text} stroke={2.2} />
    </Pressable>
  );
}

/** Kachel zum Antippen (groß/klein) – „Kamera wechseln“ liegt daneben, nicht darin (Knopf in Knopf geht im Browser nicht). */
function TileBox({ t, w, h, front, video, onPress }: { t: Tile; w: number; h: number; front: boolean; video: boolean; onPress: () => void }) {
  return (
    <View style={{ width: w, height: h }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.me ? tr("Du") : userOf(t.uid).display} onPress={onPress} style={StyleSheet.absoluteFill}>
        <TileView t={t} w={w} h={h} front={front} />
      </Pressable>
      {t.me && video ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Kamera wechseln")} hitSlop={8} onPress={() => { haptic(); voice.flipCamera(); }} style={s.flip}><Icon name="flip" size={17} color="#fff" /></Pressable>
      ) : null}
    </View>
  );
}

function TileView({ t, w, h, front }: { t: Tile; w: number; h: number; front: boolean }) {
  const u = userOf(t.uid);
  const size = Math.max(44, Math.min(110, Math.min(w, h) * 0.36));
  const ring = useSharedValue(0);
  useEffect(() => { ring.value = withTiming(t.speaking ? 1 : 0, { duration: 140 }); }, [t.speaking]);
  const border = useAnimatedStyle(() => ({ borderColor: `rgba(61,220,151,${ring.value})` }));
  return (
    <Animated.View style={[s.tile, { width: w, height: h }, border]}>
      {t.video ? <RTCVideo stream={t.video} mirror={t.me && front && !t.screen} fit={t.screen ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} /> : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: u.accent ? u.accent + '33' : C.bg3 }]}>
          <Avatar user={u} size={size} frame={false} />
        </View>
      )}
      <View style={s.label}>
        {t.screen ? <Icon name="screen" size={13} color="#fff" /> : t.deaf ? <Icon name="headOff" size={13} color={C.danger} /> : t.muted ? <Icon name="micOff" size={13} color={C.danger} /> : null}
        <T style={s.labelText} numberOfLines={1}>{t.screen ? tr("Bildschirm von {0}", { 0: u.display }) : t.me ? tr("{0} (du)", { 0: u.display }) : u.display}</T>
      </View>
      {t.connecting && !t.me ? <View style={s.conn}><T style={s.connText}>{tr("Verbinde …")}</T></View> : null}
    </Animated.View>
  );
}

/** Pulsierende Ringe ums Bild, solange es klingelt. */
function Pulse({ on, children }: { on: boolean; children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = on ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false) : withTiming(0); }, [on]);
  const a = useAnimatedStyle(() => ({ opacity: on ? 0.5 * (1 - p.value) : 0, transform: [{ scale: 1 + p.value * 0.55 }] }));
  const b = useAnimatedStyle(() => ({ opacity: on ? 0.35 * (1 - p.value) : 0, transform: [{ scale: 1 + p.value * 0.95 }] }));
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 220, height: 220 }}>
      <Animated.View style={[s.pulse, b]} />
      <Animated.View style={[s.pulse, a]} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
  head: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, zIndex: 5 },
  headBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16.5, fontWeight: '800', flexShrink: 1 },
  sub: { color: C.muted, fontSize: 12, marginTop: -3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start' },
  tile: { borderRadius: 20, overflow: 'hidden', backgroundColor: C.bg2, borderWidth: 3 },
  label: { position: 'absolute', left: 8, bottom: 8, maxWidth: '85%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)' },
  labelText: { color: '#fff', fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  conn: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  connText: { color: C.text2, fontSize: 11 },
  flip: { position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  ringWrap: { position: 'absolute', left: 10, right: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden' },
  pulse: { position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: C.accent },
  ringName: { fontSize: 24, fontWeight: '800', marginTop: 4, maxWidth: '90%' },
  ringText: { color: C.muted, marginTop: 2, textAlign: 'center', paddingHorizontal: 24 },
  note: { position: 'absolute', left: 24, right: 24, padding: 12, borderRadius: 14, backgroundColor: 'rgba(30,31,46,0.95)', borderWidth: 1, borderColor: C.line, zIndex: 6 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, gap: 10 },
  shareBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 14, paddingRight: 6, borderRadius: 16, backgroundColor: C.bg3, borderWidth: 1, borderColor: 'rgba(61,220,151,0.35)' },
  shareStop: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', height: 76, borderRadius: 26, backgroundColor: '#161724', borderWidth: 1, borderColor: C.line, paddingHorizontal: 6 },
  ctl: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  ctlOn: { backgroundColor: '#f3f3f9' },
  ctlOff: { backgroundColor: 'rgba(255,77,94,0.9)' },
  hang: { width: 58, backgroundColor: C.danger },
  errCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, alignItems: 'center', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  errIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  errTitle: { fontSize: 20, fontWeight: '800', marginTop: 12 },
  errText: { color: C.muted, textAlign: 'center', marginTop: 4 },
  errBtn: { marginTop: 18, height: 46, paddingHorizontal: 26, borderRadius: 14, backgroundColor: C.bg4, alignItems: 'center', justifyContent: 'center' },
});
