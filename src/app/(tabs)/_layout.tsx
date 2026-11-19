// Untere Leiste als Glasfläche mit den Symbolen der Web-App: Chats, Freunde, Mitteilungen, Ich.
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '@/lib/store';
import { Icon, type IconName } from '@/components/Icon';
import { C, F, GRAD } from '@/lib/theme';

const TabIcon = ({ name, focused }: { name: IconName; focused: boolean }) => (
  <View style={{ alignItems: 'center', gap: 4 }}>
    <Icon name={name} size={24} color={focused ? C.text : C.faint} stroke={focused ? 2.2 : 2} />
    {focused ? <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 18, height: 3, borderRadius: 2 }} /> : <View style={{ height: 3 }} />}
  </View>
);

export default function TabsLayout() {
  const notif = useStore((s) => s.notifUnread);
  const requests = useStore((s) => s.friends.incoming.length);
  const dmUnread = useStore((s) => s.dms.reduce((n, d) => n + (s.unread[d.id] ? 1 : 0), 0));
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { position: 'absolute', borderTopColor: C.line, backgroundColor: 'transparent', height: 84, paddingTop: 8 },
      tabBarBackground: () => <View style={StyleSheet.absoluteFill}><BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,7,13,0.78)' }]} /></View>,
      tabBarActiveTintColor: C.text, tabBarInactiveTintColor: C.faint,
      tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 11 },
      tabBarBadgeStyle: { backgroundColor: C.accent2, color: '#fff', fontSize: 11, fontFamily: F.bold },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Chats', tabBarBadge: dmUnread || undefined, tabBarIcon: ({ focused }) => <TabIcon name="comment" focused={focused} /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Freunde', tabBarBadge: requests || undefined, tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Mitteilungen', tabBarBadge: notif ? (notif > 99 ? '99+' : notif) : undefined, tabBarIcon: ({ focused }) => <TabIcon name="bell" focused={focused} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Ich', tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} /> }} />
    </Tabs>
  );
}
