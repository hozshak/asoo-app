// Ein Stück Web-App in der App: Sprach- und 3D-Räume (mit Avataren, Tanzen, Fernseher …), Anrufe, Avatar-Editor,
// Feed, Entdecken, alle Einstellungen, Server-Verwaltung und Suche. Aufruf über lib/web.ts. Zurück über den Knopf in der Seite.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmbedView } from '@/components/EmbedView';
import { signOut } from '@/lib/session';
import { C } from '@/lib/theme';

const ALLOWED = /^\/(channels|settings|feed|discover|post|u|i|admin|notifications|start)(\/|\?|$)/;

export default function Room() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  const safe = typeof path === 'string' && ALLOWED.test(path) ? path : '/channels/@me';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <EmbedView path={safe} onClose={close} onAuthLost={() => { signOut(false); }}
          // Treffer aus Suche/Angehefteten: im nativen Chat öffnen
          onOpen={(ch) => router.replace({ pathname: '/chat/[id]', params: { id: ch } })} />
      </SafeAreaView>
    </View>
  );
}
