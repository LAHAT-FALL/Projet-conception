/**
 * Contexte d'authentification.
 * Persiste le jeton JWT dans expo-secure-store (chiffré, Keychain iOS / Keystore Android).
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ENDPOINTS } from '../constants/api';

const CLE_TOKEN = 'qk_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [jeton, setJeton] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Restaurer la session au démarrage en validant le jeton via GET /profile.
  // Timeout de 8s : si le backend est injoignable, on affiche la page de connexion.
  useEffect(() => {
    (async () => {
      try {
        const tokenSauvegarde = await SecureStore.getItemAsync(CLE_TOKEN);
        if (tokenSauvegarde) {
          const controleur = new AbortController();
          const minuterie = setTimeout(() => controleur.abort(), 8000);
          try {
            const reponse = await fetch(ENDPOINTS.profile, {
              headers: { Authorization: `Bearer ${tokenSauvegarde}` },
              signal: controleur.signal,
            });
            if (reponse.ok) {
              const donnees = await reponse.json();
              setJeton(tokenSauvegarde);
              setUtilisateur({ id: donnees.id, nom: donnees.nom, email: donnees.email });
            } else {
              await SecureStore.deleteItemAsync(CLE_TOKEN);
            }
          } catch {
            // Réseau injoignable ou token invalide : on efface et on affiche la connexion
            await SecureStore.deleteItemAsync(CLE_TOKEN).catch(() => {});
          } finally {
            clearTimeout(minuterie);
          }
        }
      } catch {
        // SecureStore inaccessible (émulateur web, erreur système) : ignorer
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  const connexion = useCallback(async (email, motDePasse) => {
    const reponse = await fetch(ENDPOINTS.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), mot_de_passe: motDePasse }),
    });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.detail || 'Erreur de connexion');
    await SecureStore.setItemAsync(CLE_TOKEN, donnees.access_token);
    setJeton(donnees.access_token);
    setUtilisateur({ id: donnees.user.id, nom: donnees.user.nom, email: donnees.user.email });
  }, []);

  const inscription = useCallback(async (nom, email, motDePasse) => {
    const reponse = await fetch(ENDPOINTS.register, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, mot_de_passe: motDePasse }),
    });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.detail || "Erreur d'inscription");
    await SecureStore.setItemAsync(CLE_TOKEN, donnees.access_token);
    setJeton(donnees.access_token);
    setUtilisateur({ id: donnees.user.id, nom: donnees.user.nom, email: donnees.user.email });
  }, []);

  const connexionOtp = useCallback(async (email, code) => {
    const reponse = await fetch(ENDPOINTS.otpVerify, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.detail || 'Code invalide');
    await SecureStore.setItemAsync(CLE_TOKEN, donnees.access_token);
    setJeton(donnees.access_token);
    setUtilisateur({ id: donnees.user.id, nom: donnees.user.nom, email: donnees.user.email });
  }, []);

  const deconnexion = useCallback(async () => {
    if (jeton) {
      try {
        await fetch(ENDPOINTS.logout, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jeton}` },
        });
      } catch { /* ignorer les erreurs réseau */ }
    }
    await SecureStore.deleteItemAsync(CLE_TOKEN);
    setJeton(null);
    setUtilisateur(null);
  }, [jeton]);

  const mettreAJourNom = useCallback((nouveauNom) => {
    setUtilisateur((u) => ({ ...u, nom: nouveauNom }));
  }, []);

  return (
    <AuthContext.Provider value={{ utilisateur, jeton, chargement, connexion, inscription, connexionOtp, deconnexion, mettreAJourNom }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
