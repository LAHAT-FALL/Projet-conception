/**
 * Hook pour la gestion des favoris : liste, ajout, suppression, notes, pagination.
 */

import { useState, useCallback, useEffect } from 'react';
import { useApi } from './useApi';
import { ENDPOINTS } from '../constants/api';

const PAR_PAGE = 8;

export function useFavorites() {
  const { requete } = useApi();
  const [favoris, setFavoris] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [page, setPage] = useState(1);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const donnees = await requete(ENDPOINTS.favorites);
      // L'API retourne { favorites: [...ids], favorite_quotes: [...citations] }
      setFavoris(donnees.favorite_quotes || []);
      setPage(1);
    } catch {
      // Erreur réseau ou auth : les favoris restent dans leur état précédent
    } finally {
      setChargement(false);
    }
  }, [requete]);

  const ajouterFavori = useCallback(async (citation) => {
    // Envoie les details de la citation dans le body pour eviter le fallback "Auteur inconnu"
    await requete(ENDPOINTS.favoriteById(citation.id), {
      method: 'POST',
      body: JSON.stringify({
        id: citation.id,
        text: citation.text,
        author: citation.author,
        category: citation.category || 'general',
      }),
    });
    await charger();
  }, [requete, charger]);

  const supprimerFavori = useCallback(async (quoteId) => {
    await requete(ENDPOINTS.favoriteById(quoteId), { method: 'DELETE' });
    setFavoris((prev) => prev.filter((f) => f.id !== quoteId));
  }, [requete]);

  // Recule d'une page si la suppression vide la page courante
  useEffect(() => {
    const total = Math.ceil(favoris.length / PAR_PAGE) || 1;
    setPage((p) => Math.min(p, total));
  }, [favoris.length]);

  const modifierNote = useCallback(async (quoteId, note) => {
    await requete(ENDPOINTS.favoriteNote(quoteId), {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
    setFavoris((prev) => prev.map((f) => (f.id === quoteId ? { ...f, note: note || undefined } : f)));
  }, [requete]);

  const modifierTag = useCallback(async (quoteId, tag) => {
    await requete(ENDPOINTS.favoriteTag(quoteId), {
      method: 'PATCH',
      body: JSON.stringify({ tag }),
    });
    setFavoris((prev) => prev.map((f) => (f.id === quoteId ? { ...f, tag: tag || undefined } : f)));
  }, [requete]);

  const estFavori = useCallback((quoteId) => favoris.some((f) => f.id === quoteId), [favoris]);

  const totalPages = Math.ceil(favoris.length / PAR_PAGE) || 1;
  const favorisPage = favoris.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

  return {
    favoris,
    favorisPage,
    chargement,
    page,
    totalPages,
    setPage,
    charger,
    ajouterFavori,
    supprimerFavori,
    modifierNote,
    modifierTag,
    estFavori,
  };
}
