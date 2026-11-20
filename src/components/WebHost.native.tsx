// Das dauerhafte Web-Fenster (lib/webhost.ts). Liegt über der ganzen App; geschlossen wird es nur aus dem Bild
// geschoben, nicht beendet – so laufen Anrufe und Sprachräume weiter, und die nächste Seite ist sofort da.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { BASE, getToken } from '@/lib/api';
import { attachInject, getHost, onWebMessage, useHost } from '@/lib/webhost';
import { signOut } from '@/lib/session';
import { C } from '@/lib/theme';
import { T } from './ui';

// Typen von react-native-webview passen mit ref nicht zu React 19 – zur Laufzeit ein normales Bauteil
const WV = WebView as unknown as React.ComponentType<any>;

const ORIGIN = (BASE || 'https://zuno-app.altraex.workers.dev').replace(/\/+$/, '');

export function WebHost() {
  const started = useHost((s) => s.started);
  const visible = useHost((s) => s.visible);
  const busy = useHost((s) => s.busy);
  const { height } = useWindowDimensions();
  const router = useRouter();
  const ref = useRef<any>(null);
  // Startadresse nur einmal festlegen – eine neue Adresse würde die Seite neu laden (und einen Anruf beenden)
  const source = useRef<{ uri: string; headers: Record<string, string> } | null>(null);
  if (!started) source.current = null; // abgemeldet: beim nächsten Mal mit dem neuen Schlüssel starten
  if (started && !source.current) {
    const p = getHost().path;
    const to = p + (p.includes('?') ? '&' : '?') + 'app=1';
    source.current = { uri: `${ORIGIN}/api/auth/app-web?to=${encodeURIComponent(to)}`, headers: { authorization: `Bearer ${getToken() || ''}`, 'x-client': 'asoo-app' } };
  }
  useEffect(() => { attachInject((js) => ref.current?.injectJavaScript(js)); return () => attachInject(null); }, []);
  if (!started || !source.current) return null;
  const onMessage = (e: WebViewMessageEvent) => {
    let m: any = null;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    const r = onWebMessage(m);
    if (r.open) router.push({ pathname: '/chat/[id]', params: { id: r.open } });
    if (r.auth) signOut(false);
  };
  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, s.host, !visible && { transform: [{ translateY: height + 50 }] }]}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bg0 }}>
        <WV
          ref={ref}
          source={source.current}
          style={{ flex: 1, backgroundColor: C.bg0 }}
          onMessage={onMessage}
          mediaCapturePermissionGrantType="grant"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures={false}
          sharedCookiesEnabled
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(r: any) => {
            if (!r.isTopFrame || r.url.startsWith(ORIGIN) || r.url.startsWith('about:') || r.url.startsWith('blob:')) return true;
            if (/^https?:/.test(r.url)) WebBrowser.openBrowserAsync(r.url).catch(() => {});
            return false;
          }}
          // stürzt der Inhalt ab (z. B. wenig Speicher), neu laden statt eines weißen Fensters
          onContentProcessDidTerminate={() => ref.current?.reload()}
        />
        {busy ? <View style={[StyleSheet.absoluteFill, s.wait]} pointerEvents="none"><ActivityIndicator color={C.accent} size="large" /><T style={{ color: C.muted, marginTop: 10 }}>Wird geladen …</T></View> : null}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  host: { zIndex: 50, elevation: 50, backgroundColor: C.bg0 },
  wait: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg0 },
});
