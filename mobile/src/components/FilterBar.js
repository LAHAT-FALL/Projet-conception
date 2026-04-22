/**
 * Barre de filtres : categorie (picker) + auteur (texte).
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORIES = [
  '', 'age', 'alone', 'amazing', 'anger', 'architecture', 'art', 'attitude',
  'beauty', 'best', 'birthday', 'business', 'car', 'change', 'communication',
  'computers', 'cool', 'courage', 'dating', 'death', 'design', 'dreams',
  'education', 'environmental', 'equality', 'experience', 'failure', 'faith',
  'family', 'famous', 'fear', 'fitness', 'food', 'forgiveness', 'freedom',
  'friendship', 'funny', 'future', 'god', 'good', 'government', 'graduation',
  'great', 'happiness', 'health', 'history', 'home', 'hope', 'humor',
  'imagination', 'inspirational', 'intelligence', 'jealousy', 'knowledge',
  'leadership', 'learning', 'legal', 'life', 'love', 'marriage', 'medical',
  'men', 'mom', 'morning', 'movies', 'success',
];

export default function FilterBar({ onFiltrer }) {
  const { theme } = useTheme();
  const c = theme.couleurs;
  const [auteur, setAuteur] = useState('');
  const [categorie, setCategorie] = useState('');
  const [afficherCategories, setAfficherCategories] = useState(false);

  function appliquer() {
    onFiltrer(categorie, auteur.trim());
  }

  function reinitialiser() {
    setAuteur('');
    setCategorie('');
    onFiltrer('', '');
  }

  return (
    <View style={[styles.conteneur, { backgroundColor: c.surfaceAlt, borderColor: c.bordure }]}>
      <TextInput
        style={[styles.input, { backgroundColor: c.surface, color: c.textePrincipal, borderColor: c.bordure }]}
        placeholder="Filtrer par auteur…"
        placeholderTextColor={c.texteSecondaire}
        value={auteur}
        onChangeText={setAuteur}
        onSubmitEditing={appliquer}
        returnKeyType="search"
      />

      <TouchableOpacity
        style={[styles.selectBtn, { backgroundColor: c.surface, borderColor: c.bordure }]}
        onPress={() => setAfficherCategories(!afficherCategories)}
      >
        <Text style={{ color: categorie ? c.textePrincipal : c.texteSecondaire }}>
          {categorie || 'Toutes catégories'}
        </Text>
      </TouchableOpacity>

      {afficherCategories && (
        <View style={[styles.dropdown, { backgroundColor: c.surface, borderColor: c.bordure }]}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat || '__all__'}
                style={styles.dropdownItem}
                onPress={() => {
                  setCategorie(cat);
                  setAfficherCategories(false);
                }}
              >
                <Text style={{ color: c.textePrincipal }}>{cat || 'Toutes catégories'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.boutons}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: c.primaire }]} onPress={appliquer}>
          <Text style={styles.btnTexte}>Rechercher</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: c.texteSecondaire }]} onPress={reinitialiser}>
          <Text style={styles.btnTexte}>Effacer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  selectBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boutons: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnTexte: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
