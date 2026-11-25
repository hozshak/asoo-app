// Chat eines Kanals oder einer Direktnachricht – im Stil der Web-App. Neueste unten, ältere beim Hochscrollen,
// lange drücken = Menü (Reaktion, Antworten, Kopieren, Bearbeiten, Melden, Löschen).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { pickImage as chooseImage } from '@/lib/pick';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { addPending, setState, can, channelInfo, dmTitle, getState, loadMessages, markFailed, markRead, mentionsMe, replaceMsg, roleColor, userOf, useStore, type Msg } from '@/lib/store';
import { send, setViewing } from '@/lib/live';
import { openWeb, webAction } from '@/lib/web';
import { inviteCodes, openLink } from '@/lib/links';
import { InviteCard } from '@/components/InviteCard';
import { NameText } from '@/components/NameText';
import { isVerified } from '@/components/Verified';
import { RichText, plainText, timeLabel, toRoleTags } from '@/lib/text';
import { useComposerPad, useHeaderOffset } from '@/lib/keyboard';
import { Avatar, Glass, Glow, Press, Sheet, T, TopBar, TopIcon, type SheetItem } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { CallConfirm, type CallKind } from '@/components/CallConfirm';
import { useHost } from '@/lib/webhost';
import { joinCall, leaveForWeb, nativeCalls, useVoice } from '@/lib/calls';
import { FileCard, GifPicker, PollCard, PollComposer, VoiceMsg, VoiceRecorder, attKind, gifSrc, gifUrl, type Poll } from '@/components/ChatExtras';
import * as DocumentPicker from 'expo-document-picker';
import { C, F, GRAD, GRAD_POS } from '@/lib/theme';

const NO_CALLERS: { uid: string }[] = []; // feste leere Liste (eine neue bei jedem Zeichnen ließe den Zustand endlos neu laden)
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const REASONS: [string, string][] = [['spam', 'Spam'], ['harassment', 'Belästigung oder Mobbing'], ['hate', 'Hass oder Hetze'], ['violence', 'Gewalt oder Drohung'], ['sexual', 'Sexuelle Inhalte'], ['minor_safety', 'Gefahr für Minderjährige'], ['self_harm', 'Selbstverletzung'], ['illegal', 'Illegale Inhalte'], ['impersonation', 'Gibt sich als jemand anderes aus'], ['other', 'Etwas anderes']];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const dm = useStore((s) => s.dms.find((d) => d.id === id) || null);
  useStore((s) => s.servers); // neu zeichnen, wenn sich Kanäle/Rollen ändern
  const info = channelInfo(id);
  const sid = info?.server.id || null;
  const box = useStore((s) => s.messages[id]);
  const typing = useStore((s) => s.typing[id]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [reportFor, setReportFor] = useState<Msg | null>(null);
  const [big, setBig] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState<CallKind | null>(null); // „Anruf starten?“
  // Läuft in diesem Gespräch ein Anruf, bei dem man selbst nicht dabei ist? Dann oben „Beitreten“ (wie bei Discord)
  const callers = useStore((st) => (dm ? st.voice[dm.id] : undefined)) || NO_CALLERS;
  const inWebCall = useHost((h) => h.voice?.room === dm?.id);
  const inAppCall = useVoice((v) => !!dm && v.room === dm.id);
  const inThisCall = inWebCall || inAppCall;
  /** Anruf starten bzw. beitreten – in der App selbst, sonst (Ersatzweg) über die Web-Ansicht */
  const startCall = (video: boolean) => {
    if (!dm) return;
    if (nativeCalls()) joinCall(dm.id, { video });
    else openWeb(router, `/channels/@me/${dm.id}?call=${video ? 'video' : '1'}`);
  };
  const callOn = !!dm && callers.length > 0 && !inThisCall;
  const [plus, setPlus] = useState(false); // Plus-Menü (Bild, Datei, Umfrage)
  const [pollOpen, setPollOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const lastTyping = useRef(0);
  const other = dm && dm.kind === 'dm' ? dm.members.find((u) => u.id !== me?.id) : null;

  const title = info ? info.channel.name : dm ? dmTitle(dm, me?.id) : '';
  useEffect(() => {
    setViewing(id);
    loadMessages(id).catch((e) => setErr(errText(e)));
    markRead(id);
    return () => setViewing(null);
  }, [id]);
  const count = box?.list.length || 0;
  useEffect(() => { if (count) markRead(id); }, [count]);

  const data = useMemo(() => [...(box?.list || [])].reverse(), [box]);
  const isMod = sid ? can(sid, 'mod') : false;
  // „Wer darf schreiben?“ (post_role) – wer darunter liegt, sieht statt des Eingabefelds einen Hinweis
  const need = info?.channel.post_role || 'member';
  const readOnly = !!sid && need !== 'member' && !can(sid, need);

  const sendMsg = async () => {
    const raw = text.trim();
    if (!raw) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const content = sid ? toRoleTags(raw, sid, isMod) : raw;
    if (editing) {
      const m = editing; setEditing(null); setText('');
      try { await api('PATCH', `/api/messages/${m.id}`, { content }); } catch (e) { setErr(errText(e)); }
      return;
    }
    const nonce = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const pending: Msg = { id: nonce, nonce, ch: id, author_id: me!.id, content, created: Date.now(), reply_to: reply?.id || null, reply: reply ? { id: reply.id, author_id: reply.author_id, content: reply.content.slice(0, 200) } : null, attachments: [], reactions: [], kind: 'default', pending: true };
    addPending(id, pending);
    setText(''); setReply(null);
    try {
      const d = await api<any>('POST', `/api/channels/${id}/messages`, { content, reply_to: pending.reply_to, nonce });
      replaceMsg(id, nonce, { ...d.message, nonce });
    } catch (e) { markFailed(id, nonce); setErr(errText(e)); }
  };
  const sendImage = async () => {
    const r = await chooseImage({ title: 'Bild senden', quality: 0.8, maxSide: 1600 });
    if (!r) return;
    const a = r;
    const nonce = 'n' + Date.now().toString(36);
    addPending(id, { id: nonce, nonce, ch: id, author_id: me!.id, content: '', created: Date.now(), attachments: [{ key: '', local: a.uri, w: a.width, h: a.height }], reactions: [], kind: 'default', pending: true });
    try {
      const up = await upload('attachment', a.uri, a.mime);
      const d = await api<any>('POST', `/api/channels/${id}/messages`, { content: '', nonce, attachments: [{ key: up.key, w: a.width, h: a.height, name: 'bild.' + (a.mime.split('/')[1] || 'jpg') }] });
      replaceMsg(id, nonce, { ...d.message, nonce });
    } catch (e) { markFailed(id, nonce); setErr(errText(e)); }
  };
  /** Anhang (Datei oder Sprachnachricht) hochladen und als Nachricht schicken */
  const sendAttachment = async (uri: string, mime: string, att: { name: string; size?: number; voice?: boolean; dur?: number }) => {
    const nonce = 'n' + Date.now().toString(36);
    addPending(id, { id: nonce, nonce, ch: id, author_id: me!.id, content: '', created: Date.now(), attachments: [{ key: '', local: uri, type: mime, ...att }], reactions: [], kind: 'default', pending: true });
    try {
      const up = await upload('attachment', uri, mime);
      const d = await api<any>('POST', `/api/channels/${id}/messages`, { content: '', nonce, attachments: [{ key: up.key, ...att }] });
      replaceMsg(id, nonce, { ...d.message, nonce });
    } catch (e) { markFailed(id, nonce); setErr(errText(e)); }
  };
  const sendFile = async () => {
    const d = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (d.canceled || !d.assets?.[0]) return;
    const a = d.assets[0];
    if (a.size && a.size > 10 * 1024 * 1024) { setErr(`„${a.name}“ ist zu groß (höchstens 10 MB).`); return; }
    sendAttachment(a.uri, a.mimeType || 'application/octet-stream', { name: a.name || 'datei', size: a.size });
  };
  const sendGif = async (url: string) => {
    const nonce = 'n' + Date.now().toString(36);
    addPending(id, { id: nonce, nonce, ch: id, author_id: me!.id, content: url, created: Date.now(), attachments: [], reactions: [], kind: 'default', pending: true });
    try { const d = await api<any>('POST', `/api/channels/${id}/messages`, { content: url, nonce }); replaceMsg(id, nonce, { ...d.message, nonce }); }
    catch (e) { markFailed(id, nonce); setErr(errText(e)); }
  };
  const sendPoll = async (poll: { q: string; options: string[]; multi: boolean }) => {
    const nonce = 'n' + Date.now().toString(36);
    addPending(id, { id: nonce, nonce, ch: id, author_id: me!.id, content: poll.q, created: Date.now(), attachments: [], reactions: [], kind: 'poll', pending: true, poll: { q: poll.q, multi: poll.multi, options: poll.options.map((t) => ({ t, n: 0 })), voters: 0, mine: [] } });
    try { const d = await api<any>('POST', `/api/channels/${id}/messages`, { nonce, poll }); replaceMsg(id, nonce, { ...d.message, nonce }); }
    catch (e) { markFailed(id, nonce); setErr(errText(e)); }
  };
  const setPoll = (mid: string, p: Poll) => setState((st) => { const b = st.messages[id]; return b ? { messages: { ...st.messages, [id]: { ...b, list: b.list.map((x) => (x.id === mid ? { ...x, poll: p } : x)) } } } : {}; });
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 3000 && v) { lastTyping.current = Date.now(); send({ t: 'typing', ch: id }); }
  };
  const react = async (m: Msg, emoji: string) => {
    Haptics.selectionAsync().catch(() => {});
    const mine = m.reactions?.find((r) => r.emoji === emoji)?.me;
    try { await api('POST', `/api/messages/${m.id}/reactions`, { emoji, on: !mine }); } catch (e) { setErr(errText(e)); }
  };
  const del = async (m: Msg) => { try { await api('DELETE', `/api/messages/${m.id}`); } catch (e) { setErr(errText(e)); } };
  const report = async (m: Msg, reason: string) => {
    try { await api('POST', '/api/reports', { type: 'message', id: m.id, reason }); setErr('Danke – wir sehen uns die Meldung an.'); } catch (e) { setErr(errText(e)); }
  };

  const typers = Object.entries(typing || {}).filter(([uid, until]) => until > Date.now() && uid !== me?.id).map(([uid]) => userOf(uid).display);
  const menuItems: SheetItem[] = menu ? [
    !readOnly ? { label: 'Antworten', icon: 'reply', onPress: () => { setReply(menu); setEditing(null); } } : null,
    menu.content ? { label: 'Text kopieren', icon: 'copy', onPress: () => Clipboard.setStringAsync(plainText(menu.content, sid)) } : null,
    menu.author_id === me?.id && menu.kind === 'default' && menu.content && !readOnly ? { label: 'Bearbeiten', icon: 'edit', onPress: () => { setEditing(menu); setReply(null); setText(plainText(menu.content, sid)); } } : null,
    { label: 'Profil ansehen', icon: 'user', onPress: () => router.push({ pathname: '/user/[id]', params: { id: menu.author_id } }) },
    menu.author_id !== me?.id ? { label: 'Melden', icon: 'flag', danger: true, onPress: () => setReportFor(menu) } : null,
    menu.author_id === me?.id || isMod ? { label: 'Löschen', icon: 'trash', danger: true, onPress: () => del(menu) } : null,
  ] : [];
  const canSend = !!text.trim();
  const headerOffset = useHeaderOffset();
  const composerPad = useComposerPad(10);

  return (
    <View style={{ flex: 1 }}>
      <Glow />
      {dm ? <CallConfirm kind={ask} who={other} name={dm ? dmTitle(dm, me?.id) : ''} onClose={() => setAsk(null)} onStart={(k) => startCall(k === 'video')} /> : null}
      {/* eigene Kopfleiste (die von iOS 26 zeigt helle Glas-Knöpfe) – Anrufe über die Web-Ansicht der Unterhaltung */}
      <TopBar
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        title={
          <Pressable accessibilityRole="button" disabled={!other} onPress={() => other && router.push({ pathname: '/user/[id]', params: { id: other.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {info ? <Icon name={info.channel.type === 'text' ? 'hash' : info.channel.type === 'voice3d' ? 'cube' : info.channel.type === 'game' ? 'target' : 'volume'} size={18} color={C.muted} /> : other ? <Avatar user={other} size={30} status frame={false} /> : null}
            <T style={{ fontSize: 17, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{title}</T>
          </Pressable>
        }
        right={<>
          <TopIcon icon="pin" label="Angeheftete Nachrichten" onPress={() => router.push({ pathname: '/search', params: { ch: id, mode: 'pins', ...(sid ? { sid } : {}) } })} />
          <TopIcon icon="search" label="Suchen" onPress={() => router.push({ pathname: '/search', params: { ch: id, ...(sid ? { sid } : {}) } })} />
          {sid ? <TopIcon icon="users" label="Mitglieder" onPress={() => router.push({ pathname: '/members', params: { sid } })} /> : null}
          {dm ? <TopIcon icon="phone" label="Anrufen" color={C.accent} onPress={() => setAsk('voice')} /> : null}
          {dm ? <TopIcon icon="video" label="Videoanruf" color={C.accent} onPress={() => setAsk('video')} /> : null}
        </>}
      />
      {callOn ? (
        <Pressable accessibilityRole="button" onPress={() => startCall(false)} style={s.callOn}>
          <View style={s.callDot} />
          <Icon name="phone" size={17} color="#062b1b" stroke={2.4} />
          <T style={{ flex: 1, color: '#062b1b', fontWeight: '800' }} numberOfLines={1}>{callers.length === 1 ? `${userOf(callers[0].uid).display} ruft an` : 'Anruf läuft'}</T>
          <T style={{ color: '#062b1b', fontWeight: '900' }}>Beitreten</T>
        </Pressable>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerOffset}>
        {info && info.channel.type !== 'text' ? (
          <Pressable accessibilityRole="button" onPress={() => { if (info.channel.type === 'voice' && nativeCalls()) joinCall(info.channel.id); else { leaveForWeb(); openWeb(router, `/channels/${info.server.id}/${info.channel.id}`); } }} style={s.voiceNote}>
            <Icon name={info.channel.type === 'voice3d' ? 'cube' : info.channel.type === 'game' ? 'target' : 'volume'} size={16} color={C.accent} />
            <T style={s.voiceText}>{info.channel.type === 'voice' ? 'Das ist der Chat dieses Sprachraums. Tippe hier, um dem Raum beizutreten.' : info.channel.type === 'game' ? 'Das ist der Chat dieses Spiels. Tippe hier, um mitzuspielen.' : 'Das ist der Chat dieses 3D-Raums. Tippe hier, um den Raum zu betreten.'}</T>
          </Pressable>
        ) : null}
        {!box?.loaded ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> :
          <FlatList
            inverted
            data={data}
            keyExtractor={(m) => m.id}
            onEndReached={() => loadMessages(id, true).catch(() => {})}
            onEndReachedThreshold={0.4}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item, index }) => {
              const prev = data[index + 1];
              const head = !prev || prev.author_id !== item.author_id || item.created - prev.created > 7 * 60000 || !!item.reply || (item.kind !== 'default' && item.kind !== 'poll') || (prev.kind !== 'default' && prev.kind !== 'poll');
              const day = !prev || new Date(prev.created).toDateString() !== new Date(item.created).toDateString();
              return <>
                {day ? <View style={s.day}><View style={s.dayLine} /><T style={s.dayText}>{new Date(item.created).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</T><View style={s.dayLine} /></View> : null}
                <MessageRow onPoll={setPoll} m={item} head={head || day} sid={sid} meName={me?.username} onLong={() => { Haptics.selectionAsync().catch(() => {}); setMenu(item); }} onReact={(e) => react(item, e)} onImage={setBig} onUser={(uid) => router.push({ pathname: '/user/[id]', params: { id: uid } })} onLink={(url) => openLink(router, url)} />
              </>;
            }}
            ListFooterComponent={box.hasMore ? <ActivityIndicator color={C.faint} style={{ margin: 12 }} /> : (
              <View style={s.start}>
                <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} style={s.startIcon}><Icon name={info ? 'hash' : 'comment'} size={30} color="#fff" /></LinearGradient>
                <T style={s.startTitle}>{info ? `Willkommen in #${title}!` : title}</T>
                <T style={s.startText}>{info ? 'Das ist der Anfang dieses Kanals.' : 'Das ist der Anfang eures Gesprächs.'}</T>
              </View>
            )}
          />}
        {typers.length ? <Animated.View entering={FadeIn} style={s.typingRow}><View style={s.typingDots}><View style={s.td} /><View style={[s.td, { opacity: 0.7 }]} /><View style={[s.td, { opacity: 0.4 }]} /></View><T style={s.typing}>{typers.slice(0, 3).join(', ')} {typers.length === 1 ? 'tippt …' : 'tippen …'}</T></Animated.View> : null}
        {err ? <Pressable onPress={() => setErr('')}><T style={s.err}>{err}</T></Pressable> : null}
        {readOnly ? <Glass style={[s.composerWrap, { paddingBottom: composerPad }]} intensity={40} tint="rgba(14,15,24,0.86)">
          <View style={s.locked}><Icon name="lock" size={15} color={C.muted} /><T style={s.lockedText}>{need === 'admin' ? 'Nur Admins können hier schreiben.' : 'Nur Moderatoren können hier schreiben.'}</T></View>
        </Glass> : <Glass style={[s.composerWrap, { paddingBottom: composerPad }]} intensity={40} tint="rgba(14,15,24,0.86)">
          {reply || editing ? <Animated.View entering={FadeInDown.duration(180)} style={s.bar}>
            <Icon name={editing ? 'edit' : 'reply'} size={14} color={C.accent} />
            <T style={s.barText} numberOfLines={1}>{editing ? 'Nachricht bearbeiten' : `Antwort an ${userOf(reply!.author_id).display}`}</T>
            <Pressable accessibilityLabel="Abbrechen" onPress={() => { setReply(null); if (editing) { setEditing(null); setText(''); } }}><Icon name="x" size={18} color={C.muted} /></Pressable>
          </Animated.View> : null}
          <View style={s.composer}>
            {recording ? <View style={{ flex: 1 }}><VoiceRecorder onCancel={() => setRecording(false)} onDone={(uri, dur) => { setRecording(false); sendAttachment(uri, 'audio/mp4', { name: 'sprachnachricht.m4a', voice: true, dur }); }} /></View> : <>
            <Press label="Bild, Datei oder Umfrage" onPress={() => setPlus(true)} style={s.plus}><Icon name="plus" size={22} color={C.text2} /></Press>
            <TextInput {...(Platform.OS === 'web' ? ({ rows: 1 } as any) : {})} style={s.input} value={text} onChangeText={onType} placeholder={`Nachricht an ${info ? '#' : ''}${title}`} placeholderTextColor={C.faint} multiline maxLength={4000} />
            {/* wie bei Discord: ohne Text stehen GIF und Sprachnachricht direkt neben dem Feld, mit Text der Senden-Knopf */}
            {!text.trim() && !editing ? <>
              <Press label="GIF" onPress={() => setGifOpen(true)} style={s.side}><T style={s.gifTxt}>GIF</T></Press>
              <Press label="Sprachnachricht aufnehmen" onPress={() => setRecording(true)} style={s.side}><Icon name="mic" size={21} color={C.text2} /></Press>
            </> : <Press label="Senden" onPress={sendMsg} disabled={!canSend} style={[s.send, canSend && s.sendGlow]}>
              <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View><Icon name="send" size={19} color="#fff" /></View>
            </Press>}
            </>}
          </View>
        </Glass>}
      </KeyboardAvoidingView>
      <Sheet open={!!menu} onClose={() => setMenu(null)} items={menuItems} header={menu ? (
        <View style={s.quick}>{QUICK.map((e) => <Press key={e} label={`Reaktion ${e}`} onPress={() => { const m = menu; setMenu(null); react(m, e); }} style={s.quickBtn} scale={0.85}><T style={{ fontSize: 26, lineHeight: 34 }}>{e}</T></Press>)}</View>
      ) : null} />
      <Sheet open={plus} onClose={() => setPlus(false)} title="Senden" items={[
        { label: 'Foto oder Bild', icon: 'image', onPress: sendImage },
        { label: 'Datei', icon: 'folder', onPress: sendFile },
        { label: 'GIF', icon: 'smile', onPress: () => setGifOpen(true) },
        { label: 'Sprachnachricht', icon: 'mic', onPress: () => setRecording(true) },
        { label: 'Umfrage', icon: 'check', onPress: () => setPollOpen(true) },
      ]} />
      <PollComposer open={pollOpen} onClose={() => setPollOpen(false)} onSend={sendPoll} />
      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={sendGif} />
      <Sheet open={!!reportFor} onClose={() => setReportFor(null)} title="Warum meldest du das?" items={REASONS.map(([k, l]) => ({ label: l, onPress: () => report(reportFor!, k) }))} />
      <Modal visible={!!big} transparent animationType="fade" onRequestClose={() => setBig(null)}>
        <Pressable style={s.lightbox} onPress={() => setBig(null)}>{big ? <Image source={big.startsWith('http') ? { uri: big } : mediaSource(big)!} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}</Pressable>
      </Modal>
    </View>
  );
}


function MessageRow({ m, head, sid, meName, onLong, onReact, onImage, onUser, onLink, onPoll }: { onPoll: (id: string, p: Poll) => void; m: Msg; head: boolean; sid: string | null; meName?: string; onLong: () => void; onReact: (e: string) => void; onImage: (k: string) => void; onUser: (uid: string) => void; onLink: (url: string) => void }) {
  const u = userOf(m.author_id);
  if (m.kind === 'automod') {
    // Meldung des AutoMod im Team-Kanal: wer, warum, wo, und der blockierte Text
    let d: any = {};
    try { d = JSON.parse(m.content || '{}') || {}; } catch {}
    const why: Record<string, string> = { words: 'Verbotenes Wort', links: 'Link nicht erlaubt', invites: 'Fremde Einladung', mentions: 'Zu viele Erwähnungen', spam: 'Spam' };
    return (
      <View style={s.sys}>
        <View style={[s.sysIcon, { backgroundColor: 'rgba(255,92,138,0.14)' }]}><Icon name="shield" size={13} color={C.danger} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={s.sysText}>AutoMod hat eine Nachricht von <T style={{ color: C.text, fontWeight: '700' }} onPress={() => onUser(m.author_id)}>{u.display}</T> blockiert.</T>
          <T style={[s.sysText, { fontSize: 12.5 }]}>{[why[d.r] || '', d.w ? `„${d.w}“` : '', d.c ? `#${d.c}` : ''].filter(Boolean).join(' · ')}</T>
          {d.x ? <T style={s.amText}>{String(d.x)}</T> : null}
        </View>
      </View>
    );
  }
  if (m.kind !== 'default' && m.kind !== 'poll') {
    const txt = m.kind === 'group_create' ? ' hat die Gruppe erstellt.' : m.kind === 'group_join' ? ' wurde zur Gruppe hinzugefügt.' : m.kind === 'group_leave' ? ' hat die Gruppe verlassen.' : ' ist gerade gelandet. 👋';
    return (
      <View style={s.sys}><View style={s.sysIcon}><Icon name={m.kind === 'group_leave' ? 'logout' : 'userPlus'} size={13} color={C.ok} /></View><T style={s.sysText}><T style={{ color: C.text, fontWeight: '700' }}>{u.display}</T>{txt}</T></View>
    );
  }
  const me = getState().me;
  const mentioned = mentionsMe(m.content, sid) || (m.reply && m.reply.author_id === me?.id && m.author_id !== me?.id);
  const color = roleColor(sid, m.author_id);
  return (
    <Pressable onLongPress={onLong} delayLongPress={280} style={({ pressed }) => [s.msg, head && { marginTop: 12 }, mentioned && s.mentioned, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
      {m.reply ? <View style={s.replyRow}><View style={s.replyHook} /><Avatar user={userOf(m.reply.author_id)} size={16} frame={false} /><T style={s.replyLine} numberOfLines={1}><T style={{ color: C.text2, fontWeight: '700' }}>{userOf(m.reply.author_id).display}</T> {plainText(m.reply.content || '', sid) || 'Bild'}</T></View> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 42 }}>{head ? <Pressable onPress={() => onUser(m.author_id)}><Avatar user={u} size={42} /></Pressable> : null}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {head ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <NameText name={u.display} styleId={(u as any).name_style} color={color} style={s.name} onPress={() => onUser(m.author_id)} verified={isVerified(u)} />
            <T style={s.time}>{timeLabel(m.created)}</T>
          </View> : null}
          {m.kind === 'poll' && m.poll ? <PollCard id={m.id} poll={m.poll} pending={m.pending} onChange={(p) => onPoll(m.id, p)} />
            : gifUrl(m.content) ? <Pressable onPress={() => onImage(gifSrc(gifUrl(m.content)))}><Image source={{ uri: gifSrc(gifUrl(m.content)) }} style={{ width: 220, height: 180, borderRadius: 14, marginTop: 6 }} contentFit="cover" autoplay /></Pressable>
            : m.content ? <RichText text={m.content} sid={sid} meName={meName} onLink={onLink} style={[s.body, m.pending && { opacity: 0.55 }]} /> : null}
          {m.content && !m.pending ? inviteCodes(m.content).map((code) => <InviteCard key={code} code={code} />) : null}
          {m.edited ? <T style={s.edited}>(bearbeitet)</T> : null}
          {m.attachments?.map((a, i) => {
            const kind = attKind(a);
            if (kind === 'voice') return <VoiceMsg key={i} a={a} dim={m.pending} />;
            if (kind !== 'image') return <FileCard key={i} a={a} />;
            const src = a.local ? { uri: a.local } : mediaSource(a.key);
            const w = Math.min(260, a.w || 260), h = a.w && a.h ? Math.min(320, (w / a.w) * a.h) : 200;
            return src ? <Pressable key={i} onPress={() => a.key && onImage(a.key)}><Image source={src} style={{ width: w, height: h, borderRadius: 14, marginTop: 6, opacity: m.pending ? 0.6 : 1, borderWidth: 1, borderColor: C.line }} contentFit="cover" transition={200} /></Pressable> : null;
          })}
          {m.failed ? <T style={s.failed}>Nicht gesendet</T> : null}
          {m.reactions?.length ? <View style={s.reacts}>{m.reactions.map((r) => (
            <Press key={r.emoji} label={`${r.emoji} ${r.count}`} onPress={() => onReact(r.emoji)} style={[s.react, r.me && s.reactMe]} scale={0.9}><T style={{ fontSize: 15, lineHeight: 20 }}>{r.emoji}</T><T style={[s.reactN, r.me && { color: C.text }]}>{r.count}</T></Press>
          ))}</View> : null}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  callOn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginTop: 8, height: 46, paddingHorizontal: 14, borderRadius: 23, backgroundColor: C.ok },
  callDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#062b1b' },
  msg: { paddingHorizontal: 14, paddingVertical: 2 },
  mentioned: { backgroundColor: C.mention, borderLeftWidth: 3, borderLeftColor: C.mentionLine, paddingLeft: 11 },
  name: { fontWeight: '700', fontSize: 15.5, flexShrink: 1 },
  time: { color: C.faint, fontSize: 12 },
  body: { color: C.text2, fontSize: 16, lineHeight: 23, fontFamily: F.regular },
  edited: { color: C.faint, fontSize: 11 },
  failed: { color: C.danger, fontSize: 12 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 26, marginBottom: 3 },
  replyHook: { width: 26, height: 10, borderLeftWidth: 2, borderTopWidth: 2, borderColor: C.bg5, borderTopLeftRadius: 8, marginTop: 8 },
  replyLine: { color: C.muted, fontSize: 13, flex: 1 },
  reacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  react: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 30, borderRadius: 10, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line },
  reactMe: { borderColor: C.accentLine, backgroundColor: C.accentSoft },
  reactN: { color: C.muted, fontSize: 13, fontWeight: '700' },
  sys: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 7 },
  sysIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(61,220,151,0.12)', alignItems: 'center', justifyContent: 'center' },
  sysText: { color: C.muted, fontSize: 14 },
  amText: { color: C.text2, fontSize: 13, marginTop: 4, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: C.danger },
  locked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 22, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  lockedText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginVertical: 14 },
  dayLine: { flex: 1, height: 1, backgroundColor: C.line },
  dayText: { color: C.faint, fontSize: 12, fontWeight: '700' },
  start: { alignItems: 'flex-start', padding: 18, paddingTop: 30, gap: 6 },
  startIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  startTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  startText: { color: C.muted },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 4 },
  typingDots: { flexDirection: 'row', gap: 3 },
  td: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.text2 },
  typing: { color: C.muted, fontSize: 12.5 },
  err: { color: C.warn, paddingHorizontal: 16, paddingVertical: 6, fontSize: 13 },
  composerWrap: { borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, paddingTop: 8, paddingHorizontal: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  barText: { color: C.text2, flex: 1, fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, color: C.text, backgroundColor: C.bg3, borderRadius: 22, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, maxHeight: 140, minHeight: 44, fontFamily: F.medium },
  side: { width: 40, height: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  gifTxt: { color: C.text2, fontSize: 13, fontFamily: F.bold, borderWidth: 1.6, borderColor: C.text2, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  send: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sendGlow: { shadowColor: '#a060ff', shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  quick: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  quickBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  voiceNote: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, margin: 10, borderRadius: 14, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine },
  voiceText: { color: C.text2, flex: 1, fontSize: 13 },
});
