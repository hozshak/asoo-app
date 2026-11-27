// Sprach-Kern der App: Anrufe und Sprachräume direkt in der App (ohne Web-Ansicht).
// Spricht genau dieselbe Sprache wie die Web-App (zuno-app/public/js/voice.js): jeder mit jedem (WebRTC), Signale über
// die Live-Verbindung („vjoin“, „vstate“, „rtc“), „perfect negotiation“ (höflich ist, wessen Kennung kleiner ist),
// Datenkanal Nr. 7 („room“), Generationen-Nummer `g` je Verbindung, wer später kam, bietet an.
// Die Technik (WebRTC, Mikrofon, Lautsprecher) kommt von außen: am iPhone react-native-webrtc (voice.native.ts), in der
// Entwicklungs-Vorschau im Browser dessen eigenes WebRTC (voice.ts) – so lässt sich der Kern am PC gegen die Web-App testen.
import { AppState } from 'react-native';
import { api } from './api';
import * as live from './live';
import { getState } from './store';

export type Member = { cid: string; uid: string; muted?: boolean; deaf?: boolean; smute?: boolean; sdeaf?: boolean; video?: boolean; screen?: boolean; cam?: string | null; scr?: string | null; since: number; so?: boolean };
export type CallKind = 'call' | 'voice';
export type CallMeta = { kind: CallKind; title: string; path: string; sid?: string | null };
export type PeerView = { cid: string; uid: string; info?: Member; state: string; cam: any | null; scr: any | null };
export type VoiceState = {
  room: string | null; meta: CallMeta | null; joining: boolean; joined: boolean; since: number;
  muted: boolean; deaf: boolean; smute: boolean; sdeaf: boolean; video: boolean; front: boolean; speaker: boolean; sharing: boolean; noMic: boolean;
  /** war in diesem Anruf schon jemand anderes da? (dann klingelt es nicht mehr, wenn man wieder allein ist) */
  met: boolean;
  members: Member[]; peers: PeerView[]; speaking: Record<string, boolean>; localCam: any | null; quality: 'good' | 'bad'; error: string | null;
};
export type Deps = {
  RTCPeerConnection: any; RTCSessionDescription?: any; RTCIceCandidate?: any;
  getUserMedia: (c: any) => Promise<any>;
  /** Ton der Gegenseite abspielen (Browser: <audio>; iPhone: macht WebRTC selbst) */
  playAudio?: (cid: string, stream: any) => void;
  stopAudio?: (cid: string) => void;
  /** Gesprächs-Ton einschalten (iPhone: Audio-Sitzung, Lautsprecher) */
  startSession?: (speaker: boolean, video: boolean) => void;
  stopSession?: () => void;
  setSpeaker?: (on: boolean) => void;
  tone?: (kind: 'join' | 'leave' | 'mute' | 'unmute') => void;
  /** Bildschirm-Bild: Video-Format vorziehen (vor dem Angebot) und Datenrate einstellen (nach dem Aushandeln) */
  prepScreen?: (pc: any) => void;
  tuneScreen?: (pc: any) => void;
};
type Peer = { cid: string; uid: string; pc: any; gen: number; polite: boolean; makingOffer: boolean; ignoreOffer: boolean; streams: Map<string, any>;
  dc: any; info?: Member; badSince: number; tries: number; triedAt: number; askedAt: number; iceTried: boolean; heard: number; queue: Promise<void>; audioOn: boolean;
  /** Neu aushandeln steht noch aus (z. B. Kamera an, aber das Angebot konnte gerade nicht raus) */
  needNeg?: boolean };

const STEREO = ';stereo=1;sprop-stereo=1;maxaveragebitrate=192000;useinbandfec=1';
/** Stereo in hoher Qualität erlauben – wie tuneSdp in der Web-App (sonst macht die Gegenseite Mono daraus). */
function tuneSdp(sdp: string): string {
  const pts = new Set([...sdp.matchAll(/^a=rtpmap:(\d+) opus\/48000/gim)].map((m) => m[1]));
  let out = sdp;
  for (const pt of pts) out = out.replace(new RegExp('^(a=fmtp:' + pt + ' )(.*)$', 'gm'), (line, head, rest) => (/(^|;)\s*stereo=/.test(rest) ? line : head + String(rest).trimEnd() + STEREO));
  return out;
}
const plain = (d: any) => (d ? { type: d.type, sdp: d.sdp } : null);
const candJson = (c: any) => (c && typeof c.toJSON === 'function' ? c.toJSON() : { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex });

export function createVoice(deps: Deps) {
  let st: VoiceState = { room: null, meta: null, joining: false, joined: false, since: 0, muted: false, deaf: false, smute: false, sdeaf: false, video: false, front: true, speaker: true, sharing: false, noMic: false, met: false,
    members: [], peers: [], speaking: {}, localCam: null, quality: 'good', error: null };
  const subs = new Set<() => void>();
  const peers = new Map<string, Peer>();
  let mic: any = null, cam: any = null, scr: any = null, ice: any[] | null = null, iceAt = 0, joinAt = 0, joinedCid: string | null = null;
  let roster = new Map<string, Member>(), memberSet: Set<string> | null = null;
  let watch: any = null, meter: any = null, hbAt = 0, joinTimer: any = null;

  const me = () => getState().me?.id || null;
  const micLive = () => !st.muted && !st.deaf && !st.smute && !st.sdeaf;
  function emit(p: Partial<VoiceState> = {}) {
    st = { ...st, ...p, peers: [...peers.values()].map((x) => view(x)) };
    subs.forEach((f) => f());
  }
  function view(p: Peer): PeerView {
    const info = p.info || roster.get(p.cid);
    let c: any = null, s: any = null;
    for (const stream of p.streams.values()) {
      if (!stream.getVideoTracks || !stream.getVideoTracks().length) continue;
      if (info?.scr && stream.id === info.scr) s = stream;
      else if (info?.cam && stream.id === info.cam) c = stream;
      else if (!c && info?.video) c = stream;
      else if (!s && info?.screen) s = stream;
    }
    return { cid: p.cid, uid: p.uid, info, state: p.pc.connectionState || 'new', cam: info?.video ? c : null, scr: info?.screen ? s : null };
  }

  async function loadIce() {
    if (ice && Date.now() - iceAt < 6 * 3600e3) return;
    try { ice = (await api<{ iceServers: any[] }>('GET', '/api/rtc-config')).iceServers || []; }
    catch { if (!ice) ice = [{ urls: 'stun:stun.cloudflare.com:3478' }]; }
    iceAt = Date.now();
  }
  function sendJoin() {
    joinAt = Date.now(); joinedCid = live.myCid;
    live.send({ t: 'vjoin', room: st.room, muted: st.muted || !mic, deaf: st.deaf });
  }
  function pushState() {
    if (!st.room) return;
    live.send({ t: 'vstate', muted: st.muted || !mic, deaf: st.deaf, video: st.video, screen: !!scr, cam: cam ? cam.id : null, scr: scr ? scr.id : null });
  }
  let lastMutes = '';
  setInterval(() => { const k = (getState().userMutes || []).join(','); if (k !== lastMutes) { lastMutes = k; if (st.room) applyDeaf(); } }, 1000);
  function applyMic() { if (mic) for (const tr of mic.getAudioTracks()) tr.enabled = micLive(); }
  function applyDeaf() {
    for (const p of peers.values()) {
      const on = !st.deaf && !st.sdeaf && !(p.info?.smute || p.info?.sdeaf) && !(getState().userMutes || []).includes(p.uid);
      for (const s of p.streams.values()) for (const tr of s.getAudioTracks ? s.getAudioTracks() : []) tr.enabled = on;
    }
  }

  // ---------- Verbindungen ----------
  function makePeer(cid: string, uid: string, gen = 0): Peer {
    const pc = new deps.RTCPeerConnection({ iceServers: ice || [] });
    const p: Peer = { cid, uid, pc, gen, polite: (live.myCid || '') < cid, makingOffer: false, ignoreOffer: false, streams: new Map(), dc: null, badSince: 0, tries: 0, triedAt: 0, askedAt: 0, iceTried: false, heard: 0, queue: Promise.resolve(), audioOn: false };
    const alive = () => peers.get(cid) === p;
    p.dc = pc.createDataChannel('room', { negotiated: true, id: 7, ordered: false, maxRetransmits: 0 });
    p.dc.addEventListener?.('message', () => { p.heard = Date.now(); });
    if (mic) for (const tr of mic.getAudioTracks()) pc.addTrack(tr, mic);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (cam) for (const tr of cam.getVideoTracks()) pc.addTrack(tr, cam);
    if (scr) { for (const tr of scr.getVideoTracks()) pc.addTrack(tr, scr); deps.prepScreen?.(pc); }
    pc.addEventListener('signalingstatechange', () => { if (alive() && scr && pc.signalingState === 'stable') deps.tuneScreen?.(pc); });
    pc.addEventListener('negotiationneeded', () => negotiate(p));
    pc.addEventListener('icecandidate', (e: any) => { if (e.candidate && alive()) live.send({ t: 'rtc', to: cid, data: { cand: candJson(e.candidate), g: gen } }); });
    pc.addEventListener('track', (e: any) => {
      if (!alive()) return;
      const stream = e.streams?.[0];
      if (!stream) return;
      const fresh = !p.streams.has(stream.id);
      p.streams.set(stream.id, stream);
      if (fresh) {
        // kommt eine Spur später in denselben Stream oder endet eine, neu zeichnen
        const again = () => { if (alive()) emit(); };
        stream.addEventListener?.('addtrack', again); stream.addEventListener?.('removetrack', again);
      }
      e.track.addEventListener?.('unmute', () => { if (alive()) emit(); });
      e.track.addEventListener?.('ended', () => { if (alive()) emit(); });
      if (e.track.kind === 'audio' && !p.audioOn && !(stream.getVideoTracks && stream.getVideoTracks().length)) { p.audioOn = true; deps.playAudio?.(cid, stream); }
      applyDeaf();
      emit();
      // Sicherheitsnetz: manche Geräte hängen die Spur erst kurz nach dem Ereignis an
      setTimeout(() => { if (alive()) emit(); }, 400);
    });
    pc.addEventListener('connectionstatechange', () => {
      if (!alive()) return;
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch {} }
      updateQuality(); emit();
    });
    peers.set(cid, p);
    return p;
  }
  /**
   * Neu aushandeln (Angebot an die Gegenseite) – nach Kamera/Bildschirm an oder aus und bei „negotiationneeded“.
   * Läuft in der Warteschlange der Verbindung. Ist gerade ein Austausch im Gang, bleibt needNeg stehen und wird nach der
   * Antwort nachgeholt (handleSignal) – vorher ging das Angebot in diesem Fall verloren.
   */
  function negotiate(p: Peer) {
    const pc = p.pc, alive = () => peers.get(p.cid) === p;
    p.needNeg = true;
    p.queue = p.queue.then(async () => {
      if (!alive() || !p.needNeg || pc.signalingState !== 'stable') return;
      p.needNeg = false;
      p.makingOffer = true;
      try {
        const d = await pc.createOffer();
        if (pc.signalingState !== 'stable') { p.needNeg = true; return; } // inzwischen kam ein Angebot der Gegenseite
        await pc.setLocalDescription({ type: d.type, sdp: tuneSdp(d.sdp) });
        if (alive()) live.send({ t: 'rtc', to: p.cid, data: { desc: plain(pc.localDescription), g: p.gen } });
      } catch { p.needNeg = true; } finally { p.makingOffer = false; }
    }).catch(() => {});
  }
  /** Fingerabdruck der empfangenen Videospuren – ändert er sich, neu zeichnen (falls kein Ereignis kam). */
  let vidSig = '';
  function videoSig() {
    let k = '';
    for (const p of peers.values()) for (const s of p.streams.values()) for (const tr of (s.getVideoTracks ? s.getVideoTracks() : [])) k += p.cid + s.id + tr.id + (tr.readyState || '') + ';';
    return k;
  }
  function closePeer(p: Peer) { try { p.pc.close(); } catch {} deps.stopAudio?.(p.cid); }
  function rebuild(p: Peer) {
    if (peers.get(p.cid) !== p) return;
    closePeer(p); peers.delete(p.cid);
    const np = makePeer(p.cid, p.uid, p.gen + 1);
    Object.assign(np, { info: p.info, tries: p.tries + 1, badSince: p.badSince, askedAt: p.askedAt, triedAt: Date.now() });
    emit();
  }
  function updateQuality() {
    const bad = [...peers.values()].some((p) => ['failed', 'disconnected'].includes(p.pc.connectionState));
    if ((bad ? 'bad' : 'good') !== st.quality) st = { ...st, quality: bad ? 'bad' : 'good' };
  }
  function checkPeers() {
    if (!st.room) return;
    const now = Date.now();
    // Live-Verbindung war weg und ist mit neuer Kennung zurück: neu beitreten (die anderen kennen nur die alte Kennung)
    if (live.myCid && live.myCid !== joinedCid) {
      for (const p of peers.values()) closePeer(p);
      peers.clear(); roster = new Map(); memberSet = null;
      sendJoin(); emit({ joined: false });
      return;
    }
    if (!live.myCid) return;
    if (now - hbAt > 5000) { hbAt = now; const msg = JSON.stringify({ t: 'hb' }); for (const p of peers.values()) if (p.dc?.readyState === 'open') { try { p.dc.send(msg); } catch {} } }
    for (const p of [...peers.values()]) {
      const cs = p.pc.connectionState, dc = p.dc ? p.dc.readyState : 'closed';
      if (cs === 'connected' && dc === 'open') {
        p.badSince = 0; p.tries = 0; p.triedAt = 0; p.iceTried = false;
        if (p.heard && now - p.heard > 30000 && now - p.askedAt > 20000) { p.askedAt = now; live.send({ t: 'vcheck', cid: p.cid }); }
        continue;
      }
      if (!p.badSince) p.badSince = now;
      const bad = now - p.badSince, sinceTry = now - (p.triedAt || p.badSince);
      const dead = cs === 'closed' || dc === 'closed';
      const wait = dead ? 1500 : Math.min(30000, 15000 * 2 ** Math.min(p.tries, 1)) + (p.polite ? 2500 : 0);
      if (sinceTry > wait) { rebuild(p); continue; }
      if (cs === 'disconnected' && bad > 3000 && !p.iceTried) { p.iceTried = true; try { p.pc.restartIce(); } catch {} }
      if (bad > 25000 && now - p.askedAt > 20000) { p.askedAt = now; live.send({ t: 'vcheck', cid: p.cid }); }
    }
    updateQuality();
  }
  /** Wer spricht? Aus den Verbindungs-Werten (audioLevel) – geht am iPhone und im Browser gleich. */
  async function measure() {
    if (!st.room) return;
    const vs = videoSig();
    if (vs !== vidSig) { vidSig = vs; emit(); }
    const next: Record<string, boolean> = {};
    for (const p of peers.values()) {
      try {
        const stats = await p.pc.getStats();
        stats.forEach((r: any) => { if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio') && (r.audioLevel || 0) > 0.02) next[p.cid] = true; });
        if (!next.me && micLive()) stats.forEach((r: any) => { if (r.type === 'media-source' && r.kind === 'audio' && (r.audioLevel || 0) > 0.02) next.me = true; });
      } catch {}
    }
    const keys = (o: Record<string, boolean>) => Object.keys(o).sort().join();
    if (keys(next) !== keys(st.speaking)) emit({ speaking: next });
  }

  // ---------- Signale vom Server ----------
  function onRoomState(members: Member[]) {
    if (!live.myCid) return;
    const mine = members.find((m) => m.cid === live.myCid);
    if (!mine) { if (Date.now() - joinAt > 3000) sendJoin(); return; }
    clearTimeout(joinTimer);
    if (roster.size) {
      const before = new Set([...roster.values()].map((m) => m.uid)), after = new Set(members.map((m) => m.uid));
      if ([...after].some((u) => u !== me() && !before.has(u))) deps.tone?.('join');
      else if ([...before].some((u) => u !== me() && !after.has(u))) deps.tone?.('leave');
    }
    memberSet = new Set(members.map((m) => m.cid));
    roster = new Map(members.map((m) => [m.cid, m]));
    if (!!mine.smute !== st.smute || !!mine.sdeaf !== st.sdeaf) { st = { ...st, smute: !!mine.smute, sdeaf: !!mine.sdeaf }; applyMic(); }
    for (const [cid, p] of peers) if (!memberSet.has(cid)) { closePeer(p); peers.delete(cid); }
    for (const m of members) {
      // nicht mit sich selbst (eigene Bildschirm-Hilfsverbindung oder ein anderes eigenes Gerät)
      if (m.cid === live.myCid || m.uid === me()) continue;
      const p = peers.get(m.cid);
      if (p) { p.info = m; continue; }
      if (m.since < mine.since || (m.since === mine.since && m.cid < live.myCid)) { const np = makePeer(m.cid, m.uid); np.info = m; }
    }
    applyDeaf();
    const met = st.met || members.some((m) => m.uid !== me() && !m.so);
    emit({ members: members.filter((m) => !m.so), joined: true, joining: false, met });
  }
  function onSignal(m: any) {
    const { from, uid, data } = m;
    if (!st.room || !data || !live.myCid || uid === me()) return;
    const g = data.g | 0;
    let p = peers.get(from);
    if (p && g < p.gen) return;
    if (p && g > p.gen) {
      closePeer(p); peers.delete(from);
      const np = makePeer(from, uid, g);
      Object.assign(np, { info: p.info, tries: p.tries + 1, askedAt: p.askedAt, badSince: p.badSince, triedAt: Date.now() });
      p = np; emit();
    }
    if (!p) {
      if (memberSet && !memberSet.has(from)) return;
      p = makePeer(from, uid, g);
      p.info = roster.get(from);
    }
    const peer = p;
    peer.queue = peer.queue.then(() => handleSignal(peer, from, data)).catch(() => {});
  }
  async function handleSignal(p: Peer, from: string, data: any) {
    const pc = p.pc, alive = () => peers.get(from) === p;
    if (!alive()) return;
    if (data.desc) {
      const collision = data.desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
      p.ignoreOffer = !p.polite && collision;
      if (p.ignoreOffer) return;
      // höflich und eigenes Angebot unterwegs: es wird zurückgenommen – danach erneut anbieten (sonst fehlt z. B. die Kamera)
      if (collision) p.needNeg = true;
      const desc = { type: data.desc.type, sdp: tuneSdp(data.desc.sdp) };
      if (collision && pc.signalingState === 'have-local-offer') { try { await pc.setLocalDescription({ type: 'rollback' }); } catch {} }
      await pc.setRemoteDescription(deps.RTCSessionDescription ? new deps.RTCSessionDescription(desc) : desc);
      if (data.desc.type === 'offer' && alive()) {
        const a = await pc.createAnswer();
        await pc.setLocalDescription({ type: a.type, sdp: tuneSdp(a.sdp) });
        if (alive()) live.send({ t: 'rtc', to: from, data: { desc: plain(pc.localDescription), g: p.gen } });
      }
      // Austausch fertig: was in der Zwischenzeit liegen blieb (Kamera/Bildschirm an/aus), jetzt aushandeln
      if (alive() && p.needNeg && pc.signalingState === 'stable') setTimeout(() => { if (alive()) negotiate(p); }, 0);
    } else if (data.cand) {
      try { await pc.addIceCandidate(deps.RTCIceCandidate ? new deps.RTCIceCandidate(data.cand) : data.cand); } catch {}
    }
  }
  function drop(reason: string | null) {
    for (const p of peers.values()) closePeer(p);
    peers.clear();
    stopLocal();
    st = { ...st, room: null, meta: null, joined: false, joining: false, members: [], speaking: {}, video: false, sharing: false, localCam: null, smute: false, sdeaf: false, error: reason };
    emit();
  }
  live.onLive((m: any) => {
    if (m.t === 'rtc') onSignal(m);
    else if (m.t === 'voice' && m.room === st.room) onRoomState(m.members || []);
    else if (m.t === 'vkicked' && st.room) drop(m.reason === 'other_device' ? 'Du bist jetzt auf einem anderen Gerät im Gespräch.' : m.reason === 'mod' ? 'Ein Moderator hat dich getrennt.' : 'Du wurdest aus dem Gespräch entfernt.');
    else if (m.t === 'error' && m.ref === 'vjoin' && st.room) drop(m.code === 'room_full' ? 'Der Raum ist voll.' : m.code === 'not_friends' ? 'Ihr müsst befreundet sein, um zu telefonieren.' : m.code === 'blocked' ? 'Anruf nicht möglich.' : 'Beitreten nicht möglich.');
  });

  function stopLocal() {
    clearInterval(watch); clearInterval(meter); clearTimeout(joinTimer); watch = meter = null;
    for (const s of [mic, cam, scr]) if (s) for (const tr of s.getTracks()) { try { tr.stop(); } catch {} }
    try { scr?.release?.(); } catch {}
    mic = null; cam = null; scr = null;
    deps.stopSession?.();
  }

  // ---------- nach außen ----------
  AppState.addEventListener('change', async (state) => {
    if (state !== 'active' || !st.room) return;
    emit(); // Bilder neu zeichnen
    const old = cam?.getVideoTracks?.()[0];
    if (!cam || !old || old.readyState !== 'ended') return;
    try {
      const fresh = await deps.getUserMedia({ audio: false, video: { facingMode: st.front ? 'user' : 'environment', width: 640, height: 480, frameRate: 24 } });
      const tr = fresh.getVideoTracks()[0];
      if (!tr || !st.room) { for (const x of fresh.getTracks()) { try { x.stop(); } catch {} } return; }
      for (const p of peers.values()) for (const s of p.pc.getSenders()) if (s.track === old || (s.track && s.track.id === old.id)) { try { await s.replaceTrack(tr); } catch {} }
      cam = fresh; st = { ...st, localCam: fresh };
      pushState(); emit();
    } catch {}
  });
  const api_ = {
    get: () => st,
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    /** Beitreten. video: gleich mit Kamera (Videoanruf). */
    async join(room: string, meta: CallMeta, opts: { video?: boolean } = {}) {
      if (st.room === room) return;
      if (st.joining) return;
      if (st.room) api_.leave(true);
      emit({ joining: true, error: null, meta, room, since: Date.now(), joined: false, members: [], speaking: {}, met: false });
      live.ensureFresh();
      await loadIce();
      try { mic = await deps.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); st = { ...st, noMic: false }; }
      catch { mic = null; st = { ...st, noMic: true }; }
      if (st.room !== room) { stopLocal(); return; } // in der Zwischenzeit aufgelegt
      applyMic();
      if (opts.video) {
        try { cam = await deps.getUserMedia({ audio: false, video: { facingMode: 'user', width: 640, height: 480, frameRate: 24 } }); st = { ...st, video: true, front: true, localCam: cam }; } catch {}
      }
      deps.startSession?.(st.speaker, !!cam);
      sendJoin();
      if (cam) setTimeout(pushState, 600);
      watch = setInterval(checkPeers, 2500);
      meter = setInterval(measure, 500);
      joinTimer = setTimeout(() => { if (st.room === room && !st.joined) { live.send({ t: 'vsync' }); sendJoin(); } }, 6000);
      deps.tone?.('join');
      emit({ joining: false });
    },
    leave(silent = false) {
      if (!st.room) return;
      live.send({ t: 'vleave' });
      if (!silent) deps.tone?.('leave');
      drop(null);
    },
    toggleMute() {
      if (st.smute || st.sdeaf) { emit({ error: 'Ein Moderator hat dich stummgeschaltet.' }); return; }
      if (!mic && st.room) { emit({ error: 'ToLobby darf dein Mikrofon nicht benutzen. Erlaube es in den Einstellungen deines Handys bei ToLobby.' }); return; }
      // wie bei Discord: wer bei „Ton aus“ das Mikro anschaltet, hört auch wieder
      st = { ...st, deaf: st.muted ? false : st.deaf, muted: !st.muted };
      applyMic(); applyDeaf(); pushState(); deps.tone?.(st.muted ? 'mute' : 'unmute'); emit();
    },
    /** nach „Nutzer stummschalten“: Stimmen neu ein-/ausschalten */
    refreshAudio() { applyDeaf(); },
    toggleDeaf() {
      if (st.sdeaf) return;
      st = { ...st, deaf: !st.deaf };
      applyMic(); applyDeaf(); pushState(); deps.tone?.(st.deaf ? 'mute' : 'unmute'); emit();
    },
    async toggleCamera() {
      if (!st.room) return;
      if (cam) {
        const ids = new Set(cam.getTracks().map((t: any) => t.id));
        for (const p of peers.values()) for (const s of p.pc.getSenders()) if (s.track && ids.has(s.track.id)) { try { p.pc.removeTrack(s); } catch {} }
        for (const tr of cam.getTracks()) { try { tr.stop(); } catch {} }
        cam = null; st = { ...st, video: false, localCam: null };
      } else {
        try { cam = await deps.getUserMedia({ audio: false, video: { facingMode: st.front ? 'user' : 'environment', width: 640, height: 480, frameRate: 24 } }); }
        catch { emit({ error: 'Kein Kamera-Zugriff.' }); return; }
        if (!st.room) { for (const tr of cam.getTracks()) { try { tr.stop(); } catch {} } cam = null; return; } // inzwischen aufgelegt
        for (const p of peers.values()) for (const tr of cam.getVideoTracks()) { try { p.pc.addTrack(tr, cam); } catch {} }
        st = { ...st, video: true, localCam: cam };
      }
      // nicht nur auf „negotiationneeded“ warten – selbst neu aushandeln, damit die Gegenseite das Bild sofort bekommt
      for (const p of peers.values()) negotiate(p);
      pushState(); emit();
    },
    flipCamera() {
      const tr = cam?.getVideoTracks?.()[0];
      if (!tr) return;
      try { if (typeof tr._switchCamera === 'function') tr._switchCamera(); else tr.applyConstraints?.({ facingMode: st.front ? 'environment' : 'user' }); } catch {}
      emit({ front: !st.front });
    },
    toggleSpeaker() { const on = !st.speaker; deps.setSpeaker?.(on); emit({ speaker: on }); },
    /** Bildschirm teilen (Bild-Quelle kommt von außen) bzw. mit null beenden. */
    setScreen(stream: any | null) {
      if (!st.room && stream) { for (const tr of stream.getTracks()) { try { tr.stop(); } catch {} } return; }
      if (scr) {
        const ids = new Set(scr.getTracks().map((t: any) => t.id));
        for (const p of peers.values()) for (const s of p.pc.getSenders()) if (s.track && ids.has(s.track.id)) { try { p.pc.removeTrack(s); } catch {} }
        if (scr !== stream) { for (const tr of scr.getTracks()) { try { tr.stop(); } catch {} } try { scr.release?.(); } catch {} }
        scr = null;
      }
      if (stream) {
        scr = stream;
        for (const p of peers.values()) { for (const tr of scr.getVideoTracks()) { try { p.pc.addTrack(tr, scr); } catch {} } deps.prepScreen?.(p.pc); }
        scr.getVideoTracks()[0]?.addEventListener?.('ended', () => { if (scr === stream) api_.setScreen(null); });
      }
      for (const p of peers.values()) negotiate(p);
      pushState(); emit({ sharing: !!scr });
    },
    clearError() { if (st.error) emit({ error: null }); },
  };
  return api_;
}
export type Voice = ReturnType<typeof createVoice>;
