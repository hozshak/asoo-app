// Chat-Bausteine wie bei Discord: Sprachnachricht (abspielen + aufnehmen), Datei-Karte, Umfrage (anzeigen + erstellen).
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { api, errText, mediaSource, mediaUrl } from '@/lib/api';
import { Glass, T } from './ui';
import { Icon } from './Icon';
import { C, R } from '@/lib/theme';

export type Att = { key: string; type?: string; size?: number; name?: string; w?: number; h?: number; voice?: boolean; dur?: number; local?: string; spoiler?: boolean };
export type Poll = { q: string; multi: boolean; options: { t: string; n: number }[]; voters: number; mine: number[] };

/** Welche Art Anhang? Alte Nachrichten kennen nur Bilder (ohne Typ). */
export function attKind(a: Att): 'image' | 'voice' | 'audio' | 'video' | 'file' {
  const ty = a.type || '';
  if (!ty || /^image\//.test(ty)) return 'image';
  if (a.voice) return 'voice';
  if (/^audio\//.test(ty)) return 'audio';
  if (/^video\//.test(ty)) return 'video';
  return 'file';
}
export const sizeLabel = (n?: number) => (!n ? '' : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB');
const clock = (s: number) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/** Sprachnachricht abspielen: Knopf, Fortschritt (antippen = springen), Restzeit. */
export function VoiceMsg({ a, dim }: { a: Att; dim?: boolean }) {
  const src = a.local ? { uri: a.local } : (mediaSource(a.key) as any);
  const player = useAudioPlayer(src);
  const st = useAudioPlayerStatus(player);
  const [w, setW] = useState(1);
  const total = st.duration > 0 ? st.duration : a.dur || 0;
  const k = total ? Math.min(1, st.currentTime / total) : 0;
  useEffect(() => { if (st.didJustFinish) { player.seekTo(0).catch?.(() => {}); } }, [st.didJustFinish]);
  const toggle = async () => {
    Haptics.selectionAsync().catch(() => {});
    if (st.playing) { player.pause(); return; }
    try { await setAudioModeAsync({ playsInSilentMode: true }); } catch {}
    player.play();
  };
  return (
    <View style={[s.vm, dim && { opacity: 0.6 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={st.playing ? 'Pause' : 'Sprachnachricht abspielen'} onPress={toggle} style={s.vmPlay}>
        <Icon name={st.playing ? 'pause' : 'play'} size={16} color="#fff" stroke={2.4} />
      </Pressable>
      <Pressable onLayout={(e) => setW(e.nativeEvent.layout.width || 1)} onPress={(e) => total && player.seekTo((e.nativeEvent.locationX / w) * total)} style={s.vmTrack} accessibilityLabel="Stelle wählen">
        <View style={s.vmBase} />
        <View style={[s.vmFill, { width: `${k * 100}%` }]} />
      </Pressable>
      <T style={s.vmTime}>{clock(st.playing || st.currentTime > 0 ? total - st.currentTime : total)}</T>
    </View>
  );
}

/** Datei: Name und Größe; antippen = herunterladen und mit „Teilen“ öffnen/sichern. */
export function FileCard({ a }: { a: Att }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!a.key || busy) return;
    const src = mediaSource(a.key) as any;
    if (Platform.OS === 'web') { window.open(mediaUrl(a.key) + '?dl=1&name=' + encodeURIComponent(a.name || 'datei'), '_blank'); return; }
    setBusy(true);
    try {
      const FS = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');
      const safe = (a.name || 'datei').replace(/[^\w.\-äöüÄÖÜß ]/g, '_');
      const to = FS.cacheDirectory! + Date.now() + '-' + safe;
      const r = await FS.downloadAsync(src.uri, to, { headers: src.headers || {} });
      if (r.status !== 200) throw new Error('download');
      await Sharing.shareAsync(r.uri, { dialogTitle: a.name || 'Datei' });
    } catch (e) { Alert.alert('Datei', 'Die Datei konnte nicht geladen werden.'); }
    setBusy(false);
  };
  const video = attKind(a) === 'video', audio = attKind(a) === 'audio';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a.name || 'Datei'} öffnen`} onPress={open} style={({ pressed }) => [s.file, pressed && { borderColor: C.accentLine }]}>
      <View style={s.fileIc}><Icon name={video ? 'video' : audio ? 'volume' : 'folder'} size={22} color={C.accent} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={s.fileName} numberOfLines={1}>{a.name || 'Datei'}</T>
        <T style={s.fileSize}>{[video ? 'Video' : audio ? 'Audio' : '', sizeLabel(a.size)].filter(Boolean).join(' · ')}</T>
      </View>
      {busy ? <ActivityIndicator color={C.accent} /> : <Icon name="download" size={18} color={C.muted} />}
    </Pressable>
  );
}

/** Umfrage in einer Nachricht: Antworten als Balken, antippen = abstimmen (noch mal = Stimme zurück). */
export function PollCard({ id, poll, pending, onChange }: { id: string; poll: Poll; pending?: boolean; onChange: (p: Poll) => void }) {
  const total = poll.options.reduce((x, o) => x + o.n, 0);
  const voted = (poll.mine || []).length > 0;
  const vote = async (i: number) => {
    if (pending) return;
    Haptics.selectionAsync().catch(() => {});
    const mine = new Set(poll.mine || []);
    if (mine.has(i)) mine.delete(i); else { if (!poll.multi) mine.clear(); mine.add(i); }
    try { const d = await api<any>('POST', `/api/messages/${id}/vote`, { opts: [...mine] }); onChange(d.poll); } catch (e) { Alert.alert('Umfrage', errText(e)); }
  };
  return (
    <View style={s.poll}>
      <T style={s.pollQ}>{poll.q}</T>
      <T style={s.pollHint}>{poll.multi ? 'Mehrere Antworten möglich' : 'Eine Antwort wählen'}</T>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((o.n / total) * 100) : 0;
        const on = (poll.mine || []).includes(i);
        return (
          <Pressable key={i} accessibilityRole={poll.multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: on }} onPress={() => vote(i)} style={[s.opt, on && s.optOn]}>
            {voted ? <View style={[s.optBar, { width: `${pct}%` }]} /> : null}
            <View style={[s.mark, on && s.markOn]}>{on ? <Icon name="check" size={12} color="#fff" stroke={3} /> : null}</View>
            <T style={{ flex: 1, fontWeight: '600' }}>{o.t}</T>
            {voted ? <T style={s.pct}>{pct} %</T> : null}
          </Pressable>
        );
      })}
      <T style={s.pollHint}>{poll.voters === 1 ? '1 Stimme' : `${poll.voters || 0} Stimmen`}</T>
    </View>
  );
}

/** Umfrage erstellen (Fenster von unten). */
export function PollComposer({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (p: { q: string; options: string[]; multi: boolean }) => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  useEffect(() => { if (open) { setQ(''); setOpts(['', '']); setMulti(false); } }, [open]);
  const ok = q.trim() && opts.filter((o) => o.trim()).length >= 2;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose} />
      <Glass style={s.sheet} intensity={50} tint="rgba(19,20,32,0.97)">
        <View style={s.grab} />
        <T style={s.sheetTitle}>Umfrage erstellen</T>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
          <T style={s.label}>Frage</T>
          <TextInput value={q} onChangeText={setQ} placeholder="Was möchtest du fragen?" placeholderTextColor={C.faint} maxLength={300} style={s.input} />
          <T style={s.label}>Antworten</T>
          {opts.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TextInput value={o} onChangeText={(v) => setOpts((x) => x.map((y, j) => (j === i ? v : y)))} placeholder={`Antwort ${i + 1}`} placeholderTextColor={C.faint} maxLength={80} style={[s.input, { flex: 1, marginBottom: 0 }]} />
              {opts.length > 2 ? <Pressable accessibilityLabel="Antwort entfernen" onPress={() => setOpts((x) => x.filter((_, j) => j !== i))} style={s.rm}><Icon name="x" size={16} color={C.muted} /></Pressable> : null}
            </View>
          ))}
          {opts.length < 10 ? <Pressable onPress={() => setOpts((x) => [...x, ''])} style={s.add}><Icon name="plus" size={16} color={C.accent} /><T style={{ color: C.accent, fontWeight: '700' }}>Antwort hinzufügen</T></Pressable> : null}
          <View style={s.multi}><T style={{ flex: 1, fontWeight: '600' }}>Mehrere Antworten erlauben</T><Switch value={multi} onValueChange={setMulti} trackColor={{ true: C.accent }} /></View>
        </ScrollView>
        <Pressable accessibilityRole="button" disabled={!ok} onPress={() => { onSend({ q: q.trim(), options: opts.map((o) => o.trim()).filter(Boolean), multi }); onClose(); }} style={[s.send, !ok && { opacity: 0.45 }]}>
          <T style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Umfrage senden</T>
        </Pressable>
      </Glass>
    </Modal>
  );
}

/**
 * Sprachnachricht aufnehmen: Leiste statt Eingabefeld – Zeit läuft, links verwerfen, rechts senden. Höchstens 5 Minuten.
 * onDone bekommt die Datei (m4a) und die Länge in Sekunden.
 */
export function VoiceRecorder({ onCancel, onDone }: { onCancel: () => void; onDone: (uri: string, dur: number) => void }) {
  const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [secs, setSecs] = useState(0);
  const started = useRef(0);
  const done = useRef(false);
  useEffect(() => {
    let alive = true, timer: any;
    (async () => {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) { Alert.alert('Mikrofon', 'Erlaube ToLobby das Mikrofon in den iPhone-Einstellungen (Einstellungen → ToLobby → Mikrofon).'); onCancel(); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      if (!alive) return;
      rec.record();
      started.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      timer = setInterval(() => { const sNow = (Date.now() - started.current) / 1000; setSecs(sNow); if (sNow >= 300) finish(true); }, 250);
    })().catch(() => { Alert.alert('Mikrofon', 'Die Aufnahme konnte nicht starten.'); onCancel(); });
    return () => { alive = false; clearInterval(timer); if (!done.current) rec.stop().catch(() => {}); };
  }, []);
  const finish = async (send: boolean) => {
    if (done.current) return; done.current = true;
    const dur = (Date.now() - started.current) / 1000;
    try { await rec.stop(); } catch {}
    try { await setAudioModeAsync({ allowsRecording: false }); } catch {}
    if (send && rec.uri && dur >= 0.8) onDone(rec.uri, Math.round(dur)); else onCancel();
  };
  return (
    <View style={s.recRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Verwerfen" onPress={() => finish(false)} style={s.recBtn}><Icon name="trash" size={20} color={C.danger} /></Pressable>
      <View style={s.recDot} />
      <T style={{ flex: 1, fontWeight: '700' }}>Aufnahme läuft … {clock(secs)}</T>
      <Pressable accessibilityRole="button" accessibilityLabel="Senden" onPress={() => finish(true)} style={s.recSend}><Icon name="send" size={19} color="#fff" /></Pressable>
    </View>
  );
}

/** Nachricht ist nur ein GIF-Link (Tenor/GIPHY)? Dann als Bild zeigen. */
export function gifUrl(text?: string) {
  const s = String(text || '').trim();
  return /^https:\/\/(media\d*\.tenor\.com|media\d*\.giphy\.com|i\.giphy\.com|static\d*\.klipy\.com)\/[^\s<>"']+$/.test(s) ? s : null;
}

/** GIF-Auswahl: ohne Suchwort die beliebtesten, antippen = senden. */
export function GifPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<{ id: string; preview: string; url: string }[] | null>(null);
  const [msg, setMsg] = useState('');
  const seq = useRef(0);
  useEffect(() => { if (open) { setQ(''); load(''); } }, [open]);
  useEffect(() => { if (!open) return; const t = setTimeout(() => load(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const load = async (query: string) => {
    const my = ++seq.current;
    setList(null); setMsg('');
    try {
      const d = await api<any>('GET', '/api/gifs' + (query ? '?q=' + encodeURIComponent(query) : ''));
      if (my !== seq.current) return;
      setList(d.gifs || []); if (!d.gifs?.length) setMsg('Keine GIFs gefunden.');
    } catch (e: any) { if (my === seq.current) { setList([]); setMsg(e?.code === 'gif_off' ? 'Die GIF-Suche ist noch nicht eingerichtet.' : errText(e)); } }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose} />
      <Glass style={[s.sheet, { height: '72%' }]} intensity={50} tint="rgba(19,20,32,0.97)">
        <View style={s.grab} />
        <TextInput value={q} onChangeText={setQ} placeholder="GIFs suchen …" placeholderTextColor={C.faint} style={s.input} autoCorrect={false} />
        {!list ? <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} /> : msg ? <T style={{ color: C.muted, textAlign: 'center', marginTop: 30 }}>{msg}</T> : (
          <ScrollView contentContainerStyle={s.gifGrid} keyboardShouldPersistTaps="handled">
            {list.map((g) => (
              <Pressable key={g.id} accessibilityLabel="GIF senden" onPress={() => { Haptics.selectionAsync().catch(() => {}); onClose(); onPick(g.url); }} style={s.gifItem}>
                <Image source={{ uri: g.preview }} style={{ width: '100%', height: '100%' }} contentFit="cover" autoplay />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Glass>
    </Modal>
  );
}

const s = StyleSheet.create({
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 6, paddingBottom: 30 },
  gifItem: { width: '32%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: C.bg3 },
  vm: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 260, maxWidth: '100%', padding: 8, paddingRight: 12, borderRadius: 22, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, marginTop: 6 },
  vmPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  vmTrack: { flex: 1, height: 22, justifyContent: 'center' },
  vmBase: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  vmFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: C.accent },
  vmTime: { color: C.text2, fontSize: 12.5, minWidth: 34, textAlign: 'right' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 280, maxWidth: '100%', padding: 10, borderRadius: 14, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, marginTop: 6 },
  fileIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  fileName: { color: '#6cb6ff', fontWeight: '700' },
  fileSize: { color: C.muted, fontSize: 12.5 },
  poll: { marginTop: 6, padding: 12, borderRadius: 16, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, gap: 6, maxWidth: 420 },
  pollQ: { fontSize: 16, fontWeight: '800' },
  pollHint: { color: C.muted, fontSize: 12.5 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  optOn: { borderColor: C.accent },
  optBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.accentSoft },
  mark: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: C.accent, borderColor: C.accent },
  pct: { color: C.text2, fontWeight: '700', fontSize: 13 },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 34 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 10 },
  sheetTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  label: { color: C.muted, fontSize: 13, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 13, minHeight: 44, fontSize: 15.5, marginBottom: 4 },
  rm: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  multi: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 6 },
  send: { height: 50, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  recBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,77,94,0.12)' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  recSend: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
