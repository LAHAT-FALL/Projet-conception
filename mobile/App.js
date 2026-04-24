/**
 * Point d'entree de l'application QuoteKeeper Mobile.
 * Fournit les contextes Auth et Theme, puis monte la navigation.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

function NavigationThemed() {
  const { theme } = useTheme();
  const c = theme.couleurs;

  return (
    <NavigationContainer
      theme={{
        dark: theme.sombre,
        colors: {
          primary: c.primaire,
          background: c.fond,
          card: c.surface,
          text: c.textePrincipal,
          border: c.bordure,
          notification: c.primaire,
        },
      }}
    >
      <StatusBar style={theme.sombre ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationThemed />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
