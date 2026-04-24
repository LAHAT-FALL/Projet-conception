/**
 * Aiguillage auth : si connecte -> MainTabs, sinon -> AuthStack.
 */

import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

export default function AppNavigator() {
  const { utilisateur, chargement } = useAuth();
  const { theme } = useTheme();

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.couleurs.fond }}>
        <LoadingSpinner />
      </View>
    );
  }

  return utilisateur ? <MainTabs /> : <AuthStack />;
}
