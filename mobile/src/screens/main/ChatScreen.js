/**
 * Ecran Chat IA — assistant litteraire avec Groq Llama.
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useApi } from '../../hooks/useApi';
import { ENDPOINTS } from '../../constants/api';

const ACTIONS_RAPIDES = [
  { label: 'Analyser mes favoris', icone: 'analytics-outline', type: 'analyze' },
  { label: 'Citations joyeuses', icone: 'sunny-outline', type: 'recommend', humeur: 'Je me sens joyeux et optimiste' },
  { label: 'Citations philosophiques', icone: 'book-outline', type: 'recommend', humeur: 'Je veux réfléchir sur le sens de la vie' },
  { label: 'Citations motivantes', icone: 'flash-outline', type: 'recommend', humeur: "J'ai besoin de motivation et d'énergie" },
  { label: 'Citations réconfortantes', icone: 'heart-outline', type: 'recommend', humeur: "Je me sens triste et j'ai besoin de réconfort" },
];

const MESSAGE_BIENVENUE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Bonjour ! Je suis votre assistant littéraire. Posez-moi des questions sur vos citations favorites, demandez-moi d\'expliquer une citation, ou explorons ensemble un thème philosophique.',
};

export default function ChatScreen() {
  const { theme } = useTheme();
  const c = theme.couleurs;
  const { requete } = useApi();
  const flatListRef = useRef();

  const [messages, setMessages] = useState([MESSAGE_BIENVENUE]);
  const [texte, setTexte] = useState('');
  const [chargement, setChargement] = useState(false);

  async function actionRapide(action) {
    if (chargement) return;
    let msgUtilisateur;
    let url;
    let body;

    if (action.type === 'analyze') {
      msgUtilisateur = { id: Date.now().toString(), role: 'user', content: 'Analyse mes citations favorites' };
      url = ENDPOINTS.aiAnalyze;
      body = JSON.stringify({});
    } else {
      msgUtilisateur = { id: Date.now().toString(), role: 'user', content: action.label };
      url = ENDPOINTS.aiRecommend;
      body = JSON.stringify({ humeur: action.humeur });
    }

    setMessages((prev) => [...prev, msgUtilisateur]);
    setChargement(true);
    try {
      const donnees = await requete(url, { method: 'POST', body });
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: donnees.reponse,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur est survenue : ${err.message}`,
        erreur: true,
      }]);
    } finally {
      setChargement(false);
    }
  }

  async function envoyer() {
    const contenu = texte.trim();
    if (!contenu || chargement) return;

    const msgUtilisateur = { id: Date.now().toString(), role: 'user', content: contenu };
    const nouvellesMessages = [...messages, msgUtilisateur];
    setMessages(nouvellesMessages);
    setTexte('');
    setChargement(true);

    try {
      const historique = nouvellesMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-19)
        .slice(0, -1)
        .map(({ role, content }) => ({ role, content }));

      const donnees = await requete(ENDPOINTS.aiChat, {
        method: 'POST',
        body: JSON.stringify({ message: contenu, historique }),
      });

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: donnees.reponse,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur est survenue : ${err.message}`,
        erreur: true,
      }]);
    } finally {
      setChargement(false);
    }
  }

  function reinitialiser() {
    setMessages([MESSAGE_BIENVENUE]);
    setTexte('');
  }

  function renderMessage({ item }) {
    const estUtilisateur = item.role === 'user';
    return (
      <View style={[styles.bulleWrap, estUtilisateur ? styles.droite : styles.gauche]}>
        {!estUtilisateur && (
          <View style={[styles.avatar, { backgroundColor: c.primaireLight }]}>
            <Ionicons name="sparkles" size={14} color={c.primaire} />
          </View>
        )}
        <View style={[
          styles.bulle,
          estUtilisateur
            ? { backgroundColor: c.primaire }
            : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure },
          item.erreur && { backgroundColor: c.danger },
        ]}>
          <Text style={[
            styles.bulleTexte,
            { color: estUtilisateur || item.erreur ? '#fff' : c.textePrincipal },
          ]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const envoiActif = texte.trim().length > 0 && !chargement;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.fond }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 94 : 0}
    >
      {/* En-tête */}
      <View style={[styles.entete, { backgroundColor: c.surface, borderBottomColor: c.bordure }]}>
        <View style={styles.enteteGauche}>
          <View style={[styles.enteteIcone, { backgroundColor: c.primaireLight }]}>
            <Ionicons name="sparkles" size={16} color={c.primaire} />
          </View>
          <View>
            <Text style={[styles.eteteTitre, { color: c.textePrincipal }]}>Assistant littéraire</Text>
            <Text style={[styles.enteteStatut, { color: c.succes }]}>En ligne · Groq AI</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.reinitBtn, { backgroundColor: c.surfaceAlt }]}
          onPress={reinitialiser}
        >
          <Ionicons name="refresh" size={15} color={c.texteSecondaire} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.liste}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      {/* Actions rapides */}
      {messages.length === 1 && !chargement && (
        <View style={[styles.actionsWrap, { borderTopColor: c.bordure }]}>
          <Text style={[styles.actionsLabel, { color: c.texteTertiaire }]}>SUGGESTIONS</Text>
          <View style={styles.actionsGrille}>
            {ACTIONS_RAPIDES.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionBtn, { backgroundColor: c.surface, borderColor: c.bordure }]}
                onPress={() => actionRapide(action)}
                activeOpacity={0.75}
              >
                <Ionicons name={action.icone} size={16} color={c.primaire} />
                <Text style={[styles.actionBtnTexte, { color: c.textePrincipal }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Indicateur de frappe */}
      {chargement && (
        <View style={styles.frappeWrap}>
          <View style={[styles.frappe, { backgroundColor: c.surface, borderColor: c.bordure }]}>
            <ActivityIndicator size="small" color={c.primaire} />
            <Text style={[styles.frappeTexte, { color: c.texteSecondaire }]}>L'assistant réfléchit…</Text>
          </View>
        </View>
      )}

      {/* Zone de saisie */}
      <View style={[styles.saisieWrap, { backgroundColor: c.surface, borderTopColor: c.bordure }]}>
        <TextInput
          style={[styles.saisie, { backgroundColor: c.surfaceAlt, color: c.textePrincipal, borderColor: c.bordure }]}
          placeholder="Posez une question sur les citations…"
          placeholderTextColor={c.texteTertiaire}
          value={texte}
          onChangeText={setTexte}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.btnEnvoyer, { backgroundColor: envoiActif ? c.primaire : c.bordure }]}
          onPress={envoyer}
          disabled={!envoiActif}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  enteteGauche: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  enteteIcone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eteteTitre: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  enteteStatut: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  reinitBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  liste: { padding: 16, gap: 12, paddingBottom: 16 },

  bulleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  droite: { justifyContent: 'flex-end' },
  gauche: { justifyContent: 'flex-start' },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulle: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  bulleTexte: { fontSize: 15, lineHeight: 22 },

  actionsWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  actionsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  actionsGrille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnTexte: { fontSize: 13, fontWeight: '500' },

  frappeWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  frappe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  frappeTexte: { fontSize: 13, fontStyle: 'italic' },

  saisieWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    paddingBottom: 110,
    borderTopWidth: 1,
  },
  saisie: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  btnEnvoyer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
