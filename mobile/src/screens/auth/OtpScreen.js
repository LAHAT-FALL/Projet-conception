/**
 * Ecran de connexion par code OTP — design professionnel.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ENDPOINTS } from '../../constants/api';
import Toast from '../../components/Toast';

export default function OtpScreen({ navigation }) {
  const { connexionOtp } = useAuth();
  const { theme } = useTheme();
  const c = theme.couleurs;
  const toastRef = useRef();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [etape, setEtape] = useState(1);
  const [chargement, setChargement] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [focus, setFocus] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function demanderCode() {
    if (!email.trim()) {
      toastRef.current?.afficher('Entrez votre adresse email.', true);
      return;
    }
    setChargement(true);
    try {
      const rep = await fetch(ENDPOINTS.otpRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await rep.json();
      if (!rep.ok) throw new Error(data.detail || "Erreur d'envoi");
      setEtape(2);
      setSecondes(60);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => setSecondes((s) => { if (s <= 1) { clearInterval(intervalRef.current); intervalRef.current = null; return 0; } return s - 1; }), 1000);
      toastRef.current?.afficher('Code envoyé ! Vérifiez votre boîte mail.');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  async function verifierCode() {
    if (code.length !== 6) {
      toastRef.current?.afficher('Le code doit contenir 6 chiffres.', true);
      return;
    }
    setChargement(true);
    try {
      await connexionOtp(email.trim().toLowerCase(), code);
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.fond }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* En-tête */}
        <View style={styles.entete}>
          <View style={[styles.logoIcone, { backgroundColor: c.primaireLight }]}>
            <Ionicons name="mail" size={32} color={c.primaire} />
          </View>
          <Text style={[styles.titre, { color: c.textePrincipal }]}>
            {etape === 1 ? 'Connexion par email' : 'Vérification'}
          </Text>
          <Text style={[styles.sousTitre, { color: c.texteSecondaire }]}>
            {etape === 1
              ? 'Recevez un code de connexion à 6 chiffres'
              : `Code envoyé à ${email}`}
          </Text>
        </View>

        {/* Carte */}
        <View style={[styles.carte, { backgroundColor: c.surface, borderColor: c.bordure }, theme.ombreFaible]}>

          {/* Email (toujours visible) */}
          <View style={styles.champWrap}>
            <Text style={[styles.label, { color: c.texteSecondaire }]}>Adresse email</Text>
            <View style={[styles.inputWrap, { borderColor: focus === 'email' ? c.bordureFocale : c.bordure, backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="mail-outline" size={18} color={focus === 'email' ? c.primaire : c.texteTertiaire} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.textePrincipal }]}
                placeholder="votre@email.com"
                placeholderTextColor={c.texteTertiaire}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={etape === 1}
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus(null)}
              />
            </View>
          </View>

          {/* Code OTP */}
          {etape === 2 && (
            <View style={styles.champWrap}>
              <Text style={[styles.label, { color: c.texteSecondaire }]}>Code à 6 chiffres</Text>
              <TextInput
                style={[styles.inputCode, {
                  backgroundColor: c.surfaceAlt,
                  color: c.textePrincipal,
                  borderColor: focus === 'code' ? c.bordureFocale : c.bordure,
                }]}
                placeholder="• • • • • •"
                placeholderTextColor={c.texteTertiaire}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                onFocus={() => setFocus('code')}
                onBlur={() => setFocus(null)}
              />
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btnPrincipal, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
            onPress={etape === 1 ? demanderCode : verifierCode}
            disabled={chargement}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrincipalTexte}>
              {chargement
                ? (etape === 1 ? 'Envoi en cours…' : 'Vérification…')
                : (etape === 1 ? 'Envoyer le code' : 'Confirmer')}
            </Text>
          </TouchableOpacity>

          {/* Renvoyer */}
          {etape === 2 && (
            <TouchableOpacity
              onPress={demanderCode}
              disabled={secondes > 0 || chargement}
              style={styles.renvoyerWrap}
            >
              <Text style={[styles.renvoyerTexte, { color: secondes > 0 ? c.texteTertiaire : c.primaire }]}>
                {secondes > 0 ? `Renvoyer dans ${secondes}s` : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Retour */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retourWrap}>
          <Ionicons name="arrow-back" size={16} color={c.texteSecondaire} />
          <Text style={[styles.retourTexte, { color: c.texteSecondaire }]}>Retour à la connexion</Text>
        </TouchableOpacity>

      </ScrollView>
      <Toast ref={toastRef} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contenu: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  entete: { alignItems: 'center', marginBottom: 28 },
  logoIcone: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  titre: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  sousTitre: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  carte: { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 16 },
  champWrap: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  inputCode: {
    borderWidth: 1.5, borderRadius: 12,
    fontSize: 32, fontWeight: '700',
    textAlign: 'center', letterSpacing: 12,
    paddingVertical: 16, paddingHorizontal: 24,
  },
  btnPrincipal: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14,
  },
  btnPrincipalTexte: { color: '#fff', fontWeight: '700', fontSize: 15 },
  renvoyerWrap: { alignItems: 'center', marginTop: 16 },
  renvoyerTexte: { fontSize: 14, fontWeight: '600' },
  retourWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  retourTexte: { fontSize: 14 },
});
