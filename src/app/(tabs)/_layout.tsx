// Keine untere Knopfleiste mehr (wie bei Discord): Freunde, Mitteilungen und das eigene Profil
// erreicht man über die Profilleiste unten (MeBar) und den Knopf „Freunde hinzufügen“.
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
    </Tabs>
  );
}
