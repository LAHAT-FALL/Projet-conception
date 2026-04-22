/**
 * Ecran de connexion — design premium.
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

export default function LoginScreen({ navigation }) {
  const { connexion } = useAuth();
  const { theme } = useTheme();
  const c = theme.couleurs;
  const toastRef = useRef();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [mdpVisible, setMdpVisible] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [focus, setFocus] = useState(null);

  async function seConnecter() {
    if (!email.trim() || !motDePasse) {
      toastRef.current?.afficher('Remplissez tous les champs.', true);
      return;
    }
    setChargement(true);
    try {
      await connexion(email.trim(), motDePasse);
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.primaire }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Zone hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>📖</Text>
        </View>
        <Text style={styles.heroTitre}>QuoteKeeper</Text>
        <Text style={styles.heroSousTitre}>Vos citations inspirantes</Text>
      </View>

      {/* Carte formulaire */}
      <ScrollView
        style={[styles.card, { backgroundColor: c.fond }]}
        contentContainerStyle={styles.cardContenu}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={[styles.titre, { color: c.textePrincipal }]}>Bon retour</Text>
        <Text style={[styles.sousTitre, { color: c.texteSecondaire }]}>Connectez-vous pour accéder à vos citations</Text>

        <View style={styles.champWrap}>
          <Text style={[styles.label, { color: c.texteSecondaire }]}>Email</Text>
          <View style={[styles.inputWrap, {
            borderColor: focus === 'email' ? c.primaire : c.bordure,
            backgroundColor: c.surface,
          }]}>
            <Ionicons name="mail-outline" size={18} color={focus === 'email' ? c.primaire : c.texteTertiaire} />
            <TextInput
              style={[styles.input, { color: c.textePrincipal }]}
              placeholder="votre@email.com"
              placeholderTextColor={c.texteTertiaire}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
            />
          </View>
        </View>

        <View style={styles.champWrap}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: c.texteSecondaire }]}>Mot de passe</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={[styles.motDePasseOublie, { color: c.primaire }]}>Oublié ?</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrap, {
            borderColor: focus === 'mdp' ? c.primaire : c.bordure,
            backgroundColor: c.surface,
          }]}>
            <Ionicons name="lock-closed-outline" size={18} color={focus === 'mdp' ? c.primaire : c.texteTertiaire} />
            <TextInput
              style={[styles.input, { color: c.textePrincipal, flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={c.texteTertiaire}
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry={!mdpVisible}
              onFocus={() => setFocus('mdp')}
              onBlur={() => setFocus(null)}
            />
            <TouchableOpacity onPress={() => setMdpVisible(!mdpVisible)} style={styles.oeilBtn}>
              <Ionicons name={mdpVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.texteTertiaire} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
          onPress={seConnecter}
          disabled={chargement}
          activeOpacity={0.85}
        >
          {chargement
            ? <Text style={styles.btnTexte}>Connexion en cours…</Text>
            : <View style={styles.btnContenu}>
                <Text style={styles.btnTexte}>Se connecter</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
          }
        </TouchableOpacity>

        <View style={[styles.diviseur, { backgroundColor: c.bordure }]}>
          <Text style={[styles.diviseurTexte, { color: c.texteTertiaire, backgroundColor: c.fond }]}>ou</Text>
        </View>

        <TouchableOpacity
          style={[styles.btnContour, { borderColor: c.bordure, backgroundColor: c.surface }]}
          onPress={() => navigation.navigate('Otp')}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={16} color={c.primaire} />
          <Text style={[styles.btnContourTexte, { color: c.primaire }]}>Connexion par code email</Text>
        </TouchableOpacity>

        <View style={styles.piedPage}>
          <Text style={[styles.piedPageTexte, { color: c.texteSecondaire }]}>Pas encore de compte ?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.lien, { color: c.primaire }]}> S'inscrire</Text>
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
    paddingTop: 56,
    paddingBottom: 36,
  },
  logoWrap: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 38 },
  heroTitre: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  heroSousTitre: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '400' },

  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
  },
  cardContenu: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  titre: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  sousTitre: { fontSize: 14, lineHeight: 20, marginBottom: 28 },

  champWrap: { marginBottom: 18 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  motDePasseOublie: { fontSize: 12, fontWeight: '700' },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    height: 56, borderRadius: 16, marginTop: 6, marginBottom: 20,
  },
  btnContenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTexte: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },

  diviseur: {
    height: 1, marginBottom: 20, position: 'relative', alignItems: 'center',
  },
  diviseurTexte: {
    position: 'absolute', top: -9,
    paddingHorizontal: 12, fontSize: 12, fontWeight: '500',
  },

  btnContour: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14, borderWidth: 1.5, marginBottom: 24,
  },
  btnContourTexte: { fontWeight: '600', fontSize: 14 },

  piedPage: { flexDirection: 'row', justifyContent: 'center' },
  piedPageTexte: { fontSize: 14 },
  lien: { fontSize: 14, fontWeight: '700' },
});
