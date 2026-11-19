// Ein Stück Web-App in der App: Sprach- und 3D-Räume (mit Avataren, Tanzen, Fernseher …), Anrufe und der Avatar-Editor.
// Aufruf: router.push({ pathname: '/room', params: { path: '/channels/<server>/<kanal>' } }). Zurück über den Knopf in der Seite.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmbedView } from '@/components/EmbedView';
import { signOut } from '@/lib/session';
import { C } from '@/lib/theme';

export default function Room() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  const safe = typeof path === 'string' && /^\/(channels|settings)\//.test(path) ? path : '/channels/@me';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <EmbedView path={safe} onClose={close} onAuthLost={() => { signOut(false); }} />
      </SafeAreaView>
    </View>
  );
}
