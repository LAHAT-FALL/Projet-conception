/**
 * Script principal du frontend QuoteKeeper.
 *
 * Fonctionnalites gerees par ce fichier :
 *   - Navigation SPA entre les pages (connexion, inscription, principale, profil)
 *   - Authentification email/mot de passe et Google OAuth 2.0
 *   - Citations aleatoires avec filtres par categorie et auteur
 *   - Citation du jour (meme citation pour toute la journee)
 *   - Traduction de citations en francais (service interne MyMemory)
 *   - Copie de citations dans le presse-papier
 *   - Gestion des favoris (ajout, suppression, recherche, pagination)
 *   - Notes personnelles sur les favoris
 *   - Page de profil (modifier nom, changer mot de passe)
 *   - Mode sombre / clair persisté en localStorage
 *   - Notifications toast pour les confirmations de succes
 */

/** URL de base de l'API backend */
const URL_API = 'http://localhost:8000/api';

/** Utilisateur actuellement connecte (null si deconnecte) */
let utilisateurCourant = null;

/** Citation affichee en ce moment dans la carte principale */
let citationCourante = null;

/** Liste complete des favoris de l'utilisateur charges depuis l'API */
let favoris = [];

/** Terme de recherche actuel dans la barre de recherche des favoris */
let rechercheFavoris = '';

/**
 * Etat de la pagination des favoris.
 * - page    : page courante (commence a 1)
 * - parPage : nombre d'items par page
 */
let paginationFavoris = { page: 1, parPage: 8 };

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────

/**
 * Affiche une page et masque toutes les autres.
 * Simule une SPA en utilisant la classe CSS 'active'.
 */
function afficherPage(identifiantPage) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(identifiantPage).classList.add('active');
}

/** Raccourci vers la page d'inscription */
function afficherPageInscription() {
    afficherPage('pageInscription');
}

/** Raccourci vers la page de connexion */
function afficherPageConnexion() {
    afficherPage('pageConnexion');
}

// ─────────────────────────────────────────────
// THEME (DARK MODE / LIGHT MODE)
// ─────────────────────────────────────────────

/**
 * Bascule entre le theme clair et le theme sombre.
 * Persiste le choix dans localStorage pour le retrouver au prochain chargement.
 * Met a jour l'icone des boutons de theme sur toutes les pages.
 */
function basculerTheme() {
    const estDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nouveauTheme = estDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nouveauTheme);
    localStorage.setItem('theme', nouveauTheme);
    mettreAJourIconeTheme(nouveauTheme);
}

/**
 * Met a jour l'icone (lune/soleil) sur les deux boutons de theme
 * (page principale et page profil).
 */
function mettreAJourIconeTheme(theme) {
    const iconeClasse = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    document.querySelectorAll('#boutonTheme i, #boutonThemeProfil i').forEach(icone => {
        icone.className = iconeClasse;
    });
}

/**
 * Applique le theme sauvegarde dans localStorage au chargement de la page.
 * Appele depuis DOMContentLoaded pour synchroniser l'icone avec le theme
 * deja applique par le script inline dans <head>.
 */
function initialiserTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    mettreAJourIconeTheme(theme);
}

// ─────────────────────────────────────────────
// NOTIFICATIONS (TOAST + ERREUR)
// ─────────────────────────────────────────────

/**
 * Affiche un toast de confirmation en bas de l'ecran.
 * Le toast disparait automatiquement apres 3 secondes.
 * Remplace l'ancien console.log pour un retour visuel reel.
 */
function afficherSucces(message) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.remove('hidden', 'toast-error');

    // Reinitialisation du timer pour les appels rapides successifs
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/**
 * Affiche un message d'erreur visible pendant 5 secondes.
 * Cree le conteneur si absent, sinon le reutilise.
 */
function afficherErreur(message) {
    let zoneErreur = document.querySelector('.error-message');

    if (!zoneErreur) {
        zoneErreur = document.createElement('div');
        zoneErreur.className = 'error-message';
        document.querySelector('.container').prepend(zoneErreur);
    }

    zoneErreur.textContent = message;
    zoneErreur.style.display = 'block';

    setTimeout(() => {
        zoneErreur.style.display = 'none';
    }, 5000);
}

// ─────────────────────────────────────────────
// GESTION DE L'UTILISATEUR
// ─────────────────────────────────────────────

/**
 * Met a jour l'affichage du nom de l'utilisateur dans l'en-tete.
 */
function mettreAJourAffichageUtilisateur() {
    // On met a jour uniquement l'element parent via innerHTML.
    // Ne pas acceder a #nomUtilisateur separement : le premier appel remplace
    // le innerHTML du parent, ce qui retire l'id="nomUtilisateur" du DOM.
    const zone = document.getElementById('affichageNomUtilisateur');
    if (zone) {
        zone.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <span>${utilisateurCourant.nom}</span>
        `;
    }
}

/**
 * Deconnecte l'utilisateur et reinitialise l'interface.
 * Le JWT est stateless : la deconnexion est uniquement locale (suppression localStorage).
 */
function deconnecterUtilisateur() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    utilisateurCourant = null;
    citationCourante = null;
    favoris = [];
    rechercheFavoris = '';
    paginationFavoris = { page: 1, parPage: 8 };

    // Remise a zero de la carte citation
    document.getElementById('texteCitation').textContent = 'Cliquez sur "Nouvelle citation" pour commencer';
    document.getElementById('auteurCitation').textContent = '';
    document.getElementById('boutonAjouterFavori').disabled = true;
    document.getElementById('boutonCopierCitation').disabled = true;
    document.getElementById('boutonTraduire').disabled = true;
    document.getElementById('zoneTraduction').classList.add('hidden');
    document.getElementById('texteTraduction').textContent = '';

    // Remise a zero des favoris
    document.getElementById('compteurFavoris').textContent = '0';
    document.getElementById('champRechercheFavoris').value = '';
    document.getElementById('listeFavoris').innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            Connectez-vous pour voir vos favoris
        </div>
    `;
    document.getElementById('controlesPagination').classList.add('hidden');

    // Remise a zero du bandeau citation du jour
    const bandeau = document.getElementById('citationDuJour');
    if (bandeau) bandeau.innerHTML = '<span class="daily-loading"><i class="fas fa-spinner fa-spin"></i></span>';

    afficherPage('pageConnexion');
}

// ─────────────────────────────────────────────
// AUTHENTIFICATION EMAIL / MOT DE PASSE
// ─────────────────────────────────────────────

/**
 * Inscrit un nouvel utilisateur via POST /api/auth/register.
 */
async function inscrireUtilisateur() {
    const nom = document.getElementById('nomInscription').value.trim();
    const email = document.getElementById('courrielInscription').value.trim();
    const motDePasse = document.getElementById('motDePasseInscription').value;

    if (!nom || !email || !motDePasse) {
        afficherErreur('Veuillez remplir tous les champs');
        return;
    }
    if (motDePasse.length < 6) {
        afficherErreur('Le mot de passe doit contenir au moins 6 caracteres');
        return;
    }

    try {
        const reponse = await fetch(`${URL_API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, email, mot_de_passe: motDePasse })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de l\'inscription');

        localStorage.setItem('token', donnees.access_token);
        localStorage.setItem('user', JSON.stringify(donnees.user));
        utilisateurCourant = donnees.user;
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        chargerCitationDuJour();
        afficherPage('pagePrincipale');
        afficherSucces('Bienvenue sur QuoteKeeper !');

        document.getElementById('nomInscription').value = '';
        document.getElementById('courrielInscription').value = '';
        document.getElementById('motDePasseInscription').value = '';

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

/**
 * Connecte un utilisateur existant via POST /api/auth/login.
 */
async function connecterUtilisateur() {
    const email = document.getElementById('courrielConnexion').value.trim();
    const motDePasse = document.getElementById('motDePasseConnexion').value;

    if (!email || !motDePasse) {
        afficherErreur('Veuillez remplir tous les champs');
        return;
    }

    try {
        const reponse = await fetch(`${URL_API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, mot_de_passe: motDePasse })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Email ou mot de passe incorrect');

        localStorage.setItem('token', donnees.access_token);
        localStorage.setItem('user', JSON.stringify(donnees.user));
        utilisateurCourant = donnees.user;
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        chargerCitationDuJour();
        afficherPage('pagePrincipale');
        afficherSucces('Connexion reussie');

        document.getElementById('courrielConnexion').value = '';
        document.getElementById('motDePasseConnexion').value = '';

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

// ─────────────────────────────────────────────
// AUTHENTIFICATION GOOGLE OAUTH
// ─────────────────────────────────────────────

/**
 * Lance le flux OAuth 2.0 Google en redirigeant vers le backend.
 */
function connexionGoogle() {
    window.location.href = 'http://localhost:8000/api/auth/google';
}

/**
 * Detecte et traite un retour du flux OAuth Google.
 * Le backend redirige avec ?token=...&nom=...&user_id=...&email=...
 * ou avec ?google_error=... en cas d'echec.
 */
async function traiterRetourGoogle() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const googleError = params.get('google_error');

    if (!token && !googleError) return false;

    // Nettoyage de l'URL pour eviter de retraiter au rechargement
    window.history.replaceState({}, '', window.location.pathname);

    if (googleError) {
        const messages = {
            non_configure: 'La connexion Google n\'est pas configuree sur le serveur.',
            acces_refuse: 'Connexion Google annulee.',
            token_invalide: 'Erreur lors de l\'authentification Google.',
            profil_inaccessible: 'Impossible de recuperer votre profil Google.',
        };
        afficherErreur(messages[googleError] || 'Connexion Google echouee.');
        afficherPage('pageConnexion');
        return true;
    }

    const utilisateur = {
        id: params.get('user_id') || '',
        nom: params.get('nom') || 'Utilisateur',
        email: params.get('email') || '',
        favorites: [],
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(utilisateur));
    utilisateurCourant = utilisateur;
    mettreAJourAffichageUtilisateur();
    await chargerFavoris();
    chargerCitationDuJour();
    afficherPage('pagePrincipale');
    return true;
}

/**
 * Verifie si une session existante (token dans localStorage) est encore valide.
 * Contacte le backend pour valider le token, avec fallback mode hors-ligne.
 */
async function verifierSessionExistante() {
    const jeton = localStorage.getItem('token');
    const utilisateurSauvegarde = localStorage.getItem('user');

    if (!jeton || !utilisateurSauvegarde) {
        afficherPage('pageConnexion');
        return;
    }

    try {
        const reponse = await fetch(`${URL_API}/auth/verify`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) {
            deconnecterUtilisateur();
            return;
        }

        utilisateurCourant = JSON.parse(utilisateurSauvegarde);
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        chargerCitationDuJour();
        afficherPage('pagePrincipale');

    } catch {
        // Serveur inaccessible : restauration locale
        try {
            utilisateurCourant = JSON.parse(utilisateurSauvegarde);
            mettreAJourAffichageUtilisateur();
            await chargerFavoris();
            chargerCitationDuJour();
            afficherPage('pagePrincipale');
        } catch {
            deconnecterUtilisateur();
        }
    }
}

// ─────────────────────────────────────────────
// CITATION DU JOUR
// ─────────────────────────────────────────────

/**
 * Charge et affiche la citation du jour dans le bandeau en haut de page.
 * Appelle GET /api/quotes/daily — meme citation pour toute la journee.
 * Echec silencieux : si l'API est indisponible, le bandeau reste vide.
 */
async function chargerCitationDuJour() {
    const jeton = localStorage.getItem('token');
    if (!jeton) return;

    const container = document.getElementById('citationDuJour');
    if (!container) return;

    try {
        const reponse = await fetch(`${URL_API}/quotes/daily`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) return;

        const citation = await reponse.json();
        container.innerHTML = `
            <span class="daily-text">"${citation.text}"</span>
            <span class="daily-author"> — ${citation.author}</span>
        `;
    } catch {
        // Echec silencieux : le bandeau reste dans son etat de chargement
        container.innerHTML = '';
    }
}

// ─────────────────────────────────────────────
// FILTRES POUR LES CITATIONS ALEATOIRES
// ─────────────────────────────────────────────

/**
 * Efface les filtres de recherche de citations (categorie et auteur).
 * Cache le bouton d'effacement apres reinitialisation.
 */
function reinitialiserFiltres() {
    const selectCategorie = document.getElementById('filtreCategorie');
    const champAuteur = document.getElementById('filtreAuteur');
    if (selectCategorie) selectCategorie.value = '';
    if (champAuteur) champAuteur.value = '';
}

// ─────────────────────────────────────────────
// CITATIONS
// ─────────────────────────────────────────────

/**
 * Definit la citation courante et met a jour l'affichage.
 * Active les boutons d'action et masque la traduction precedente.
 */
function definirCitationCourante(citation) {
    citationCourante = citation;
    document.getElementById('texteCitation').textContent = `"${citation.text}"`;
    document.getElementById('auteurCitation').textContent = `- ${citation.author}`;

    document.getElementById('boutonAjouterFavori').disabled = false;
    document.getElementById('boutonCopierCitation').disabled = false;
    document.getElementById('boutonTraduire').disabled = false;

    document.getElementById('zoneTraduction').classList.add('hidden');
    document.getElementById('texteTraduction').textContent = '';
}

/**
 * Construit la chaine formatee pour la copie dans le presse-papier.
 * Format : "texte de la citation" - Auteur
 */
function construireTexteCopie(citation) {
    return `"${citation.text}" - ${citation.author}`;
}

/**
 * Recupere une citation aleatoire depuis GET /api/quotes/random.
 * Lit les filtres de categorie et d'auteur s'ils sont renseignes.
 */
async function obtenirCitationAleatoire() {
    const jeton = localStorage.getItem('token');
    if (!jeton) {
        afficherErreur('Vous devez etre connecte');
        return;
    }

    const bouton = document.getElementById('boutonNouvelleCitation');
    const texteOriginal = bouton.innerHTML;
    bouton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
    bouton.disabled = true;

    try {
        // Lecture des filtres optionnels depuis le panneau de filtres
        const category = document.getElementById('filtreCategorie')?.value || '';
        const author = document.getElementById('filtreAuteur')?.value.trim() || '';

        // Construction des parametres de requete si des filtres sont actifs
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (author) params.append('author', author);

        const url = params.toString()
            ? `${URL_API}/quotes/random?${params}`
            : `${URL_API}/quotes/random`;

        const reponse = await fetch(url, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) {
            if (reponse.status === 401) {
                deconnecterUtilisateur();
                throw new Error('Session expiree, veuillez vous reconnecter');
            }
            if (reponse.status === 404 && author) {
                throw new Error(`Aucune citation de l'auteur "${author}" n'a été trouvée.`);
            }
            const erreurData = await reponse.json().catch(() => ({}));
            throw new Error(erreurData.detail || 'Erreur lors du chargement de la citation');
        }

        definirCitationCourante(await reponse.json());

    } catch (erreur) {
        afficherErreur(erreur.message);
    } finally {
        bouton.innerHTML = texteOriginal;
        bouton.disabled = false;
    }
}

/**
 * Utilise une citation saisie manuellement par l'utilisateur.
 * Chargee dans la carte principale sans passer par le backend.
 */
function utiliserCitationPersonnalisee() {
    const texte = document.getElementById('texteCitationPersonnalisee').value.trim();
    const auteur = document.getElementById('auteurCitationPersonnalisee').value.trim();
    const categorie = document.getElementById('categorieCitationPersonnalisee').value.trim();

    if (!texte || !auteur) {
        afficherErreur('Ajoute au moins le texte et l\'auteur de la citation');
        return;
    }

    definirCitationCourante({
        id: `custom_${Date.now()}`,
        text: texte,
        author: auteur,
        category: categorie || 'personnelle'
    });
}

/**
 * Traduit la citation courante en francais via GET /api/quotes/translate.
 */
async function traduireCitationCourante() {
    if (!citationCourante) {
        afficherErreur('Aucune citation a traduire');
        return;
    }

    const jeton = localStorage.getItem('token');
    const bouton = document.getElementById('boutonTraduire');
    const texteOriginal = bouton.innerHTML;

    bouton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduction...';
    bouton.disabled = true;

    try {
        const params = new URLSearchParams({
            texte: citationCourante.text,
            langue_source: 'en'
        });

        const reponse = await fetch(`${URL_API}/quotes/translate?${params}`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de la traduction');

        document.getElementById('texteTraduction').textContent = donnees.texte_traduit;
        document.getElementById('zoneTraduction').classList.remove('hidden');

    } catch (erreur) {
        afficherErreur(erreur.message);
    } finally {
        bouton.innerHTML = texteOriginal;
        bouton.disabled = false;
    }
}

/**
 * Copie la citation courante dans le presse-papier.
 */
async function copierCitationCourante() {
    if (!citationCourante) {
        afficherErreur('Aucune citation a copier');
        return;
    }
    await copierTexte(construireTexteCopie(citationCourante));
}

/**
 * Copie un texte dans le presse-papier via l'API Clipboard.
 * Affiche un toast de confirmation en cas de succes.
 */
async function copierTexte(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        afficherSucces('Citation copiee dans le presse-papier');
    } catch {
        afficherErreur('Impossible de copier (autorisation refusee par le navigateur)');
    }
}

// ─────────────────────────────────────────────
// FAVORIS
// ─────────────────────────────────────────────

/**
 * Ajoute la citation courante aux favoris via POST /api/quotes/favorites/{id}.
 */
async function ajouterCitationAuxFavoris() {
    if (!citationCourante) {
        afficherErreur('Aucune citation a sauvegarder');
        return;
    }

    const jeton = localStorage.getItem('token');
    const bouton = document.getElementById('boutonAjouterFavori');
    const texteOriginal = bouton.innerHTML;

    bouton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';
    bouton.disabled = true;

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites/${citationCourante.id}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(citationCourante)
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de l\'ajout aux favoris');

        afficherSucces(donnees.message || 'Citation ajoutee aux favoris');
        paginationFavoris.page = 1; // Retour a la premiere page apres ajout
        await chargerFavoris();

    } catch (erreur) {
        afficherErreur(erreur.message);
    } finally {
        setTimeout(() => {
            bouton.innerHTML = texteOriginal;
            bouton.disabled = false;
        }, 800);
    }
}

/**
 * Retire une citation des favoris via DELETE /api/quotes/favorites/{id}.
 */
async function retirerCitationDesFavoris(identifiantCitation) {
    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites/${identifiantCitation}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${jeton}` }
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors du retrait des favoris');

        afficherSucces('Citation retiree des favoris');
        // Si la suppression vide la page courante, revenir a la page precedente
        const totalApresSupp = favoris.length - 1;
        const totalPages = Math.ceil(totalApresSupp / paginationFavoris.parPage) || 1;
        if (paginationFavoris.page > totalPages) paginationFavoris.page = totalPages;
        await chargerFavoris();

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

/**
 * Ouvre une invite pour modifier la note personnelle sur un favori.
 * Envoie un PATCH /api/quotes/favorites/{id}/note avec le nouveau texte.
 */
async function modifierNoteFavori(quoteId, noteActuelle) {
    const nouvelleNote = prompt('Votre note personnelle (laissez vide pour effacer) :', noteActuelle || '');
    if (nouvelleNote === null) return; // Annule par l'utilisateur

    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites/${quoteId}/note`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ note: nouvelleNote })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de la modification de la note');

        afficherSucces(nouvelleNote ? 'Note enregistree' : 'Note supprimee');
        await chargerFavoris();

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

/**
 * Charge tous les favoris depuis GET /api/quotes/favorites.
 * Reconstruit la liste locale `favoris` puis declenche l'affichage.
 */
async function chargerFavoris() {
    const jeton = localStorage.getItem('token');
    if (!jeton) return;

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) throw new Error('Erreur lors du chargement des favoris');

        const donnees = await reponse.json();

        // Index Map pour acces O(1) aux details par identifiant
        const detailsParId = new Map(
            (donnees.favorite_quotes || []).map(citation => [citation.id, citation])
        );

        // Reconstruction dans l'ordre des IDs favoris
        favoris = (donnees.favorites || []).map(id => {
            return detailsParId.get(id) || {
                id,
                text: `Citation #${id}`,
                author: 'Details non disponibles'
            };
        });

        document.getElementById('compteurFavoris').textContent = favoris.length;
        afficherFavoris();

    } catch (erreur) {
        document.getElementById('listeFavoris').innerHTML = `
            <div class="error-message">Erreur lors du chargement des favoris</div>
        `;
    }
}

/**
 * Filtre les favoris selon le terme de recherche courant.
 * La recherche porte sur le texte, l'auteur et la categorie (insensible a la casse).
 */
function filtrerFavoris() {
    const requete = rechercheFavoris.trim().toLowerCase();
    if (!requete) return favoris;

    return favoris.filter(citation => {
        const contenu = `${citation.text} ${citation.author} ${citation.category || ''}`.toLowerCase();
        return contenu.includes(requete);
    });
}

/**
 * Met a jour les controles de pagination (boutons et indicateur de page).
 * Cache la barre si une seule page ou aucun favori.
 */
function mettreAJourPagination(pageCourante, totalPages) {
    const controles = document.getElementById('controlesPagination');
    const infoPage = document.getElementById('infoPage');
    const boutonPrec = document.getElementById('boutonPagePrec');
    const boutonSuiv = document.getElementById('boutonPageSuiv');

    if (totalPages <= 1) {
        controles.classList.add('hidden');
        return;
    }

    controles.classList.remove('hidden');
    if (infoPage) infoPage.textContent = `Page ${pageCourante} / ${totalPages}`;
    if (boutonPrec) boutonPrec.disabled = pageCourante <= 1;
    if (boutonSuiv) boutonSuiv.disabled = pageCourante >= totalPages;
}

/** Navigue vers la page precedente des favoris. */
function pagePrecedenteFavoris() {
    if (paginationFavoris.page > 1) {
        paginationFavoris.page--;
        afficherFavoris();
        document.querySelector('.favorites-section')?.scrollIntoView({ behavior: 'smooth' });
    }
}

/** Navigue vers la page suivante des favoris. */
function pageSuivanteFavoris() {
    const totalPages = Math.ceil(filtrerFavoris().length / paginationFavoris.parPage);
    if (paginationFavoris.page < totalPages) {
        paginationFavoris.page++;
        afficherFavoris();
        document.querySelector('.favorites-section')?.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Affiche la page courante des favoris dans le DOM.
 * Applique le filtre de recherche puis la pagination client.
 * Utilise le template HTML <template id="modeleFavori"> pour chaque item.
 */
function afficherFavoris() {
    const listeFavoris = document.getElementById('listeFavoris');
    const favorisVisibles = filtrerFavoris();

    // Cas 1 : aucun favori
    if (!favoris.length) {
        listeFavoris.innerHTML = `
            <div class="loading-spinner">
                <i class="far fa-heart"></i>
                <p>Aucun favori pour le moment</p>
                <small>Trouvez des citations et ajoutez-les a vos favoris !</small>
            </div>
        `;
        mettreAJourPagination(1, 1);
        return;
    }

    // Cas 2 : favoris existent mais aucun ne correspond a la recherche
    if (!favorisVisibles.length) {
        listeFavoris.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-search"></i>
                <p>Aucun resultat pour cette recherche</p>
            </div>
        `;
        mettreAJourPagination(1, 1);
        return;
    }

    // Calcul de la pagination
    const totalPages = Math.ceil(favorisVisibles.length / paginationFavoris.parPage) || 1;

    // Correction si la page courante depasse le total (apres suppression / recherche)
    if (paginationFavoris.page > totalPages) paginationFavoris.page = totalPages;

    const debut = (paginationFavoris.page - 1) * paginationFavoris.parPage;
    const fin = debut + paginationFavoris.parPage;
    const favorisPage = favorisVisibles.slice(debut, fin);

    // Mise a jour des controles de pagination
    mettreAJourPagination(paginationFavoris.page, totalPages);

    // Rendu de la page courante
    const modeleFavori = document.getElementById('modeleFavori');
    listeFavoris.innerHTML = '';

    favorisPage.forEach(citation => {
        const clone = modeleFavori.content.cloneNode(true);

        clone.querySelector('.favorite-text').textContent = `"${citation.text}"`;
        clone.querySelector('.favorite-author').textContent = citation.author || 'Auteur inconnu';

        // Affichage de la note personnelle si elle existe
        const elemNote = clone.querySelector('.favorite-note');
        if (citation.note) {
            elemNote.textContent = `Note : ${citation.note}`;
            elemNote.classList.remove('hidden');
        }

        // Bouton modifier la note
        clone.querySelector('.edit-note').onclick = () =>
            modifierNoteFavori(citation.id, citation.note || '');

        // Bouton copier
        clone.querySelector('.copy-favorite').onclick = () =>
            copierTexte(construireTexteCopie(citation));

        // Bouton supprimer
        clone.querySelector('.remove-favorite').onclick = () =>
            retirerCitationDesFavoris(citation.id);

        listeFavoris.appendChild(clone);
    });
}

// ─────────────────────────────────────────────
// PAGE DE PROFIL
// ─────────────────────────────────────────────

/**
 * Charge le profil depuis GET /api/auth/profile et affiche la page profil.
 * Pre-remplit le champ de nom avec la valeur actuelle.
 */
async function afficherPageProfil() {
    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/auth/profile`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) throw new Error('Impossible de charger le profil');

        const profil = await reponse.json();

        // Remplissage des informations affichees
        document.getElementById('nomProfilAffichage').textContent = profil.nom;
        document.getElementById('emailProfilAffichage').textContent = profil.email;
        document.getElementById('nomNouveauProfil').value = profil.nom;

        // Masquage de la section mot de passe pour les comptes Google purs
        const sectionMdp = document.getElementById('sectionMotDePasse');
        if (sectionMdp) {
            sectionMdp.style.display = profil.a_mot_de_passe ? '' : 'none';
        }

    } catch (erreur) {
        afficherErreur(erreur.message);
        return;
    }

    afficherPage('pageProfil');
}

/**
 * Envoie un PUT /api/auth/profile pour mettre a jour le nom de l'utilisateur.
 * Met a jour l'affichage et le localStorage apres succes.
 */
async function mettreAJourNomProfil() {
    const nom = document.getElementById('nomNouveauProfil').value.trim();

    if (!nom || nom.length < 2) {
        afficherErreur('Le nom doit contenir au moins 2 caracteres');
        return;
    }

    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/auth/profile`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nom })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de la mise a jour du nom');

        // Mise a jour locale de l'utilisateur courant
        utilisateurCourant.nom = nom;
        localStorage.setItem('user', JSON.stringify(utilisateurCourant));
        mettreAJourAffichageUtilisateur();

        // Mise a jour de l'affichage sur la page profil
        document.getElementById('nomProfilAffichage').textContent = nom;

        afficherSucces('Nom mis a jour');

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

/**
 * Envoie un PUT /api/auth/profile/password pour changer le mot de passe.
 * Verifie la confirmation avant d'envoyer la requete.
 */
async function changerMotDePasse() {
    const motDePasseActuel = document.getElementById('motDePasseActuel').value;
    const nouveauMotDePasse = document.getElementById('nouveauMotDePasse').value;
    const confirmationMotDePasse = document.getElementById('confirmationMotDePasse').value;

    if (!motDePasseActuel || !nouveauMotDePasse || !confirmationMotDePasse) {
        afficherErreur('Veuillez remplir tous les champs');
        return;
    }
    if (nouveauMotDePasse.length < 6) {
        afficherErreur('Le nouveau mot de passe doit contenir au moins 6 caracteres');
        return;
    }
    if (nouveauMotDePasse !== confirmationMotDePasse) {
        afficherErreur('Les deux nouveaux mots de passe ne correspondent pas');
        return;
    }

    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/auth/profile/password`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mot_de_passe_actuel: motDePasseActuel,
                nouveau_mot_de_passe: nouveauMotDePasse
            })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors du changement de mot de passe');

        // Effacement des champs apres succes
        document.getElementById('motDePasseActuel').value = '';
        document.getElementById('nouveauMotDePasse').value = '';
        document.getElementById('confirmationMotDePasse').value = '';

        afficherSucces('Mot de passe modifie');

    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

// ─────────────────────────────────────────────
// EVENEMENTS GLOBAUX
// ─────────────────────────────────────────────

/**
 * Soumission des formulaires avec la touche Entree.
 */
document.addEventListener('keypress', (evenement) => {
    if (evenement.key === 'Enter') {
        const pageActive = document.querySelector('.page.active');
        if (!pageActive) return;
        if (pageActive.id === 'pageConnexion') connecterUtilisateur();
        else if (pageActive.id === 'pageInscription') inscrireUtilisateur();
    }
});

/**
 * Point d'entree principal — execute au chargement complet du DOM.
 *
 * Ordre de priorite :
 * 1. Application du theme sauvegarde (icone lune/soleil)
 * 2. Traitement d'un retour OAuth Google (token dans l'URL)
 * 3. Verification et restauration d'une session existante (localStorage)
 * 4. Initialisation des evenements interactifs
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Priorite 1 : synchroniser l'icone du bouton theme avec le theme applique par le script inline
    initialiserTheme();

    // Priorite 2 : traiter un retour OAuth Google
    const gereParGoogle = await traiterRetourGoogle();
    if (gereParGoogle) return;

    // Priorite 3 : restaurer une session existante
    await verifierSessionExistante();

    // Clic sur le compte demo : remplissage automatique des champs
    document.querySelector('.demo-account code')?.addEventListener('click', () => {
        document.getElementById('courrielConnexion').value = 'demo@test.com';
        document.getElementById('motDePasseConnexion').value = 'demo123';
    });

    // Recherche en temps reel dans les favoris
    document.getElementById('champRechercheFavoris')?.addEventListener('input', (ev) => {
        rechercheFavoris = ev.target.value;
        paginationFavoris.page = 1; // Retour a la premiere page a chaque nouvelle recherche
        afficherFavoris();
    });
});
