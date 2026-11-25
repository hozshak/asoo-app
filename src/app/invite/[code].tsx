// Einladung öffnen (Link aus einem Chat oder von außen): Vorschau des Servers und „Beitreten“ – direkt in der App.
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Glow, SheetHead } from '@/components/ui';
import { InviteCard, openServer } from '@/components/InviteCard';
import { t } from '@/lib/i18n';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title={t("Einladung")} onClose={() => router.back()} />
      <View style={{ padding: 16 }}>
        <InviteCard code={String(code)} big onOpen={(sid) => openServer(router, sid)} />
      </View>
    </View>
  );
}
