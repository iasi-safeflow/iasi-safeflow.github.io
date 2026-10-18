import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts } from '@/theme';

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    // The tab bar passes the tint colours set below, which are plain strings.
    return <Icon name={name} size={22} color={String(color)} />;
  };

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isReviewer = user?.role === 'reviewer';
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.extrabold },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primarySoftText,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarLabelStyle: { fontFamily: fonts.extrabold, fontSize: 12 },
        tabBarHideOnKeyboard: true,
        // Floating, rounded bar; scrolling screens leave room for it (TAB_BAR_SPACE).
        tabBarStyle: {
          position: 'absolute',
          // Margins rather than left/right offsets: React Navigation on Android stretches the bar to full width
          // and ignores left/right, while margins work on both Android and the web.
          left: 0,
          right: 0,
          marginHorizontal: 16,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 6,
          borderRadius: 26,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          elevation: 6,
          shadowColor: colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarItemStyle: { borderRadius: 20, marginHorizontal: 2, overflow: 'hidden' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabMap, headerShown: false, tabBarIcon: icon('map') }} />
      {/* Reporting starts from the big button on the map screen, so the form has no tab button. Not `href: null`:
          this expo-router redirects away from such hidden tabs, which would make /report unreachable. */}
      <Tabs.Screen
        name="report"
        options={{ title: t.tabReport, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="mine" options={{ title: t.tabMine, tabBarLabel: t.tabMineShort, tabBarIcon: icon('list') }} />
      {/* Hidden from reporters; the API enforces the role regardless. Kept registered until the saved session
          has loaded, so a deep link or browser reload on /review is not bounced to the first tab. */}
      <Tabs.Screen
        name="review"
        options={{ title: t.tabReview, tabBarIcon: icon('check-square'), href: isReviewer || !ready ? undefined : null }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t.tabHistory, tabBarIcon: icon('activity'), href: isReviewer || !ready ? undefined : null }}
      />
      <Tabs.Screen name="account" options={{ title: t.tabAccount, tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
