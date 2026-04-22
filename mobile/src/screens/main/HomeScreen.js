/**
 * Ecran principal : citation du jour + citation aléatoire avec filtres.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useQuote } from '../../hooks/useQuote';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../contexts/AuthContext';
import QuoteCard from '../../components/QuoteCard';
import FilterBar from '../../components/FilterBar';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';

function getSalutation() {
  const h = new Date().getHours();
  if (h < 6)  return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.couleurs;
  const { utilisateur } = useAuth();
  const toastRef = useRef();
  const { citation, citationDuJour, chargement, traduction, chargementTrad, chargerAleatoire, chargerDuJour, traduire } = useQuote();
  const { estFavori, ajouterFavori, supprimerFavori, charger: chargerFavoris } = useFavorites();
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  useEffect(() => {
    chargerDuJour().catch(() => {});
    chargerAleatoire().catch((err) => {
      toastRef.current?.afficher(err.message || 'Impossible de charger une citation.', true);
    });
    chargerFavoris().catch(() => {});
  }, []);

  async function nouvelleAleatoire(cat, auteur) {
    try {
      await chargerAleatoire(cat, auteur);
    } catch (err) {
      toastRef.current?.afficher(err.message || 'Impossible de charger une citation.', true);
    }
  }

  async function gererTraduction() {
    if (!citation) return;
    try {
      await traduire(citation.text);
    } catch (err) {
      toastRef.current?.afficher(err.message || 'Traduction indisponible.', true);
    }
  }

  async function gererFavori() {
    if (!citation) return;
    try {
      if (estFavori(citation.id)) {
        await supprimerFavori(citation.id);
        toastRef.current?.afficher('Retiré des favoris');
      } else {
        await ajouterFavori(citation);
        toastRef.current?.afficher('Ajouté aux favoris !');
      }
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    }
  }

  async function copier() {
    if (!citation) return;
    await Clipboard.setStringAsync(`"${citation.text}" — ${citation.author}`);
    toastRef.current?.afficher('Citation copiée !');
  }

  const prenom = utilisateur?.nom?.split(' ')[0] || '';

  return (
    <View style={[styles.flex, { backgroundColor: c.fond }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.entete}>
          <View>
            <Text style={[styles.salutation, { color: c.texteTertiaire }]}>{getSalutation()}{prenom ? `, ${prenom}` : ''} 👋</Text>
            <Text style={[styles.titre, { color: c.textePrincipal }]}>Découverte</Text>
          </View>
        </View>

        {/* Citation du jour */}
        {citationDuJour && (
          <View style={[styles.duJourCarte, { backgroundColor: c.primaire }]}>
            <View style={styles.duJourTop}>
              <View style={styles.duJourBadge}>
                <Ionicons name="sunny" size={11} color={c.primaire} />
                <Text style={[styles.duJourBadgeTexte, { color: c.primaire }]}>Citation du jour</Text>
              </View>
            </View>
            <Text style={styles.duJourGuillemet}>"</Text>
            <Text style={styles.duJourTexte}>{citationDuJour.text}</Text>
            <View style={styles.duJourPied}>
              <View style={styles.duJourLigne} />
              <Text style={styles.duJourAuteur}>{citationDuJour.author}</Text>
            </View>
          </View>
        )}

        {/* Contrôles */}
        <View style={styles.controles}>
          <TouchableOpacity
            style={[styles.btnNouvelle, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
            onPress={() => nouvelleAleatoire()}
            disabled={chargement}
            activeOpacity={0.85}
          >
            <Ionicons name="shuffle" size={18} color="#fff" />
            <Text style={styles.btnNouvelleTexte}>
              {chargement ? 'Chargement…' : 'Nouvelle citation'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btnFiltres,
              {
                borderColor: filtresOuverts ? c.primaire : c.bordure,
                backgroundColor: filtresOuverts ? c.primaireLight : c.surface,
              },
            ]}
            onPress={() => setFiltresOuverts(!filtresOuverts)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={filtresOuverts ? 'options' : 'options-outline'}
              size={18}
              color={filtresOuverts ? c.primaire : c.texteSecondaire}
            />
          </TouchableOpacity>
        </View>

        {filtresOuverts && (
          <FilterBar onFiltrer={(cat, auteur) => nouvelleAleatoire(cat, auteur)} />
        )}

        {/* Section titre citation */}
        <View style={styles.sectionEntete}>
          <Text style={[styles.sectionTitre, { color: c.textePrincipal }]}>Citation aléatoire</Text>
          {citation && (
            <TouchableOpacity
              onPress={copier}
              style={[styles.copierBtn, { backgroundColor: c.surfaceAlt }]}
            >
              <Ionicons name="copy-outline" size={14} color={c.texteSecondaire} />
            </TouchableOpacity>
          )}
        </View>

        {/* Carte citation aléatoire */}
        {chargement ? (
          <View style={styles.chargementWrap}>
            <LoadingSpinner />
          </View>
        ) : (
          <QuoteCard
            citation={citation}
            estFavori={citation ? estFavori(citation.id) : false}
            onFavori={gererFavori}
            onTraduire={gererTraduction}
            onCopier={copier}
            traduction={traduction}
            chargementTrad={chargementTrad}
          />
        )}
      </ScrollView>
      <Toast ref={toastRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 110 },

  entete: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 10,
  },
  salutation: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  titre: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  duJourCarte: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
  },
  duJourTop: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  duJourBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  duJourBadgeTexte: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  duJourGuillemet: {
    fontSize: 56,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '900',
    lineHeight: 46,
    marginBottom: 6,
  },
  duJourTexte: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#fff',
    lineHeight: 24,
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  duJourPied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  duJourLigne: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
  },
  duJourAuteur: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.2,
  },

  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  btnNouvelle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  btnNouvelleTexte: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnFiltres: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
  },

  sectionEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitre: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  copierBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chargementWrap: { paddingVertical: 40 },
});
