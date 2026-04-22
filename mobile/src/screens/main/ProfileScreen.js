/**
 * Ecran Profil : compte, nom, mot de passe, apparence, notifications, deconnexion.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useApi } from '../../hooks/useApi';
import { useNotifications } from '../../hooks/useNotifications';
import { ENDPOINTS } from '../../constants/api';
import Toast from '../../components/Toast';

export default function ProfileScreen() {
  const { utilisateur, deconnexion, mettreAJourNom } = useAuth();
  const { theme, basculerTheme } = useTheme();
  const { requete } = useApi();
  const c = theme.couleurs;
  const toastRef = useRef();

  const [profil, setProfil] = useState(null);
  const [nouveauNom, setNouveauNom] = useState('');
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMDP, setNouveauMDP] = useState('');
  const [confirmMDP, setConfirmMDP] = useState('');
  const [chargementNom, setChargementNom] = useState(false);
  const [chargementMDP, setChargementMDP] = useState(false);
  const { activees: notifsActivees, heure: notifsHeure, activer: activerNotifs, desactiver: desactiverNotifs, changerHeure } = useNotifications();

  useEffect(() => {
    chargerProfil();
  }, []);

  async function chargerProfil() {
    try {
      const donnees = await requete(ENDPOINTS.profile);
      setProfil(donnees);
      setNouveauNom(donnees.nom || '');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    }
  }

  async function enregistrerNom() {
    if (!nouveauNom.trim()) {
      toastRef.current?.afficher('Le nom ne peut pas être vide.', true);
      return;
    }
    setChargementNom(true);
    try {
      await requete(ENDPOINTS.profile, {
        method: 'PUT',
        body: JSON.stringify({ nom: nouveauNom.trim() }),
      });
      mettreAJourNom(nouveauNom.trim());
      toastRef.current?.afficher('Nom mis à jour !');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargementNom(false);
    }
  }

  async function changerMotDePasse() {
    if (!motDePasseActuel || !nouveauMDP || !confirmMDP) {
      toastRef.current?.afficher('Remplissez tous les champs.', true);
      return;
    }
    if (nouveauMDP !== confirmMDP) {
      toastRef.current?.afficher('Les mots de passe ne correspondent pas.', true);
      return;
    }
    if (nouveauMDP.length < 12) {
      toastRef.current?.afficher('Nouveau mot de passe trop court (min. 12 caractères).', true);
      return;
    }
    if (!/[A-Z]/.test(nouveauMDP) || !/[a-z]/.test(nouveauMDP) || !/[0-9]/.test(nouveauMDP)) {
      toastRef.current?.afficher('Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.', true);
      return;
    }
    setChargementMDP(true);
    try {
      await requete(ENDPOINTS.profilePassword, {
        method: 'PUT',
        body: JSON.stringify({ mot_de_passe_actuel: motDePasseActuel, nouveau_mot_de_passe: nouveauMDP }),
      });
      setMotDePasseActuel('');
      setNouveauMDP('');
      setConfirmMDP('');
      toastRef.current?.afficher('Mot de passe changé !');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargementMDP(false);
    }
  }

  const initiales = (profil?.nom || utilisateur?.nom || '?')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.fond }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + infos */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCercle, { backgroundColor: c.primaire }]}>
            <Text style={styles.avatarInitiales}>{initiales}</Text>
          </View>
          <Text style={[styles.avatarNom, { color: c.textePrincipal }]}>
            {profil?.nom || utilisateur?.nom}
          </Text>
          <Text style={[styles.avatarEmail, { color: c.texteSecondaire }]}>
            {profil?.email || utilisateur?.email}
          </Text>
        </View>

        {/* Modifier le nom */}
        <SectionCard titre="Modifier le nom" icone="person-outline" c={c} theme={theme}>
          <View style={[styles.inputWrap, { borderColor: c.bordure, backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="person-outline" size={16} color={c.texteTertiaire} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { color: c.textePrincipal }]}
              value={nouveauNom}
              onChangeText={setNouveauNom}
              placeholder="Votre nom"
              placeholderTextColor={c.texteTertiaire}
            />
          </View>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.primaire, opacity: chargementNom ? 0.75 : 1 }]}
            onPress={enregistrerNom}
            disabled={chargementNom}
            activeOpacity={0.85}
          >
            <Text style={styles.btnTexte}>{chargementNom ? 'Enregistrement…' : 'Enregistrer'}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Changer le mot de passe */}
        {profil?.a_mot_de_passe === true && (
          <SectionCard titre="Changer le mot de passe" icone="lock-closed-outline" c={c} theme={theme}>
            {[
              { label: 'Mot de passe actuel', value: motDePasseActuel, setter: setMotDePasseActuel },
              { label: 'Nouveau mot de passe', value: nouveauMDP, setter: setNouveauMDP },
              { label: 'Confirmer le nouveau', value: confirmMDP, setter: setConfirmMDP },
            ].map(({ label, value, setter }) => (
              <View key={label}>
                <Text style={[styles.champLabel, { color: c.texteSecondaire }]}>{label}</Text>
                <View style={[styles.inputWrap, { borderColor: c.bordure, backgroundColor: c.surfaceAlt }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={c.texteTertiaire} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: c.textePrincipal }]}
                    value={value}
                    onChangeText={setter}
                    placeholder="••••••••"
                    placeholderTextColor={c.texteTertiaire}
                    secureTextEntry
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.avertissement, opacity: chargementMDP ? 0.75 : 1 }]}
              onPress={changerMotDePasse}
              disabled={chargementMDP}
              activeOpacity={0.85}
            >
              <Text style={styles.btnTexte}>{chargementMDP ? 'Mise à jour…' : 'Changer le mot de passe'}</Text>
            </TouchableOpacity>
          </SectionCard>
        )}

        {/* Apparence */}
        <SectionCard titre="Apparence" icone="contrast-outline" c={c} theme={theme}>
          <View style={styles.switchLigne}>
            <View style={styles.switchInfo}>
              <Ionicons
                name={theme.sombre ? 'moon' : 'sunny'}
                size={18}
                color={theme.sombre ? c.primaire : c.avertissement}
              />
              <Text style={[styles.switchLabel, { color: c.textePrincipal }]}>
                {theme.sombre ? 'Mode sombre' : 'Mode clair'}
              </Text>
            </View>
            <Switch
              value={theme.sombre}
              onValueChange={basculerTheme}
              trackColor={{ false: c.bordure, true: c.primaire }}
              thumbColor="#fff"
            />
          </View>
        </SectionCard>

        {/* Notifications */}
        <SectionCard titre="Notification quotidienne" icone="notifications-outline" c={c} theme={theme}>
          <View style={styles.switchLigne}>
            <View style={styles.switchInfo}>
              <Ionicons name="alarm-outline" size={18} color={c.primaire} />
              <Text style={[styles.switchLabel, { color: c.textePrincipal }]}>Citation du jour</Text>
            </View>
            <Switch
              value={notifsActivees}
              onValueChange={async (val) => {
                try {
                  if (val) await activerNotifs();
                  else await desactiverNotifs();
                  toastRef.current?.afficher(val ? 'Notifications activées !' : 'Notifications désactivées');
                } catch (err) {
                  toastRef.current?.afficher(err.message, true);
                }
              }}
              trackColor={{ false: c.bordure, true: c.primaire }}
              thumbColor="#fff"
            />
          </View>

          {notifsActivees && (
            <View style={styles.heureSection}>
              <Text style={[styles.champLabel, { color: c.texteSecondaire }]}>Heure d'envoi</Text>
              <View style={styles.heuresBtns}>
                {[7, 8, 9, 12, 18, 20].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.heureBtn,
                      {
                        backgroundColor: notifsHeure === h ? c.primaire : c.surfaceAlt,
                        borderColor: notifsHeure === h ? c.primaire : c.bordure,
                      },
                    ]}
                    onPress={() => changerHeure(h).then(() => toastRef.current?.afficher(`Heure changée à ${h}h`))}
                  >
                    <Text style={[styles.heureBtnTexte, { color: notifsHeure === h ? '#fff' : c.texteSecondaire }]}>
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </SectionCard>

        {/* Déconnexion */}
        <TouchableOpacity
          style={[styles.btnDeconnexion, { backgroundColor: c.dangerLight, borderColor: c.danger }]}
          onPress={deconnexion}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={c.danger} />
          <Text style={[styles.btnDeconnexionTexte, { color: c.danger }]}>Se déconnecter</Text>
        </TouchableOpacity>

      </ScrollView>
      <Toast ref={toastRef} />
    </KeyboardAvoidingView>
  );
}

function SectionCard({ titre, icone, c, theme, children }) {
  return (
    <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.bordure }, theme.ombreFaible]}>
      <View style={styles.sectionEntete}>
        <View style={[styles.sectionIcone, { backgroundColor: c.primaireLight }]}>
          <Ionicons name={icone} size={16} color={c.primaire} />
        </View>
        <Text style={[styles.sectionTitre, { color: c.textePrincipal }]}>{titre}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110, gap: 14 },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatarCercle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitiales: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  avatarNom: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  avatarEmail: {
    fontSize: 14,
    fontWeight: '400',
  },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionIcone: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitre: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  champLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  btn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 2,
  },
  btnTexte: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  switchLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  heureSection: { gap: 8 },
  heuresBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heureBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 48,
    alignItems: 'center',
  },
  heureBtnTexte: { fontSize: 13, fontWeight: '700' },

  btnDeconnexion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
  },
  btnDeconnexionTexte: {
    fontWeight: '700',
    fontSize: 15,
  },
});
