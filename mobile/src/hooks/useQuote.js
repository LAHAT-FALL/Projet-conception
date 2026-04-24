/**
 * Hook pour les citations : aleatoire, du jour, traduction.
 */

import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import { ENDPOINTS } from '../constants/api';

export function useQuote() {
  const { requete } = useApi();
  const [citation, setCitation] = useState(null);
  const [citationDuJour, setCitationDuJour] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [traduction, setTraduction] = useState(null);
  const [chargementTrad, setChargementTrad] = useState(false);
  const [erreurJour, setErreurJour] = useState(null);

  const chargerAleatoire = useCallback(async (category = '', author = '') => {
    setChargement(true);
    setTraduction(null);
    try {
      let url = ENDPOINTS.random;
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (author) params.append('author', author);
      const qs = params.toString();
      if (qs) url += '?' + qs;
      const donnees = await requete(url);
      setCitation(donnees);
    } finally {
      setChargement(false);
    }
  }, [requete]);

  const chargerDuJour = useCallback(async () => {
    setErreurJour(null);
    try {
      const donnees = await requete(ENDPOINTS.daily);
      setCitationDuJour(donnees);
    } catch (err) {
      setErreurJour(err.message || 'Impossible de charger la citation du jour.');
    }
  }, [requete]);

  const traduire = useCallback(async (texte) => {
    if (!texte) return;
    setChargementTrad(true);
    try {
      const donnees = await requete(`${ENDPOINTS.translate}?texte=${encodeURIComponent(texte)}`);
      setTraduction(donnees.texte_traduit);
    } finally {
      setChargementTrad(false);
    }
  }, [requete]);

  return { citation, citationDuJour, chargement, traduction, chargementTrad, erreurJour, chargerAleatoire, chargerDuJour, traduire };
}
