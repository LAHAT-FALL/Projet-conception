/**
 * Ligne de favori — design premium avec accent latéral.
 */

import React, { useState } from 'react';
import {
  Alert, Modal, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function FavoriteItem({ favori, onSupprimer, onModifierNote, onModifierTag }) {
  const { theme } = useTheme();
  const c = theme.couleurs;
  const [modalNote, setModalNote] = useState(false);
  const [texteNote, setTexteNote] = useState(favori.note || '');
  const [modalTag, setModalTag] = useState(false);
  const [texteTag, setTexteTag] = useState(favori.tag || '');

  function demanderSuppression() {
    Alert.alert('Retirer des favoris', 'Supprimer cette citation de vos favoris ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onSupprimer(favori.id) },
    ]);
  }

  async function partager() {
    await Share.share({ message: `"${favori.text}" — ${favori.author}` });
  }

  function enregistrerNote() {
    setModalNote(false);
    onModifierNote(favori.id, texteNote);
  }

  function enregistrerTag() {
    setModalTag(false);
    onModifierTag?.(favori.id, texteTag);
  }

  return (
    <View style={[styles.carte, { backgroundColor: c.surface, borderColor: c.bordure }, theme.ombreFaible]}>
      {/* Accent latéral */}
      <View style={[styles.accent, { backgroundColor: c.primaire }]} />

      <View style={styles.corps}>
        {/* Tag */}
        {favori.tag && (
          <View style={[styles.tagBadge, { backgroundColor: c.primaireLight }]}>
            <Ionicons name="pricetag" size={9} color={c.primaire} />
            <Text style={[styles.tagTexte, { color: c.primaire }]}>{favori.tag}</Text>
          </View>
        )}

        {/* Texte */}
        <Text style={[styles.texte, { color: c.textePrincipal }]} numberOfLines={4}>
          "{favori.text}"
        </Text>
        <Text style={[styles.auteur, { color: c.primaire }]}>— {favori.author}</Text>

        {/* Note */}
        {favori.note && (
          <View style={[styles.noteBox, { backgroundColor: c.noteFond, borderColor: c.noteBordure }]}>
            <Ionicons name="create" size={11} color={c.avertissement} />
            <Text style={[styles.noteTexte, { color: c.textePrincipal }]}>{favori.note}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.actionsRow, { borderTopColor: c.bordure }]}>
          <TouchableOpacity
            style={[styles.actionIconBtn, favori.note && { backgroundColor: c.avertissementLight }]}
            onPress={() => { setTexteNote(favori.note || ''); setModalNote(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name={favori.note ? 'create' : 'create-outline'} size={16} color={favori.note ? c.avertissement : c.texteTertiaire} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionIconBtn, favori.tag && { backgroundColor: c.primaireLight }]}
            onPress={() => { setTexteTag(favori.tag || ''); setModalTag(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name={favori.tag ? 'pricetag' : 'pricetag-outline'} size={16} color={favori.tag ? c.primaire : c.texteTertiaire} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={partager}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={16} color={c.texteTertiaire} />
          </TouchableOpacity>

          <View style={styles.actionSpacer} />

          <TouchableOpacity
            style={[styles.actionIconBtn, { backgroundColor: c.dangerLight }]}
            onPress={demanderSuppression}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={c.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal note */}
      <Modal visible={modalNote} transparent animationType="fade" onRequestClose={() => setModalNote(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: c.surface }]}>
            <View style={styles.modalEntete}>
              <Text style={[styles.modalTitre, { color: c.textePrincipal }]}>Note personnelle</Text>
              <TouchableOpacity onPress={() => setModalNote(false)} style={[styles.modalFermer, { backgroundColor: c.surfaceAlt }]}>
                <Ionicons name="close" size={18} color={c.texteSecondaire} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { backgroundColor: c.surfaceAlt, color: c.textePrincipal, borderColor: c.bordure }]}
              value={texteNote}
              onChangeText={setTexteNote}
              placeholder="Ajoutez une note personnelle… (max 500 car.)"
              placeholderTextColor={c.texteTertiaire}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.surfaceAlt }]}
                onPress={() => setModalNote(false)}
              >
                <Text style={[styles.modalBtnTexte, { color: c.textePrincipal }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.primaire }]}
                onPress={enregistrerNote}
              >
                <Text style={[styles.modalBtnTexte, { color: '#fff' }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal tag */}
      <Modal visible={modalTag} transparent animationType="fade" onRequestClose={() => setModalTag(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: c.surface }]}>
            <View style={styles.modalEntete}>
              <Text style={[styles.modalTitre, { color: c.textePrincipal }]}>Catégorie personnalisée</Text>
              <TouchableOpacity onPress={() => setModalTag(false)} style={[styles.modalFermer, { backgroundColor: c.surfaceAlt }]}>
                <Ionicons name="close" size={18} color={c.texteSecondaire} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInputSimple, { backgroundColor: c.surfaceAlt, color: c.textePrincipal, borderColor: c.bordure }]}
              value={texteTag}
              onChangeText={setTexteTag}
              placeholder="Ex: Inspirant, Philosophie…"
              placeholderTextColor={c.texteTertiaire}
              maxLength={50}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.surfaceAlt }]}
                onPress={() => setModalTag(false)}
              >
                <Text style={[styles.modalBtnTexte, { color: c.textePrincipal }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.primaire }]}
                onPress={enregistrerTag}
              >
                <Text style={[styles.modalBtnTexte, { color: '#fff' }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 20,
    marginVertical: 6,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
    borderRadius: 4,
    margin: 14,
    marginRight: 0,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  corps: {
    flex: 1,
    padding: 16,
    paddingLeft: 14,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  tagTexte: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  texte: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 8,
  },
  auteur: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  noteTexte: { flex: 1, fontSize: 12, lineHeight: 18 },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSpacer: { flex: 1 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 24,
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  modalEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitre: { fontSize: 16, fontWeight: '700' },
  modalFermer: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 110,
    lineHeight: 21,
  },
  modalInputSimple: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  modalBtnTexte: { fontWeight: '700', fontSize: 14 },
});
