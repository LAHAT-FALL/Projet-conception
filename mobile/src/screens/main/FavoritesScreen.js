/**
 * Ecran Favoris : liste paginee avec recherche, filtre par tag, notes et actions.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useFavorites } from '../../hooks/useFavorites';
import FavoriteItem from '../../components/FavoriteItem';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';

const PAR_PAGE = 8;

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const c = theme.couleurs;
  const toastRef = useRef();
  const [recherche, setRecherche] = useState('');
  const [pageRecherche, setPageRecherche] = useState(1);
  const [tagFiltre, setTagFiltre] = useState(null);

  const {
    favoris, chargement, page, totalPages,
    setPage, charger, supprimerFavori, modifierNote, modifierTag,
    favorisPage,
  } = useFavorites();

  const tagsDisponibles = useMemo(() => {
    const tags = favoris.map((f) => f.tag).filter(Boolean);
    return [...new Set(tags)];
  }, [favoris]);

  useFocusEffect(
    useCallback(() => {
      charger();
      setRecherche('');
      setPageRecherche(1);
      setTagFiltre(null);
    }, [charger])
  );

  const favorisFiltrés = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const hasFiltre = q || tagFiltre;
    if (!hasFiltre) return null;
    return favoris.filter((f) => {
      const matchTag = tagFiltre ? f.tag === tagFiltre : true;
      const matchRecherche = q
        ? f.text?.toLowerCase().includes(q) ||
          f.author?.toLowerCase().includes(q) ||
          f.note?.toLowerCase().includes(q)
        : true;
      return matchTag && matchRecherche;
    });
  }, [favoris, recherche, tagFiltre]);

  const enModeRecherche = favorisFiltrés !== null;
  const totalPagesRecherche = Math.ceil((favorisFiltrés?.length || 0) / PAR_PAGE) || 1;
  const pageRechercheClamped = Math.min(pageRecherche, totalPagesRecherche);
  const favorisAffichés = enModeRecherche
    ? favorisFiltrés.slice((pageRechercheClamped - 1) * PAR_PAGE, pageRechercheClamped * PAR_PAGE)
    : favorisPage;

  async function handleSupprimer(quoteId) {
    try {
      await supprimerFavori(quoteId);
      toastRef.current?.afficher('Favori supprimé');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    }
  }

  async function handleTag(quoteId, tag) {
    try {
      await modifierTag(quoteId, tag);
      toastRef.current?.afficher(tag ? 'Tag enregistré !' : 'Tag supprimé');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    }
  }

  async function handleNote(quoteId, note) {
    try {
      await modifierNote(quoteId, note);
      toastRef.current?.afficher('Note enregistrée !');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    }
  }

  if (chargement) return <LoadingSpinner />;

  return (
    <View style={[styles.flex, { backgroundColor: c.fond }]}>

      {/* En-tête */}
      <View style={[styles.entete, { backgroundColor: c.surface, borderBottomColor: c.bordure }]}>
        <View>
          <Text style={[styles.enteteLabel, { color: c.texteTertiaire }]}>COLLECTION</Text>
          <Text style={[styles.eteteTitre, { color: c.textePrincipal }]}>Mes favoris</Text>
        </View>
        {favoris.length > 0 && (
          <View style={[styles.compteBadge, { backgroundColor: c.primaireLight }]}>
            <Text style={[styles.compteTexte, { color: c.primaire }]}>{favoris.length}</Text>
          </View>
        )}
      </View>

      {/* Barre de recherche */}
      <View style={[styles.searchWrap, { backgroundColor: c.surfaceAlt, borderColor: c.bordure }]}>
        <Ionicons name="search-outline" size={17} color={c.texteTertiaire} />
        <TextInput
          style={[styles.searchInput, { color: c.textePrincipal }]}
          placeholder="Rechercher dans les favoris…"
          placeholderTextColor={c.texteTertiaire}
          value={recherche}
          onChangeText={(t) => { setRecherche(t); setPageRecherche(1); }}
          returnKeyType="search"
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => { setRecherche(''); setPageRecherche(1); }}>
            <Ionicons name="close-circle" size={17} color={c.texteTertiaire} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres par tag */}
      {tagsDisponibles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContenu}
        >
          <TouchableOpacity
            style={[
              styles.tagPill,
              {
                backgroundColor: !tagFiltre ? c.primaire : c.surface,
                borderColor: !tagFiltre ? c.primaire : c.bordure,
              },
            ]}
            onPress={() => setTagFiltre(null)}
          >
            <Text style={[styles.tagPillTexte, { color: !tagFiltre ? '#fff' : c.texteSecondaire }]}>Tous</Text>
          </TouchableOpacity>
          {tagsDisponibles.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagPill,
                {
                  backgroundColor: tagFiltre === tag ? c.primaire : c.surface,
                  borderColor: tagFiltre === tag ? c.primaire : c.bordure,
                },
              ]}
              onPress={() => setTagFiltre(tagFiltre === tag ? null : tag)}
            >
              <Ionicons
                name="pricetag"
                size={10}
                color={tagFiltre === tag ? '#fff' : c.texteSecondaire}
              />
              <Text style={[styles.tagPillTexte, { color: tagFiltre === tag ? '#fff' : c.texteSecondaire }]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Compteur résultats */}
      {enModeRecherche && (
        <Text style={[styles.resultatsTexte, { color: c.texteTertiaire }]}>
          {favorisFiltrés.length} résultat{favorisFiltrés.length !== 1 ? 's' : ''}
        </Text>
      )}

      <FlatList
        data={favorisAffichés}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FavoriteItem
            favori={item}
            onSupprimer={handleSupprimer}
            onModifierNote={handleNote}
            onModifierTag={handleTag}
          />
        )}
        ListEmptyComponent={
          <View style={styles.vide}>
            <Ionicons name="heart-outline" size={48} color={c.bordure} style={{ marginBottom: 16 }} />
            <Text style={[styles.videTexte, { color: c.texteSecondaire }]}>
              {enModeRecherche
                ? 'Aucun résultat pour cette recherche.'
                : "Aucun favori pour l'instant.\nAjoutez des citations depuis l'onglet Accueil."}
            </Text>
          </View>
        }
        ListFooterComponent={
          <Pagination
            page={enModeRecherche ? pageRechercheClamped : page}
            totalPages={enModeRecherche ? totalPagesRecherche : totalPages}
            onPrecedent={() => enModeRecherche ? setPageRecherche((p) => p - 1) : setPage((p) => p - 1)}
            onSuivant={() => enModeRecherche ? setPageRecherche((p) => p + 1) : setPage((p) => p + 1)}
          />
        }
        contentContainerStyle={styles.liste}
        showsVerticalScrollIndicator={false}
      />
      <Toast ref={toastRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  enteteLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  eteteTitre: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  compteBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compteTexte: {
    fontSize: 15,
    fontWeight: '800',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  tagsScroll: { maxHeight: 48 },
  tagsContenu: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagPillTexte: { fontSize: 12, fontWeight: '700' },

  resultatsTexte: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
  },

  liste: { paddingTop: 8, paddingBottom: 110 },

  vide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  videTexte: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 23,
  },
});
