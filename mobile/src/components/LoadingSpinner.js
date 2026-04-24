import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function LoadingSpinner({ taille = 'large' }) {
  const { theme } = useTheme();
  return (
    <View style={styles.conteneur}>
      <ActivityIndicator size={taille} color={theme.couleurs.primaire} />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
