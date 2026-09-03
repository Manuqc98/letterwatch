import { View } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, BottomNavigation, Icon, IconButton, useTheme } from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import { WatchlistProvider, useWatchlist } from '../../src/context/WatchlistContext';

export default function TabsLayout() {
  return (
    <WatchlistProvider>
      <GuardedTabs />
    </WatchlistProvider>
  );
}

function GuardedTabs() {
  const { configured, newsMovies } = useWatchlist();
  const theme = useTheme();
  const router = useRouter();

  if (configured === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (configured === false) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      backBehavior="initialRoute"
      // Sin esto, "initialRoute" resolvería al primer hijo declarado (news)
      // y el back de Android desde Ready saltaría a News en vez de salir.
      initialRouteName="index"
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: () => (
          <IconButton
            icon="cog-outline"
            accessibilityLabel="Ajustes"
            onPress={() => router.push('/settings')}
            // 48x48dp: touch target mínimo M3 (el default de Paper es 40)
            style={{ width: 48, height: 48 }}
          />
        ),
      }}
      // Tab bar M3 de Paper sobre el navigator de tabs (patrón oficial).
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state}
          safeAreaInsets={insets}
          style={{ backgroundColor: theme.colors.elevation.level2 }}
          onTabPress={({ route, preventDefault }) => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) {
              preventDefault();
            } else {
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }
          }}
          renderIcon={({ route, focused, color }) =>
            descriptors[route.key]?.options.tabBarIcon?.({ focused, color, size: 24 }) ?? null
          }
          getLabelText={({ route }) => {
            const options = descriptors[route.key]?.options;
            return typeof options?.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options?.title ?? route.name;
          }}
          getBadge={({ route }) => {
            const badge = descriptors[route.key]?.options.tabBarBadge;
            return typeof badge === 'number' || typeof badge === 'string' ? badge : undefined;
          }}
        />
      )}
    >
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarBadge: newsMovies.length > 0 ? newsMovies.length : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'bell' : 'bell-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchout"
        options={{
          title: 'WatchOut',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'clock-alert' : 'clock-alert-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ready to watch',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'movie-check' : 'movie-check-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
