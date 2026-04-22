/**
 * Navigation principale — tab bar flottante en pilule.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import ChatScreen from '../screens/main/ChatScreen';
import FavoritesScreen from '../screens/main/FavoritesScreen';
import HomeScreen from '../screens/main/HomeScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const ONGLETS = {
  Home:    { active: 'home',        inactive: 'home-outline'        },
  Favoris: { active: 'heart',       inactive: 'heart-outline'       },
  Chat:    { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profil:  { active: 'person',      inactive: 'person-outline'      },
};

export default function MainTabs() {
  const { theme } = useTheme();
  const c = theme.couleurs;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const cfg = ONGLETS[route.name];
          return (
            <View style={focused
              ? [styles.iconActif, { backgroundColor: c.primaire }]
              : styles.iconInactif
            }>
              <Ionicons
                name={focused ? cfg.active : cfg.inactive}
                size={22}
                color={focused ? '#fff' : color}
              />
            </View>
          );
        },
        tabBarActiveTintColor: c.primaire,
        tabBarInactiveTintColor: c.texteTertiaire,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.sombre ? c.surface : '#fff',
          borderTopWidth: 0,
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          borderRadius: 32,
          height: 70,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: theme.sombre ? 0.5 : 0.14,
          shadowRadius: 28,
          elevation: 24,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}      />
      <Tab.Screen name="Favoris" component={FavoritesScreen} />
      <Tab.Screen name="Chat"    component={ChatScreen}      />
      <Tab.Screen name="Profil"  component={ProfileScreen}   />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconActif: {
    width: 48,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInactif: {
    width: 48,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
