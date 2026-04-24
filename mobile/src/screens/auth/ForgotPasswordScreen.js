/**
 * Réinitialisation de mot de passe par code email.
 *
 * Flux :
 *  Étape 1 — Email    → POST /auth/password-reset/request  (code à 6 chiffres envoyé par mail)
 *  Étape 2 — Code + nouveau MDP
 *              POST /auth/password-reset/verify → mot de passe mis à jour directement
 *  Étape 3 — Succès
 *
 * Utilise les mêmes endpoints que le portail web (anti-énumération, anti-spam, SHA-256).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { ENDPOINTS } from '../../constants/api';
import Toast from '../../components/Toast';

// ─── Analyse de la force du mot de passe ─────────────────────────────────────

function analyserMdp(mdp) {
  return {
    longueur:  mdp.length >= 12,
    majuscule: /[A-Z]/.test(mdp),
    minuscule: /[a-z]/.test(mdp),
    chiffre:   /[0-9]/.test(mdp),
  };
}

function scoreMdp(mdp) {
  const r = analyserMdp(mdp);
  return [r.longueur, r.majuscule, r.minuscule, r.chiffre].filter(Boolean).length;
}

const LABELS_FORCE  = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
const COULEURS_FORCE = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];

// ─── Composant indicateur de force ───────────────────────────────────────────

function ForceMdp({ mdp, c }) {
  if (!mdp) return null;
  const score  = scoreMdp(mdp);
  const regles = analyserMdp(mdp);
  const couleur = COULEURS_FORCE[score];
  return (
    <View style={fmS.conteneur}>
      <View style={fmS.barres}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[fmS.barre, { backgroundColor: score >= n ? couleur : c.bordure }]} />
        ))}
        <Text style={[fmS.label, { color: couleur }]}>{LABELS_FORCE[score]}</Text>
      </View>
      <View style={fmS.checklist}>
        {[
          { ok: regles.longueur,  txt: '12 caractères minimum' },
          { ok: regles.majuscule, txt: '1 lettre majuscule' },
          { ok: regles.minuscule, txt: '1 lettre minuscule' },
          { ok: regles.chiffre,   txt: '1 chiffre' },
        ].map(({ ok, txt }) => (
          <View key={txt} style={fmS.regle}>
            <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14}
              color={ok ? '#10B981' : c.texteTertiaire} />
            <Text style={[fmS.regleTxt, { color: ok ? '#10B981' : c.texteTertiaire }]}>{txt}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const fmS = StyleSheet.create({
  conteneur: { marginTop: 10, marginBottom: 4 },
  barres:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  barre:     { flex: 1, height: 4, borderRadius: 2 },
  label:     { fontSize: 12, fontWeight: '700', marginLeft: 4, minWidth: 42 },
  checklist: { gap: 5 },
  regle:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  regleTxt:  { fontSize: 12 },
});

// ─── Indicateur d'étapes ──────────────────────────────────────────────────────

function Etapes({ etape, c }) {
  const ETAPES = ['Email', 'Code OTP', 'Succès'];
  return (
    <View style={stS.conteneur}>
      {ETAPES.map((nom, i) => {
        const n     = i + 1;
        const fait  = etape > n;
        const actif = etape === n;
        return (
          <React.Fragment key={nom}>
            <View style={stS.etape}>
              <View style={[
                stS.cercle,
                fait  && { backgroundColor: c.succes,   borderColor: c.succes },
                actif && { backgroundColor: c.primaire, borderColor: c.primaire },
                !fait && !actif && { borderColor: c.bordure },
              ]}>
                {fait
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[stS.num, { color: actif ? '#fff' : c.texteTertiaire }]}>{n}</Text>
                }
              </View>
              <Text style={[stS.label, {
                color:      actif ? c.textePrincipal : fait ? c.succes : c.texteTertiaire,
                fontWeight: actif ? '700' : '500',
              }]}>{nom}</Text>
            </View>
            {i < ETAPES.length - 1 && (
              <View style={[stS.ligne, { backgroundColor: etape > n ? c.succes : c.bordure }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stS = StyleSheet.create({
  conteneur: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  etape:     { alignItems: 'center', gap: 5 },
  cercle:    { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  num:       { fontSize: 12, fontWeight: '700' },
  label:     { fontSize: 11, letterSpacing: 0.2 },
  ligne:     { flex: 1, height: 2, borderRadius: 1, marginBottom: 16, marginHorizontal: 4 },
});

// ─── Fetch avec timeout (10 s) ───────────────────────────────────────────────

async function fetchTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Délai dépassé. Vérifiez votre connexion et l\'IP du serveur.');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const c         = theme.couleurs;
  const toastRef  = useRef();
  const timerRef  = useRef(null);

  const [etape,          setEtape]          = useState(1);
  const [email,          setEmail]          = useState('');
  const [code,           setCode]           = useState('');
  const [nouveauMdp,     setNouveauMdp]     = useState('');
  const [confirmMdp,     setConfirmMdp]     = useState('');
  const [mdpVisible,     setMdpVisible]     = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [chargement,     setChargement]     = useState(false);
  const [secondes,       setSecondes]       = useState(0);
  const [focus,          setFocus]          = useState(null);

  // Nettoyage du timer au démontage
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Étape 1 : demander le code de réinitialisation ───────────────────────

  async function demanderCode() {
    const emailN = email.trim().toLowerCase();
    if (!emailN || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailN)) {
      toastRef.current?.afficher('Entrez une adresse email valide.', true);
      return;
    }
    setChargement(true);
    try {
      const rep  = await fetchTimeout(ENDPOINTS.passwordResetRequest, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailN }),
      });
      if (rep.status === 429) {
        // Anti-spam : un code a déjà été envoyé, il est encore valide
        setEtape(2);
        _demarrerTimer();
        toastRef.current?.afficher('Un code a déjà été envoyé. Utilisez le code reçu par email.');
        return;
      }
      if (!rep.ok) {
        const data = await rep.json().catch(() => ({}));
        throw new Error(data.detail || "Erreur d'envoi");
      }

      setEtape(2);
      _demarrerTimer();
      toastRef.current?.afficher('Code envoyé ! Vérifiez votre boîte mail.');
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  function _demarrerTimer() {
    setSecondes(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSecondes((s) => {
      if (s <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
      return s - 1;
    }), 1000);
  }

  // ── Étape 2 : vérifier le code + définir nouveau MDP ────────────────────

  async function reinitialiser() {
    if (code.length !== 6) {
      toastRef.current?.afficher('Le code doit contenir 6 chiffres.', true); return;
    }
    if (!nouveauMdp || !confirmMdp) {
      toastRef.current?.afficher('Remplissez tous les champs.', true); return;
    }
    if (nouveauMdp !== confirmMdp) {
      toastRef.current?.afficher('Les mots de passe ne correspondent pas.', true); return;
    }
    if (scoreMdp(nouveauMdp) < 4) {
      toastRef.current?.afficher('Le mot de passe ne respecte pas tous les critères.', true); return;
    }

    setChargement(true);
    try {
      // Vérifier le code et définir le nouveau mot de passe en un seul appel
      const rep  = await fetchTimeout(ENDPOINTS.passwordResetVerify, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:               email.trim().toLowerCase(),
          code,
          nouveau_mot_de_passe: nouveauMdp,
        }),
      });
      const data = await rep.json();
      if (!rep.ok) throw new Error(data.detail || 'Code invalide ou expiré.');

      if (timerRef.current) clearInterval(timerRef.current);
      setEtape(3);
    } catch (err) {
      toastRef.current?.afficher(err.message, true);
    } finally {
      setChargement(false);
    }
  }

  const couleurHero = etape === 3 ? c.succes : c.primaire;

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: couleurHero }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.logoWrap}>
          <Ionicons
            name={etape === 3 ? 'checkmark-circle-outline' : 'lock-open-outline'}
            size={36}
            color={couleurHero}
          />
        </View>
        <Text style={s.heroTitre}>
          {etape === 1 && 'Mot de passe oublié ?'}
          {etape === 2 && 'Vérification OTP'}
          {etape === 3 && 'Réinitialisé !'}
        </Text>
        <Text style={s.heroSousTitre}>
          {etape === 1 && 'Un code OTP sera envoyé à votre adresse email'}
          {etape === 2 && `Code envoyé à ${email.trim().toLowerCase()}`}
          {etape === 3 && 'Votre mot de passe a été mis à jour avec succès'}
        </Text>
      </View>

      {/* Carte flottante */}
      <ScrollView
        style={[s.card, { backgroundColor: c.fond }]}
        contentContainerStyle={s.cardContenu}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Etapes etape={etape} c={c} />

        {/* ── Étape 1 : Email ─────────────────────────────────────────────── */}
        {etape === 1 && (
          <>
            <View style={s.champWrap}>
              <Text style={[s.label, { color: c.texteSecondaire }]}>Adresse email</Text>
              <View style={[s.inputWrap, {
                borderColor:     focus === 'email' ? c.primaire : c.bordure,
                backgroundColor: c.surface,
              }]}>
                <Ionicons name="mail-outline" size={18}
                  color={focus === 'email' ? c.primaire : c.texteTertiaire} />
                <TextInput
                  style={[s.input, { color: c.textePrincipal }]}
                  placeholder="votre@email.com"
                  placeholderTextColor={c.texteTertiaire}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  onFocus={() => setFocus('email')}
                  onBlur={() => setFocus(null)}
                />
              </View>
            </View>

            {/* Info box OTP */}
            <View style={[s.infoBox, { backgroundColor: c.primaireLight, borderColor: c.bordure }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={c.primaire} />
              <Text style={[s.infoTexte, { color: c.primaire }]}>
                Un code à 6 chiffres vous sera envoyé par email pour vérifier votre identité.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.btn, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
              onPress={demanderCode}
              disabled={chargement}
              activeOpacity={0.85}
            >
              <View style={s.btnContenu}>
                <Ionicons name="send-outline" size={17} color="#fff" />
                <Text style={s.btnTexte}>{chargement ? 'Envoi en cours…' : 'Recevoir le code OTP'}</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape 2 : Code OTP + nouveau MDP ───────────────────────────── */}
        {etape === 2 && (
          <>
            {/* Email confirmé */}
            <View style={[s.emailConfirme, { backgroundColor: c.surface, borderColor: c.bordure }]}>
              <Ionicons name="mail" size={15} color={c.primaire} />
              <Text style={[s.emailConfirmeTxt, { color: c.texteSecondaire }]} numberOfLines={1}>
                {email.trim().toLowerCase()}
              </Text>
              <TouchableOpacity onPress={() => { setEtape(1); setCode(''); }}>
                <Text style={[s.modifierTxt, { color: c.primaire }]}>Modifier</Text>
              </TouchableOpacity>
            </View>

            {/* Code OTP */}
            <View style={s.champWrap}>
              <View style={s.labelRenvoyer}>
                <Text style={[s.label, { color: c.texteSecondaire }]}>Code OTP</Text>
                <TouchableOpacity onPress={demanderCode} disabled={secondes > 0 || chargement}>
                  <Text style={[s.renvoyerTxt, {
                    color: secondes > 0 ? c.texteTertiaire : c.primaire,
                  }]}>
                    {secondes > 0 ? `Renvoyer (${secondes}s)` : 'Renvoyer'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[s.inputCode, {
                  backgroundColor: c.surface,
                  color:           c.textePrincipal,
                  borderColor:     code.length === 6
                    ? c.succes
                    : focus === 'code' ? c.primaire : c.bordure,
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
              {code.length === 6 && (
                <View style={s.codeValide}>
                  <Ionicons name="checkmark-circle" size={14} color={c.succes} />
                  <Text style={[s.codeValideTxt, { color: c.succes }]}>Code complet</Text>
                </View>
              )}
            </View>

            {/* Nouveau mot de passe */}
            <View style={s.champWrap}>
              <Text style={[s.label, { color: c.texteSecondaire }]}>Nouveau mot de passe</Text>
              <View style={[s.inputWrap, {
                borderColor:     focus === 'mdp' ? c.primaire : c.bordure,
                backgroundColor: c.surface,
              }]}>
                <Ionicons name="lock-closed-outline" size={18}
                  color={focus === 'mdp' ? c.primaire : c.texteTertiaire} />
                <TextInput
                  style={[s.input, { color: c.textePrincipal, flex: 1 }]}
                  placeholder="Min. 12 car., 1 maj., 1 chiff."
                  placeholderTextColor={c.texteTertiaire}
                  value={nouveauMdp}
                  onChangeText={setNouveauMdp}
                  secureTextEntry={!mdpVisible}
                  autoCorrect={false}
                  autoCapitalize="none"
                  onFocus={() => setFocus('mdp')}
                  onBlur={() => setFocus(null)}
                />
                <TouchableOpacity onPress={() => setMdpVisible(!mdpVisible)} style={s.oeilBtn}>
                  <Ionicons name={mdpVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.texteTertiaire} />
                </TouchableOpacity>
              </View>
              <ForceMdp mdp={nouveauMdp} c={c} />
            </View>

            {/* Confirmation */}
            <View style={s.champWrap}>
              <Text style={[s.label, { color: c.texteSecondaire }]}>Confirmer le mot de passe</Text>
              <View style={[s.inputWrap, {
                borderColor: confirmMdp && nouveauMdp !== confirmMdp
                  ? c.danger
                  : focus === 'conf' ? c.primaire : c.bordure,
                backgroundColor: c.surface,
              }]}>
                <Ionicons name="shield-checkmark-outline" size={18}
                  color={confirmMdp && nouveauMdp !== confirmMdp ? c.danger : c.texteTertiaire} />
                <TextInput
                  style={[s.input, { color: c.textePrincipal, flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={c.texteTertiaire}
                  value={confirmMdp}
                  onChangeText={setConfirmMdp}
                  secureTextEntry={!confirmVisible}
                  autoCorrect={false}
                  autoCapitalize="none"
                  onFocus={() => setFocus('conf')}
                  onBlur={() => setFocus(null)}
                />
                <TouchableOpacity onPress={() => setConfirmVisible(!confirmVisible)} style={s.oeilBtn}>
                  <Ionicons name={confirmVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.texteTertiaire} />
                </TouchableOpacity>
              </View>
              {confirmMdp.length > 0 && nouveauMdp !== confirmMdp && (
                <Text style={[s.erreurMatch, { color: c.danger }]}>
                  Les mots de passe ne correspondent pas
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[s.btn, { backgroundColor: c.primaire, opacity: chargement ? 0.75 : 1 }]}
              onPress={reinitialiser}
              disabled={chargement}
              activeOpacity={0.85}
            >
              <View style={s.btnContenu}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.btnTexte}>
                  {chargement ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape 3 : Succès ────────────────────────────────────────────── */}
        {etape === 3 && (
          <View style={s.succes}>
            <View style={[s.succesIcone, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
            </View>
            <Text style={[s.succesTitre, { color: c.textePrincipal }]}>
              Mot de passe mis à jour !
            </Text>
            <Text style={[s.succesSousTitre, { color: c.texteSecondaire }]}>
              Votre identité a été vérifiée par OTP.{'\n'}
              Connectez-vous avec votre nouveau mot de passe.
            </Text>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: c.primaire, marginTop: 8 }]}
              onPress={() => navigation.navigate('Login', { email: email.trim().toLowerCase() })}
              activeOpacity={0.85}
            >
              <View style={s.btnContenu}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
                <Text style={s.btnTexte}>Se connecter</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Retour */}
        {etape < 3 && (
          <TouchableOpacity
            style={s.retourWrap}
            onPress={() => etape === 1 ? navigation.navigate('Login') : setEtape(1)}
          >
            <Ionicons name="arrow-back" size={15} color={c.texteTertiaire} />
            <Text style={[s.retourTexte, { color: c.texteTertiaire }]}>
              {etape === 1 ? 'Retour à la connexion' : 'Retour à l\'étape précédente'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Toast ref={toastRef} />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingTop: 52, paddingBottom: 28, paddingHorizontal: 32,
  },
  logoWrap: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitre: {
    fontSize: 24, fontWeight: '800', color: '#fff',
    letterSpacing: -0.4, marginBottom: 6, textAlign: 'center',
  },
  heroSousTitre: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', lineHeight: 20,
  },

  card: { borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
  cardContenu: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 40 },

  champWrap: { marginBottom: 18 },
  label: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  labelRenvoyer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  renvoyerTxt: { fontSize: 12, fontWeight: '700' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, height: 54,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  oeilBtn: { padding: 2 },

  inputCode: {
    borderWidth: 2, borderRadius: 16,
    fontSize: 32, fontWeight: '800',
    textAlign: 'center', letterSpacing: 14,
    paddingVertical: 18,
  },
  codeValide: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  codeValideTxt: { fontSize: 12, fontWeight: '600' },

  erreurMatch: { fontSize: 12, marginTop: 5, fontWeight: '500' },

  emailConfirme: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 18,
  },
  emailConfirmeTxt: { flex: 1, fontSize: 13 },
  modifierTxt: { fontSize: 13, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 20,
  },
  infoTexte: { flex: 1, fontSize: 13, lineHeight: 19 },

  btn: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  btnContenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTexte:   { color: '#fff', fontWeight: '700', fontSize: 15 },

  succes:     { alignItems: 'center', paddingVertical: 16 },
  succesIcone: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  succesTitre: {
    fontSize: 20, fontWeight: '800',
    marginBottom: 10, textAlign: 'center',
  },
  succesSousTitre: {
    fontSize: 14, lineHeight: 21,
    textAlign: 'center', marginBottom: 24, paddingHorizontal: 16,
  },

  retourWrap: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginTop: 4,
  },
  retourTexte: { fontSize: 13 },
});
