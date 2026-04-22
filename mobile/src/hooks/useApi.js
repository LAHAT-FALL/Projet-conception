/**
 * Hook utilitaire pour les appels API authentifiés.
 * - Injecte automatiquement le header Authorization.
 * - Applique un timeout de 10 secondes via AbortController.
 * - Déconnecte automatiquement l'utilisateur en cas de réponse 401.
 */

import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIMEOUT_MS = 10_000;

export function useApi() {
  const { jeton, deconnexion } = useAuth();

  const requete = useCallback(async (url, options = {}) => {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), TIMEOUT_MS);

    const entetes = {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    };

    try {
      const reponse = await fetch(url, {
        ...options,
        headers: entetes,
        signal: controleur.signal,
      });

      if (reponse.status === 401) {
        // Token expiré ou invalide : déconnexion automatique
        await deconnexion();
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      if (!reponse.ok) {
        const erreur = await reponse.json().catch(() => ({ detail: 'Erreur réseau' }));
        throw new Error(erreur.detail || `Erreur ${reponse.status}`);
      }

      return reponse.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('La requête a expiré. Vérifiez votre connexion.');
      }
      throw err;
    } finally {
      clearTimeout(minuterie);
    }
  }, [jeton, deconnexion]);

  return { requete };
}
