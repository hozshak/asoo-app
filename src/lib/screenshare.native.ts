// Ganzen iPhone-Bildschirm teilen (wie Discord): iOS nimmt über die Erweiterung „AsooBroadcast“ (targets/broadcast) den
// Bildschirm auf – auch wenn man die App verlässt. Die App schickt das Bild per WebRTC an alle im Sprachraum.
//
// Ablauf: Die eigene Live-Verbindung der App (live.ts) tritt dem Sprachraum als „Bildschirm-Helfer“ bei (vjoin mit so:
// true – der Server lässt ihn neben dem eigentlichen Gerät zu, ohne Ton). Die Web-Apps der anderen ordnen den Helfer
// der Person zu (state.js foldScreenHelpers) und zeigen sein Bild als „Bildschirm“ dieser Person (voiceview.js).
// Verbindungsaufbau genau wie public/js/voice.js: jeder mit jedem, der Neuere bietet an, „perfect negotiation“
// (höflich ist, wessen Kennung kleiner ist), Datenkanal Nr. 7 („room“), Generationen-Nummer `g` je Verbindung.
import { NativeModules, findNodeHandle, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { mediaDevices, RTCPeerConnection, RTCRtpReceiver, type MediaStream } from 'react-native-webrtc';
import { api } from './api';
import { send, onLive, myCid } from './live';

export type ScreenQuality = '720' | '1080' | 'max';
type Peer = { cid: string; pc: RTCPeerConnection; gen: number; polite: boolean; makingOffer: boolean; ignoreOffer: boolean; queue: Promise<void>; dc: any };
type Listener = (on: boolean) => void;

const S: { room: string | null; stream: MediaStream | null; peers: Map<string, Peer>; ice: any[]; off: (() => void) | null; members: Set<string>; since: number; q: ScreenQuality } = {
  room: null, stream: null, peers: new Map(), ice: [], off: null, members: new Set(), since: 0, q: '1080',
};
// Obergrenze der Datenrate je Zuschauer (darunter regelt das Netz selbst nach)
const RATE: Record<ScreenQuality, number> = { '720': 2500000, '1080': 4500000, max: 6000000 };

/**
 * H.264 zuerst anbieten: Das iPhone rechnet es mit seinem Video-Chip. Ohne Vorgabe einigte man sich oft auf VP8, das das
 * iPhone in Software rechnen muss – das Bild ruckelte und das Handy wurde heiß.
 */
function preferH264(pc: RTCPeerConnection) {
  try {
    const codecs: any[] = (RTCRtpReceiver as any).getCapabilities?.('video')?.codecs || [];
    if (!codecs.length) return;
    const h264 = (c: any) => (/h264/i.test(c.mimeType) ? 1 : 0);
    const sorted = [...codecs].sort((a, b) => h264(b) - h264(a));
    for (const t of (pc as any).getTransceivers?.() || []) if (t.sender?.track?.kind === 'video') t.setCodecPreferences(sorted);
  } catch { /* ohne diese Funktion: wie bisher */ }
}
/** Bild flüssig halten: höchstens 30 Bilder pro Sekunde, Obergrenze nach Qualität; wird das Netz eng, lieber unschärfer als ruckelig. */
async function tuneSender(p: Peer) {
  for (const sd of (p.pc as any).getSenders?.() || []) {
    if (sd.track?.kind !== 'video') continue;
    try {
      const par = sd.getParameters();
      const e = par?.encodings?.[0];
      if (!e || (e.maxBitrate === RATE[S.q] && e.maxFramerate === 30)) continue;
      e.maxBitrate = RATE[S.q]; e.maxFramerate = 30;
      par.degradationPreference = 'maintain-framerate';
      await sd.setParameters(par);
    } catch {}
  }
}

const subs = new Set<Listener>();
export const onScreenShare = (fn: Listener) => { subs.add(fn); return () => { subs.delete(fn); }; };
export const isSharing = () => !!S.stream;
const changed = () => subs.forEach((f) => f(!!S.stream));

/** Gewählte Qualität für die Erweiterung hinterlegen (gemeinsamer App-Group-Ordner, liest SampleUploader.swift). */
function writeQuality(q: ScreenQuality) {
  try {
    const dir = Paths.appleSharedContainers['group.de.feierabendcode.asoo'];
    if (!dir) return;
    const f = new File(dir, 'screen-quality.txt');
    if (!f.exists) f.create();
    f.write(q);
  } catch { /* ohne Datei nimmt die Erweiterung 1080p */ }
}

/**
 * Teilen starten. pickerRef: die <ScreenCapturePickerView> (unsichtbar), über die iOS das Auswahlfenster
 * „Übertragung starten“ zeigt. room: der Sprachraum, in dem man gerade ist.
 */
export async function startScreenShare(room: string, pickerRef: any, quality: ScreenQuality = '1080') {
  if (Platform.OS !== 'ios') throw new Error('nur iPhone');
  if (S.stream) await stopScreenShare();
  writeQuality(quality);
  S.q = quality;
  try { S.ice = (await api<{ iceServers: any[] }>('GET', '/api/rtc-config')).iceServers || []; } catch { S.ice = [{ urls: 'stun:stun.cloudflare.com:3478' }]; }
  // Bild-Quelle anlegen (wartet auf die Erweiterung) und dann das iOS-Auswahlfenster zeigen
  const stream = await mediaDevices.getDisplayMedia({});
  const tag = findNodeHandle(pickerRef);
  if (tag != null) NativeModules.ScreenCapturePickerViewManager?.show(tag);
  S.stream = stream; S.room = room; S.since = Date.now();
  const track = stream.getVideoTracks()[0];
  (track as any)?.addEventListener?.('ended', () => { stopScreenShare(); });
  S.off = onLive(onMessage);
  send({ t: 'vjoin', room, muted: true, deaf: true, so: true });
  send({ t: 'vstate', muted: true, deaf: true, video: false, screen: true, cam: null, scr: stream.id });
  changed();
}

export async function stopScreenShare() {
  const st = S.stream;
  S.off?.(); S.off = null;
  for (const p of S.peers.values()) closePeer(p);
  S.peers.clear(); S.members.clear();
  if (S.room) send({ t: 'vleave' });
  S.room = null; S.stream = null;
  try { st?.getTracks().forEach((t) => t.stop()); } catch {}
  try { (st as any)?.release?.(); } catch {}
  changed();
}

function closePeer(p: Peer) { try { p.dc?.close(); } catch {} try { p.pc.close(); } catch {} }

function makePeer(cid: string, gen = 0): Peer {
  const pc = new RTCPeerConnection({ iceServers: S.ice });
  const p: Peer = { cid, pc, gen, polite: (myCid || '') < cid, makingOffer: false, ignoreOffer: false, queue: Promise.resolve(), dc: null };
  const live = () => S.peers.get(cid) === p;
  // derselbe ausgehandelte Datenkanal wie im Web (dort laufen 3D-Positionen; hier nur, damit die Gegenseite ihn offen sieht)
  try { p.dc = (pc as any).createDataChannel('room', { negotiated: true, id: 7, ordered: false, maxRetransmits: 0 }); } catch {}
  for (const tr of S.stream?.getTracks() || []) pc.addTrack(tr, S.stream!);
  preferH264(pc);
  (pc as any).addEventListener('signalingstatechange', () => { if (live() && pc.signalingState === 'stable') tuneSender(p); });
  (pc as any).addEventListener('negotiationneeded', async () => {
    if (!live()) return;
    try {
      p.makingOffer = true;
      const offer = await pc.createOffer({});
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      if (live()) send({ t: 'rtc', to: cid, data: { desc: pc.localDescription, g: gen } });
    } catch {} finally { p.makingOffer = false; }
  });
  (pc as any).addEventListener('icecandidate', (e: any) => { if (e.candidate && live()) send({ t: 'rtc', to: cid, data: { cand: e.candidate, g: gen } }); });
  // Ton und Bild der anderen braucht der Helfer nicht (die App spielt den Ton schon über das Web-Fenster) – stumm schalten
  (pc as any).addEventListener('track', (e: any) => { try { e.track.enabled = false; e.track._setVolume?.(0); } catch {} });
  (pc as any).addEventListener('connectionstatechange', () => {
    if (!live()) return;
    if (pc.connectionState === 'connected') tuneSender(p);
    if (pc.connectionState === 'failed') { try { (pc as any).restartIce?.(); } catch {} }
  });
  S.peers.set(cid, p);
  return p;
}

function onMessage(m: any) {
  if (!S.room) return;
  if (m.t === 'voice' && m.room === S.room) return onRoom(m.members || []);
  if (m.t === 'rtc') return onSignal(m.from, m.data);
  if (m.t === 'vkicked') { stopScreenShare(); }
}

function onRoom(members: any[]) {
  const me = members.find((x) => x.cid === myCid);
  if (!me) {
    // noch nicht (wieder) drin, z. B. nach einer Neuverbindung: erneut beitreten
    if (Date.now() - S.since > 3000) { S.since = Date.now(); send({ t: 'vjoin', room: S.room, muted: true, deaf: true, so: true }); send({ t: 'vstate', muted: true, deaf: true, video: false, screen: true, cam: null, scr: S.stream?.id || null }); }
    return;
  }
  S.members = new Set(members.map((x) => x.cid));
  for (const [cid, p] of S.peers) if (!S.members.has(cid)) { closePeer(p); S.peers.delete(cid); }
  for (const x of members) {
    if (x.cid === myCid || x.so || S.peers.has(x.cid)) continue;
    // wie im Web: wer später kam, baut auf – der Helfer kommt meist zuletzt und bietet allen sein Bild an
    if (x.since < me.since || (x.since === me.since && x.cid < (myCid || ''))) makePeer(x.cid);
  }
}

function onSignal(from: string, data: any) {
  if (!data || !myCid) return;
  const g = data.g | 0;
  let p = S.peers.get(from);
  if (p && g < p.gen) return;
  if (p && g > p.gen) { closePeer(p); S.peers.delete(from); p = undefined; }
  if (!p) { if (S.members.size && !S.members.has(from)) return; p = makePeer(from, g); }
  const peer = p;
  peer.queue = peer.queue.then(() => handle(peer, data)).catch(() => {});
}

async function handle(p: Peer, data: any) {
  const pc = p.pc, live = () => S.peers.get(p.cid) === p;
  if (!live()) return;
  if (data.desc) {
    const collision = data.desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
    p.ignoreOffer = !p.polite && collision;
    if (p.ignoreOffer) return;
    await pc.setRemoteDescription({ type: data.desc.type, sdp: data.desc.sdp } as any);
    if (data.desc.type === 'offer' && live()) {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (live()) send({ t: 'rtc', to: p.cid, data: { desc: pc.localDescription, g: p.gen } });
    }
  } else if (data.cand) {
    try { await pc.addIceCandidate(data.cand); } catch {}
  }
}
