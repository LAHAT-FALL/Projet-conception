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
const URL_API = 'https://localhost:8000/api';

/**
 * Wrapper fetch avec timeout automatique de 10 secondes.
 * Lance une erreur lisible si le serveur ne répond pas dans le délai imparti.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { credentials: 'include', ...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('La requête a expiré (timeout 10s). Vérifiez votre connexion.');
        throw err;
    } finally {
        clearTimeout(id);
    }
}

/** Utilisateur actuellement connecte (null si deconnecte) */
let utilisateurCourant = null;

/** Citation affichee en ce moment dans la carte principale */
let citationCourante = null;

/** Liste complete des favoris de l'utilisateur charges depuis l'API */
let favoris = [];

/** Terme de recherche actuel dans la barre de recherche des favoris */
let rechercheFavoris = '';

/** Historique de la conversation du chatbot IA en cours */
let historiqueChat = [];

/** Verrou pour eviter les envois simultanes au chatbot */
let chargementChat = false;

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

    // Bascule entre le mode portail et le mode authentification
    const pagesAuth = ['pageConnexion', 'pageInscription', 'pageMotDePasseOublie'];
    const portalShell = document.getElementById('portalShell');
    const authWrapper = document.getElementById('authWrapper');

    if (pagesAuth.includes(identifiantPage)) {
        if (portalShell) portalShell.classList.add('portal-hidden');
        if (authWrapper) authWrapper.classList.remove('portal-hidden');
    } else {
        if (portalShell) portalShell.classList.remove('portal-hidden');
        if (authWrapper) authWrapper.classList.add('portal-hidden');
        // Met en evidence l'item de navigation actif dans la barre laterale
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navMap = { pagePrincipale: 'navAccueil', pageProfil: 'navProfil', pageChat: 'navChat' };
        const navId = navMap[identifiantPage];
        if (navId) document.getElementById(navId)?.classList.add('active');
    }
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
    document.querySelectorAll('#boutonTheme i, #boutonThemeProfil i, #boutonThemeChat i').forEach(icone => {
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
        const cible = document.querySelector('.page.active') || document.body;
        cible.prepend(zoneErreur);
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
    const zone = document.getElementById('affichageNomUtilisateur');
    if (zone) {
        // Reconstruction via DOM pour eviter une injection XSS via le nom utilisateur.
        zone.innerHTML = '';
        const icone = document.createElement('i');
        icone.className = 'fas fa-user-circle';
        const span = document.createElement('span');
        span.textContent = utilisateurCourant.nom;
        zone.appendChild(icone);
        zone.appendChild(document.createTextNode(' '));
        zone.appendChild(span);
    }
}

/**
 * Deconnecte l'utilisateur et reinitialise l'interface.
 * Le JWT est stateless : la deconnexion est uniquement locale (suppression localStorage).
 */
function deconnecterUtilisateur() {
    // Révocation du cookie httpOnly côté serveur (fire-and-forget)
    fetchWithTimeout(`${URL_API}/auth/logout`, { method: 'POST' }).catch(() => {});
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

    // Remise a zero du chat IA
    historiqueChat = [];
    chargementChat = false;
    const zoneChat = document.getElementById('chatMessages');
    if (zoneChat) zoneChat.innerHTML = '';
    const actionsRapides = document.getElementById('chatActionsRapides');
    if (actionsRapides) actionsRapides.style.display = '';

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
    if (motDePasse.length < 12) {
        afficherErreur('Le mot de passe doit contenir au moins 12 caracteres');
        return;
    }
    if (!/[A-Z]/.test(motDePasse)) {
        afficherErreur('Le mot de passe doit contenir au moins une majuscule');
        return;
    }
    if (!/[a-z]/.test(motDePasse)) {
        afficherErreur('Le mot de passe doit contenir au moins une minuscule');
        return;
    }
    if (!/[0-9]/.test(motDePasse)) {
        afficherErreur('Le mot de passe doit contenir au moins un chiffre');
        return;
    }

    const btn = document.getElementById('btnInscription');
    if (btn) { btn.disabled = true; btn.textContent = 'Création en cours…'; }

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, email, mot_de_passe: motDePasse })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de l\'inscription');

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
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte'; }
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

    const btn = document.getElementById('btnConnexion');
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion en cours…'; }

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, mot_de_passe: motDePasse })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Email ou mot de passe incorrect');

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
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter'; }
    }
}

// ─────────────────────────────────────────────
// AUTHENTIFICATION GOOGLE OAUTH
// ─────────────────────────────────────────────

/**
 * Lance le flux OAuth 2.0 Google en redirigeant vers le backend.
 */
function connexionGoogle() {
    window.location.href = `${URL_API}/auth/google`;
}

/**
 * Detecte et traite un retour du flux OAuth Google.
 * Succes : backend pose le cookie httpOnly et redirige avec ?google_ok=1
 * Erreur : backend redirige avec ?google_error=... (query string)
 */
async function traiterRetourGoogle() {
    const paramsQuery = new URLSearchParams(window.location.search);
    const googleOk = paramsQuery.get('google_ok');
    const googleError = paramsQuery.get('google_error');

    if (!googleOk && !googleError) return false;

    // Nettoyage de l'URL pour eviter de retraiter au rechargement
    window.history.replaceState({}, '', window.location.pathname);

    if (googleError) {
        const messages = {
            non_configure: 'La connexion Google n\'est pas configuree sur le serveur.',
            acces_refuse: 'Connexion Google annulee.',
            token_invalide: 'Erreur lors de l\'authentification Google.',
            profil_inaccessible: 'Impossible de recuperer votre profil Google.',
            csrf_invalide: 'Requete de connexion invalide. Veuillez reessayer.',
        };
        afficherErreur(messages[googleError] || 'Connexion Google echouee.');
        afficherPage('pageConnexion');
        return true;
    }

    // Le cookie httpOnly a ete pose par le backend — recuperer le profil via l'API
    try {
        const reponseProfile = await fetchWithTimeout(`${URL_API}/auth/profile`);
        if (!reponseProfile.ok) throw new Error('Profil inaccessible');
        const profil = await reponseProfile.json();
        const utilisateur = {
            id: profil.id || '',
            nom: profil.nom || 'Utilisateur',
            email: profil.email || '',
            favorites: [],
        };
        localStorage.setItem('user', JSON.stringify(utilisateur));
        utilisateurCourant = utilisateur;
    } catch (_) {
        // Fallback minimal si le profil est temporairement indisponible
        const utilisateur = { id: '', nom: 'Utilisateur', email: '', favorites: [] };
        localStorage.setItem('user', JSON.stringify(utilisateur));
        utilisateurCourant = utilisateur;
    }

    mettreAJourAffichageUtilisateur();
    await chargerFavoris();
    chargerCitationDuJour();
    afficherPage('pagePrincipale');
    return true;
}

/**
 * Verifie la session en cours via le cookie httpOnly.
 * Appelle GET /api/auth/profile — le cookie est envoye automatiquement.
 * Fallback hors-ligne : restaure l'utilisateur depuis localStorage si le serveur est inaccessible.
 */
async function verifierSessionExistante() {
    const utilisateurSauvegarde = localStorage.getItem('user');

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/profile`);

        if (!reponse.ok) {
            localStorage.removeItem('user');
            afficherPage('pageConnexion');
            return;
        }

        const profil = await reponse.json();
        utilisateurCourant = {
            id: profil.id || '',
            nom: profil.nom || 'Utilisateur',
            email: profil.email || '',
            favorites: [],
        };
        localStorage.setItem('user', JSON.stringify(utilisateurCourant));
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        chargerCitationDuJour();
        afficherPage('pagePrincipale');

    } catch {
        // Serveur inaccessible : restauration depuis le cache local
        if (utilisateurSauvegarde) {
            try {
                utilisateurCourant = JSON.parse(utilisateurSauvegarde);
                mettreAJourAffichageUtilisateur();
                await chargerFavoris();
                chargerCitationDuJour();
                afficherPage('pagePrincipale');
            } catch {
                afficherPage('pageConnexion');
            }
        } else {
            afficherPage('pageConnexion');
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
    if (!utilisateurCourant) return;

    const container = document.getElementById('citationDuJour');
    if (!container) return;

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/daily`);

        if (!reponse.ok) return;

        const citation = await reponse.json();
        // Construction via DOM pour eviter une injection XSS via les donnees de l'API.
        container.innerHTML = '';
        const spanTexte = document.createElement('span');
        spanTexte.className = 'daily-text';
        spanTexte.textContent = `"${citation.text}"`;
        const spanAuteur = document.createElement('span');
        spanAuteur.className = 'daily-author';
        spanAuteur.textContent = ` \u2014 ${citation.author}`;
        container.appendChild(spanTexte);
        container.appendChild(spanAuteur);
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
    if (!utilisateurCourant) {
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

        const reponse = await fetchWithTimeout(url);

        if (!reponse.ok) {
            if (reponse.status === 401) {
                deconnecterUtilisateur();
                throw new Error('Session expiree, veuillez vous reconnecter');
            }
            throw new Error('Erreur lors du chargement de la citation');
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

    const bouton = document.getElementById('boutonTraduire');
    const texteOriginal = bouton.innerHTML;

    bouton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduction...';
    bouton.disabled = true;

    try {
        // MyMemory limite les requetes a 500 caracteres
        const texteATradure = citationCourante.text.slice(0, 500);
        if (citationCourante.text.length > 500) {
            afficherErreur('Citation trop longue pour la traduction (tronquee a 500 caracteres)');
        }
        const params = new URLSearchParams({
            texte: texteATradure,
            langue_source: 'en'
        });

        const reponse = await fetchWithTimeout(`${URL_API}/quotes/translate?${params}`);

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

    const bouton = document.getElementById('boutonAjouterFavori');
    const texteOriginal = bouton.innerHTML;

    bouton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';
    bouton.disabled = true;

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/favorites/${citationCourante.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/favorites/${identifiantCitation}`, {
            method: 'DELETE',
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

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/favorites/${quoteId}/note`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
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
 * Ouvre une invite pour modifier le tag personnalise sur un favori.
 * Envoie un PATCH /api/quotes/favorites/{id}/tag avec le nouveau tag.
 */
async function modifierTagFavori(quoteId, tagActuel) {
    const nouveauTag = prompt('Tag personnalise (laissez vide pour supprimer) :', tagActuel || '');
    if (nouveauTag === null) return; // Annule par l'utilisateur

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/favorites/${quoteId}/tag`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: nouveauTag })
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur lors de la modification du tag');

        afficherSucces(nouveauTag ? 'Tag enregistre' : 'Tag supprime');
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
    if (!utilisateurCourant) return;

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/quotes/favorites`);

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
        const contenu = `${citation.text} ${citation.author} ${citation.category || ''} ${citation.tag || ''}`.toLowerCase();
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

        // Affichage du tag si il existe
        const elemTag = clone.querySelector('.favorite-tag');
        if (citation.tag) {
            elemTag.textContent = `# ${citation.tag}`;
            elemTag.classList.remove('hidden');
        }

        // Bouton modifier la note
        clone.querySelector('.edit-note').onclick = () =>
            modifierNoteFavori(citation.id, citation.note || '');

        // Bouton modifier le tag
        clone.querySelector('.edit-tag').onclick = () =>
            modifierTagFavori(citation.id, citation.tag || '');

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
    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/profile`);

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

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
    if (nouveauMotDePasse.length < 12) {
        afficherErreur('Le nouveau mot de passe doit contenir au moins 12 caracteres');
        return;
    }
    if (!/[A-Z]/.test(nouveauMotDePasse) || !/[a-z]/.test(nouveauMotDePasse) || !/[0-9]/.test(nouveauMotDePasse)) {
        afficherErreur('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre');
        return;
    }
    if (nouveauMotDePasse !== confirmationMotDePasse) {
        afficherErreur('Les deux nouveaux mots de passe ne correspondent pas');
        return;
    }

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/auth/profile/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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

    // Clic sur le compte demo : remplissage automatique des champs.
    // IMPORTANT : ce bloc est reserve au developpement local.
    // Supprimer l'element #infoDemoCompte du HTML avant tout deploiement en production.
    document.getElementById('infoDemoCompte')?.addEventListener('click', () => {
        document.getElementById('courrielConnexion').value = 'demo@test.com';
        document.getElementById('motDePasseConnexion').value = 'demo123';
    });

    // Recherche en temps reel dans les favoris
    document.getElementById('champRechercheFavoris')?.addEventListener('input', (ev) => {
        rechercheFavoris = ev.target.value;
        paginationFavoris.page = 1; // Retour a la premiere page a chaque nouvelle recherche
        afficherFavoris();
    });

    // Auto-resize du textarea du chat
    document.getElementById('chatSaisie')?.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
});

// ─────────────────────────────────────────────
// CHAT IA
// ─────────────────────────────────────────────

/** Message de bienvenue affiché au chargement */
const MESSAGE_BIENVENUE_CHAT = "Bonjour ! Je suis votre assistant littéraire. Posez-moi des questions sur vos citations favorites, demandez-moi d'expliquer une citation, ou explorons ensemble un thème philosophique.";

/**
 * Affiche la page chat et initialise la conversation si vide.
 */
function afficherPageChat() {
    afficherPage('pageChat');
    const zone = document.getElementById('chatMessages');
    if (zone && zone.children.length === 0) {
        ajouterBulleChat('assistant', MESSAGE_BIENVENUE_CHAT, false);
    }
    // Synchronise l'icone theme
    const theme = localStorage.getItem('theme') || 'light';
    const icone = document.querySelector('#boutonThemeChat i');
    if (icone) icone.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

/**
 * Remet la conversation a zero.
 */
function reinitialiserChat() {
    historiqueChat = [];
    chargementChat = false;
    const zone = document.getElementById('chatMessages');
    if (zone) zone.innerHTML = '';
    ajouterBulleChat('assistant', MESSAGE_BIENVENUE_CHAT, false);
    document.getElementById('chatActionsRapides').style.display = '';
    document.getElementById('chatSaisie').value = '';
}

/**
 * Ajoute une bulle de message dans la zone de chat.
 * @param {'user'|'assistant'} role
 * @param {string} contenu
 * @param {boolean} erreur
 */
function ajouterBulleChat(role, contenu, erreur) {
    const zone = document.getElementById('chatMessages');
    if (!zone) return;

    const wrap = document.createElement('div');
    wrap.className = `chat-bulle-wrap chat-bulle-${role}`;

    if (role === 'assistant') {
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        wrap.appendChild(avatar);
    }

    const bulle = document.createElement('div');
    bulle.className = `chat-bulle chat-bulle-contenu-${role}${erreur ? ' chat-bulle-erreur' : ''}`;
    // Utilise textContent pour eviter XSS
    bulle.textContent = contenu;
    wrap.appendChild(bulle);

    zone.appendChild(wrap);
    zone.scrollTop = zone.scrollHeight;
}

/**
 * Gestion de l'indicateur "en train d'ecrire".
 */
function afficherIndicateurFrappe(afficher) {
    const existant = document.getElementById('chatFrappe');
    if (afficher) {
        if (existant) return;
        const zone = document.getElementById('chatMessages');
        const frappe = document.createElement('div');
        frappe.id = 'chatFrappe';
        frappe.className = 'chat-bulle-wrap chat-bulle-assistant';
        frappe.innerHTML = `
            <div class="chat-avatar"><i class="fas fa-robot"></i></div>
            <div class="chat-frappe">
                <span></span><span></span><span></span>
            </div>
        `;
        zone.appendChild(frappe);
        zone.scrollTop = zone.scrollHeight;
    } else {
        existant?.remove();
    }
}

/**
 * Envoie le message saisi par l'utilisateur au chatbot IA.
 */
async function envoyerMessageChat() {
    const saisie = document.getElementById('chatSaisie');
    const contenu = saisie.value.trim();
    if (!contenu || chargementChat) return;

    if (!utilisateurCourant) { afficherErreur('Vous devez être connecté.'); return; }

    // Masquer actions rapides des le premier echange
    document.getElementById('chatActionsRapides').style.display = 'none';

    ajouterBulleChat('user', contenu, false);
    historiqueChat.push({ role: 'user', content: contenu });
    if (historiqueChat.length > 40) historiqueChat = historiqueChat.slice(-40);
    saisie.value = '';
    saisie.style.height = 'auto';

    chargementChat = true;
    afficherIndicateurFrappe(true);

    try {
        const reponse = await fetchWithTimeout(`${URL_API}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: contenu,
                historique: historiqueChat.slice(-19, -1),
            }),
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur IA');

        afficherIndicateurFrappe(false);
        ajouterBulleChat('assistant', donnees.reponse, false);
        historiqueChat.push({ role: 'assistant', content: donnees.reponse });

    } catch (err) {
        afficherIndicateurFrappe(false);
        ajouterBulleChat('assistant', `Désolé, une erreur est survenue : ${err.message}`, true);
    } finally {
        chargementChat = false;
    }
}

/**
 * Envoie via Entree (sans Shift).
 */
function chatKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        envoyerMessageChat();
    }
}

/**
 * Declenche une action rapide (recommendation ou analyse).
 * @param {'analyze'|'recommend'} type
 * @param {string} label  Texte affiche comme message utilisateur
 * @param {string|null} humeur  Param pour /recommend
 */
async function actionRapideChat(type, label, humeur) {
    if (chargementChat) return;

    if (!utilisateurCourant) { afficherErreur('Vous devez être connecté.'); return; }

    document.getElementById('chatActionsRapides').style.display = 'none';
    ajouterBulleChat('user', label, false);
    chargementChat = true;
    afficherIndicateurFrappe(true);

    try {
        const url = type === 'analyze' ? `${URL_API}/ai/analyze` : `${URL_API}/ai/recommend`;
        const body = type === 'analyze' ? '{}' : JSON.stringify({ humeur });

        const reponse = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.detail || 'Erreur IA');

        afficherIndicateurFrappe(false);
        ajouterBulleChat('assistant', donnees.reponse, false);

    } catch (err) {
        afficherIndicateurFrappe(false);
        ajouterBulleChat('assistant', `Désolé, une erreur est survenue : ${err.message}`, true);
    } finally {
        chargementChat = false;
    }
}

/* ============================================================
   MOT DE PASSE OUBLIE
   ============================================================ */

let _resetTimerInterval = null;
let _resetEmailCourant  = '';

function afficherPageMotDePasseOublie() {
    _resetEmailCourant = '';
    clearInterval(_resetTimerInterval);
    _resetTimerInterval = null;

    const emailInput = document.getElementById('resetEmail');
    if (emailInput) emailInput.value = '';

    passerEtapeReset(1);
    afficherPage('pageMotDePasseOublie');
}

function passerEtapeReset(n) {
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById('resetEtape' + i);
        if (el) el.classList.toggle('hidden', i !== n);
    }
    _majIndicateursEtapes(n);
}

function _majIndicateursEtapes(etapeActive) {
    for (let i = 1; i <= 3; i++) {
        const ind = document.getElementById('resetStep' + i + 'Indicator');
        if (!ind) continue;
        ind.classList.remove('reset-step-active', 'reset-step-done');
        if (i < etapeActive)        ind.classList.add('reset-step-done');
        else if (i === etapeActive)  ind.classList.add('reset-step-active');
    }
    const line1 = document.getElementById('resetStepLine');
    const line2 = document.getElementById('resetStepLine2');
    if (line1) {
        line1.classList.toggle('done',   etapeActive > 2);
        line1.classList.toggle('active', etapeActive === 2);
    }
    if (line2) {
        line2.classList.toggle('done',   etapeActive > 3);
        line2.classList.toggle('active', etapeActive === 3);
    }
}

function _afficherErreurReset(el, msg) {
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.classList.remove('hidden');
    } else {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

async function demanderCodeReset() {
    // Étape 1 : email vient du champ ; étape 2 (renvoi) : email déjà mémorisé
    const emailInput = document.getElementById('resetEmail');
    const errEl      = document.getElementById('resetEmailErreur');
    const email      = _resetEmailCourant || (emailInput ? emailInput.value.trim().toLowerCase() : '');

    _afficherErreurReset(errEl, '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        _afficherErreurReset(errEl, 'Veuillez entrer une adresse email valide.');
        return;
    }

    // Bouton actif selon l'étape courante
    const btnEnvoyer  = document.getElementById('btnDemanderCode');
    const btnRenvoyer = document.getElementById('btnRenvoyer');
    const estRenvoi   = !!_resetEmailCourant;
    const btnActif    = estRenvoi ? btnRenvoyer : btnEnvoyer;
    if (btnActif) { btnActif.disabled = true; btnActif.textContent = 'Envoi...'; }

    try {
        const rep = await fetchWithTimeout(URL_API + '/auth/password-reset/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!rep.ok) {
            const data = await rep.json().catch(() => ({}));
            const msg = data.detail || 'Impossible d\'envoyer le code.';
            const errCible = estRenvoi ? document.getElementById('resetMdpErreur') : errEl;
            _afficherErreurReset(errCible, msg);
            return;
        }

        _resetEmailCourant = email;

        // Mettre à jour l'affichage email confirmé sans écraser le lien "Modifier"
        const emailAffiche = document.getElementById('resetEmailAffiche');
        if (emailAffiche) emailAffiche.textContent = email;

        if (!estRenvoi) {
            passerEtapeReset(2);
        }
        _demarrerTimerRenvoi();

    } catch (err) {
        const errCible = estRenvoi ? document.getElementById('resetMdpErreur') : errEl;
        _afficherErreurReset(errCible, 'Erreur réseau. Réessayez.');
    } finally {
        if (btnEnvoyer) {
            btnEnvoyer.disabled = false;
            btnEnvoyer.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le code';
        }
    }
}

function _demarrerTimerRenvoi() {
    const btn = document.getElementById('btnRenvoyer');
    if (!btn) return;
    btn.disabled = true;
    let secondes = 60;
    btn.textContent = 'Renvoyer (' + secondes + 's)';
    clearInterval(_resetTimerInterval);
    _resetTimerInterval = setInterval(function() {
        secondes--;
        if (secondes <= 0) {
            clearInterval(_resetTimerInterval);
            _resetTimerInterval = null;
            btn.disabled = false;
            btn.textContent = 'Renvoyer';
        } else {
            btn.textContent = 'Renvoyer (' + secondes + 's)';
        }
    }, 1000);
}

function verifierCodeComplet() {
    const input = document.getElementById('resetCode');
    const hint  = document.getElementById('codeValideHint');
    if (!input || !hint) return;
    const val = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = val;
    hint.classList.toggle('hidden', val.length !== 6);
}

function majForceMdp() {
    const mdp = (document.getElementById('resetNouveauMdp') || {}).value || '';
    const container = document.getElementById('forceMdpContainer');
    if (!container) return;
    container.classList.toggle('hidden', mdp.length === 0);
    if (mdp.length === 0) return;

    const regles = {
        longueur:  mdp.length >= 12,
        majuscule: /[A-Z]/.test(mdp),
        minuscule: /[a-z]/.test(mdp),
        chiffre:   /\d/.test(mdp),
    };
    const score = Object.values(regles).filter(Boolean).length;

    const couleurs = ['#ef4444', '#f97316', '#eab308', '#10b981'];
    const labels   = ['Faible', 'Moyen', 'Bien', 'Fort'];
    const couleur  = couleurs[score - 1] || '#ef4444';

    for (let i = 1; i <= 4; i++) {
        const barre = document.getElementById('forceBarre' + i);
        if (barre) barre.style.background = i <= score ? couleur : '';
    }
    const label = document.getElementById('forceLabel');
    if (label) { label.textContent = labels[score - 1] || ''; label.style.color = couleur; }

    const ids = { longueur: 'regleLongueur', majuscule: 'regleMajuscule', minuscule: 'regleMinuscule', chiffre: 'regleChiffre' };
    for (const k in ids) {
        const li = document.getElementById(ids[k]);
        if (!li) continue;
        li.classList.toggle('force-regle-ok', regles[k]);
        const ic = li.querySelector('i');
        if (ic) ic.className = regles[k] ? 'fas fa-check-circle' : 'fas fa-circle';
    }

    verifierCorrespondance();
}

function verifierCorrespondance() {
    const mdp     = (document.getElementById('resetNouveauMdp') || {}).value    || '';
    const confirm = (document.getElementById('resetConfirmMdp') || {}).value || '';
    const errEl   = document.getElementById('erreurMatch');
    if (!errEl) return;
    if (confirm.length === 0) { errEl.classList.add('hidden'); return; }
    errEl.classList.toggle('hidden', mdp === confirm);
}

async function reinitialiserMotDePasse() {
    const code    = ((document.getElementById('resetCode') || {}).value || '').trim();
    const mdp     = (document.getElementById('resetNouveauMdp') || {}).value    || '';
    const confirm = (document.getElementById('resetConfirmMdp') || {}).value || '';
    const errEl   = document.getElementById('resetMdpErreur');

    _afficherErreurReset(errEl, '');

    if (code.length !== 6) {
        _afficherErreurReset(errEl, 'Le code doit contenir 6 chiffres.');
        return;
    }
    if (mdp.length < 12 || !/[A-Z]/.test(mdp) || !/[a-z]/.test(mdp) || !/\d/.test(mdp)) {
        _afficherErreurReset(errEl, 'Le mot de passe ne respecte pas les critères requis.');
        return;
    }
    if (mdp !== confirm) {
        _afficherErreurReset(errEl, 'Les mots de passe ne correspondent pas.');
        return;
    }

    const btn = document.getElementById('btnReinitialiser');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...'; }

    try {
        const rep = await fetchWithTimeout(URL_API + '/auth/password-reset/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: _resetEmailCourant, code: code, nouveau_mot_de_passe: mdp })
        });
        const data = await rep.json();
        if (!rep.ok) throw new Error(data.detail || 'Code invalide ou expiré.');

        clearInterval(_resetTimerInterval);
        _resetTimerInterval = null;
        passerEtapeReset(3);

    } catch (err) {
        _afficherErreurReset(errEl, err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-key"></i> Réinitialiser le mot de passe'; }
    }
}

function resetRetourEtape1() {
    clearInterval(_resetTimerInterval);
    _resetTimerInterval = null;

    // Pré-remplir l'email pour que l'utilisateur n'ait pas à le retaper
    const emailInput = document.getElementById('resetEmail');
    if (emailInput) emailInput.value = _resetEmailCourant;
    _resetEmailCourant = '';

    ['resetCode','resetNouveauMdp','resetConfirmMdp'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['resetEmailErreur','resetMdpErreur'].forEach(function(id) {
        _afficherErreurReset(document.getElementById(id), '');
    });
    const codeHint = document.getElementById('codeValideHint');
    if (codeHint) codeHint.classList.add('hidden');
    const errMatch = document.getElementById('erreurMatch');
    if (errMatch) errMatch.classList.add('hidden');
    const forceC = document.getElementById('forceMdpContainer');
    if (forceC) forceC.classList.add('hidden');

    passerEtapeReset(1);
}
