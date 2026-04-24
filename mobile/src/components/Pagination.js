import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function Pagination({ page, totalPages, onPrecedent, onSuivant }) {
  const { theme } = useTheme();
  const c = theme.couleurs;

  if (totalPages <= 1) return null;

  return (
    <View style={styles.conteneur}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: c.primaire, opacity: page <= 1 ? 0.4 : 1 }]}
        onPress={onPrecedent}
        disabled={page <= 1}
      >
        <Text style={styles.btnTexte}>‹ Précédent</Text>
      </TouchableOpacity>

      <Text style={[styles.info, { color: c.texteSecondaire }]}>
        {page} / {totalPages}
      </Text>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: c.primaire, opacity: page >= totalPages ? 0.4 : 1 }]}
        onPress={onSuivant}
        disabled={page >= totalPages}
      >
        <Text style={styles.btnTexte}>Suivant ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnTexte: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  info: {
    fontSize: 14,
    fontWeight: '500',
  },
});
