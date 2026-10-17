import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';

import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const isReviewer = user?.role === 'reviewer';
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleAlign: 'center' }}>
      <Tabs.Screen name="index" options={{ title: t.tabMap, tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="report" options={{ title: t.tabReport, tabBarIcon: icon('＋') }} />
      <Tabs.Screen name="mine" options={{ title: t.tabMine, tabBarIcon: icon('☰') }} />
      {/* Hidden from reporters; the API enforces the role regardless. Kept registered until the saved session
          has loaded, so a deep link or browser reload on /review is not bounced to the first tab. */}
      <Tabs.Screen
        name="review"
        options={{ title: t.tabReview, tabBarIcon: icon('✓'), href: isReviewer || !ready ? undefined : null }}
      />
      <Tabs.Screen name="account" options={{ title: t.tabAccount, tabBarIcon: icon('●') }} />
    </Tabs>
  );
}
