/**
 * Ecran d'inscription — design premium.
 */

import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Toast from '../../components/Toast';

const CHAMPS = [
  { key: 'nom',   label: 'Nom complet',   placeholder: 'Jean Dupont',                  icone: 'person-outline',           type: 'default',       secure: false, cap: 'words' },
  { key: 'email', label: 'Adresse email', placeholder: 'votre@email.com',              icone: 'mail-outline',             type: 'email-address', secure: false, cap: 'none'  },
  { key: 'mdp',   label: 'Mot de passe',  placeholder: 'Min. 12 car., 1 maj., 1 chiff.', icone: 'lock-closed-outline',   type: 'default',       secure: true,  cap: 'none'  },
  { key: 'conf',  label: 'Confirmation',  placeholder: '••••••••',                     icone: 'shield-checkmark-outline', type: 'default',       secure: true,  cap: 'none'  },
];

export default function RegisterScreen({ navigation }) {
  const { inscription } = useAuth();
  const { theme } = useTheme();
  const c = theme.couleurs;
  const toastRef = useRef();

  const [valeurs, setValeurs] = useState({ nom: '', email: '', mdp: '', conf: '' });
  const [mdpVisible, setMdpVisible] = useState(false);
  const [confVisible, setConfVisible] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [focus, setFocus] = useState(null);

  function changer(key, val) { setValeurs((v) => ({ ...v, [key]: val })); }

  async function sInscrire() {
    const { nom, email, mdp, conf } = valeurs;
    if (!nom.trim() || !email.trim() || !mdp || !conf) {
      toastRef.current?.afficher('Remplissez tous les champs.', true); return;
    }
    if (mdp !== conf) {
      toastRef.current?.afficher('Les mots de passe ne correspondent pas.', true); return;
    }
    if (mdp.length < 12) {
      toastRef.current?.afficher('Mot de passe trop court (min. 12 caractères).', true); return;
    }
    if (!/[A-Z]/.test(mdp) || !/[a-z]/.test(mdp) || !/[0-9]/.test(mdp)) {
      toastRef.current?.afficher('Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.', true); return;
    }
    setChargement(true);
    try {
      await inscription(nom.trim(), email.trim(), mdp);
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.gradient2 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Zone hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>✨</Text>
        </View>
        <Text style={styles.heroTitre}>Créer un compte</Text>
        <Text style={styles.heroSousTitre}>Rejoignez QuoteKeeper gratuitement</Text>
      </View>

      {/* Carte formulaire */}
      <ScrollView
        style={[styles.card, { backgroundColor: c.fond }]}
        contentContainerStyle={styles.cardContenu}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {CHAMPS.map(({ key, label, placeholder, icone, type, secure, cap }) => {
          const estMdp = key === 'mdp';
          const estConf = key === 'conf';
          const visible = estMdp ? mdpVisible : confVisible;
          return (
            <View key={key} style={styles.champWrap}>
              <Text style={[styles.label, { color: c.texteSecondaire }]}>{label}</Text>
              <View style={[styles.inputWrap, {
                borderColor: focus === key ? c.primaire : c.bordure,
                backgroundColor: c.surface,
              }]}>
                <Ionicons name={icone} size={18} color={focus === key ? c.primaire : c.texteTertiaire} />
                <TextInput
                  style={[styles.input, { color: c.textePrincipal }]}
                  placeholder={placeholder}
                  placeholderTextColor={c.texteTertiaire}
                  value={valeurs[key]}
                  onChangeText={(v) => changer(key, v)}
                  keyboardType={type}
                  autoCapitalize={cap}
                  autoCorrect={!secure}
                  secureTextEntry={secure && !visible}
                  onFocus={() => setFocus(key)}
                  onBlur={() => setFocus(null)}
                />
                {(estMdp || estConf) && (
                  <TouchableOpacity
                    onPress={() => estMdp ? setMdpVisible(!mdpVisible) : setConfVisible(!confVisible)}
                    style={styles.oeilBtn}
                  >
                    <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.texteTertiaire} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
          onPress={sInscrire}
          disabled={chargement}
          activeOpacity={0.85}
        >
          {chargement
            ? <Text style={styles.btnTexte}>Création du compte…</Text>
            : <View style={styles.btnContenu}>
                <Text style={styles.btnTexte}>Créer mon compte</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
          }
        </TouchableOpacity>

        <View style={styles.piedPage}>
          <Text style={[styles.piedPageTexte, { color: c.texteSecondaire }]}>Déjà un compte ?</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.lien, { color: c.primaire }]}> Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast ref={toastRef} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 28,
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoEmoji: { fontSize: 36 },
  heroTitre: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  heroSousTitre: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
  },
  cardContenu: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
  },

  champWrap: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, height: 54,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  oeilBtn: { padding: 2 },

  btn: {
    alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, marginTop: 8, marginBottom: 20,
  },
  btnContenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTexte: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },

  piedPage: { flexDirection: 'row', justifyContent: 'center' },
  piedPageTexte: { fontSize: 14 },
  lien: { fontSize: 14, fontWeight: '700' },
});
