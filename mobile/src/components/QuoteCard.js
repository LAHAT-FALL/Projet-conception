/**
 * Carte d'affichage d'une citation — design premium.
 */

import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function QuoteCard({ citation, estFavori, onFavori, onTraduire, onCopier, traduction, chargementTrad }) {
  const { theme } = useTheme();
  const c = theme.couleurs;

  if (!citation) return null;

  async function partager() {
    await Share.share({ message: `"${citation.text}" — ${citation.author}` });
  }

  return (
    <View style={[styles.carte, { backgroundColor: c.surface, borderColor: c.bordure }, theme.ombreFaible]}>

      {/* Catégorie */}
      {citation.category && (
        <View style={[styles.badge, { backgroundColor: c.primaireLight }]}>
          <Text style={[styles.badgeTexte, { color: c.primaire }]}>{citation.category}</Text>
        </View>
      )}

      {/* Guillemet décoratif */}
      <Text style={[styles.guillemet, { color: c.primaireLight }]}>"</Text>

      {/* Texte */}
      <Text style={[styles.texte, { color: c.textePrincipal }]}>{citation.text}</Text>

      {/* Auteur */}
      <View style={styles.auteurRow}>
        <View style={[styles.auteurLigne, { backgroundColor: c.primaire }]} />
        <Text style={[styles.auteur, { color: c.primaire }]}>{citation.author}</Text>
      </View>

      {/* Traduction */}
      {traduction && (
        <View style={[styles.traductionBox, { backgroundColor: c.surfaceAlt, borderColor: c.bordure }]}>
          <View style={styles.traductionEntete}>
            <Ionicons name="language" size={12} color={c.texteSecondaire} />
            <Text style={[styles.traductionLabel, { color: c.texteSecondaire }]}>Traduction FR</Text>
          </View>
          <Text style={[styles.traductionTexte, { color: c.textePrincipal }]}>{traduction}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actionsBar, { borderTopColor: c.bordure }]}>
        <TouchableOpacity
          style={[styles.actionBtn, estFavori && { backgroundColor: c.dangerLight }]}
          onPress={onFavori}
          activeOpacity={0.7}
        >
          <Ionicons
            name={estFavori ? 'heart' : 'heart-outline'}
            size={19}
            color={estFavori ? c.danger : c.texteSecondaire}
          />
          <Text style={[styles.actionTexte, { color: estFavori ? c.danger : c.texteSecondaire }]}>
            {estFavori ? 'Sauvé' : 'Favori'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.verticalDiviseur, { backgroundColor: c.bordure }]} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onTraduire}
          disabled={chargementTrad}
          activeOpacity={0.7}
        >
          <Ionicons
            name="language-outline"
            size={19}
            color={chargementTrad ? c.texteTertiaire : c.texteSecondaire}
          />
          <Text style={[styles.actionTexte, { color: chargementTrad ? c.texteTertiaire : c.texteSecondaire }]}>
            {chargementTrad ? '…' : 'Traduire'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.verticalDiviseur, { backgroundColor: c.bordure }]} />

        <TouchableOpacity style={styles.actionBtn} onPress={onCopier} activeOpacity={0.7}>
          <Ionicons name="copy-outline" size={19} color={c.texteSecondaire} />
          <Text style={[styles.actionTexte, { color: c.texteSecondaire }]}>Copier</Text>
        </TouchableOpacity>

        <View style={[styles.verticalDiviseur, { backgroundColor: c.bordure }]} />

        <TouchableOpacity style={styles.actionBtn} onPress={partager} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={19} color={c.texteSecondaire} />
          <Text style={[styles.actionTexte, { color: c.texteSecondaire }]}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 8,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    margin: 20,
    marginBottom: 0,
  },
  badgeTexte: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
  guillemet: {
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 60,
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: -4,
  },
  texte: {
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 28,
    paddingHorizontal: 22,
    paddingBottom: 16,
    letterSpacing: 0.1,
  },
  auteurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  auteurLigne: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  auteur: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  traductionBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  traductionEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  traductionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  traductionTexte: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  actionsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
  },
  actionTexte: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  verticalDiviseur: {
    width: 1,
    marginVertical: 10,
  },
});
