/**
 * Script principal du frontend QuoteKeeper.
 *
 * Ce fichier gere :
 * - la navigation entre les pages
 * - l'inscription et la connexion
 * - la recuperation de citations
 * - la gestion des favoris
 * - la recherche locale dans les favoris
 * - la copie de citations
 * - l'ajout de citations personnalisees
 */

const URL_API = 'http://localhost:8000/api';

let utilisateurCourant = null;
let citationCourante = null;
let favoris = [];
let rechercheFavoris = '';

function afficherPage(identifiantPage) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(identifiantPage).classList.add('active');
}

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

function afficherSucces(message) {
    console.log('OK:', message);
}

function mettreAJourAffichageUtilisateur() {
    document.getElementById('nomUtilisateur').textContent = utilisateurCourant.nom;
    document.getElementById('affichageNomUtilisateur').innerHTML = `
        <i class="fas fa-user-circle"></i>
        <span>${utilisateurCourant.nom}</span>
    `;
}

function definirCitationCourante(citation) {
    citationCourante = citation;
    document.getElementById('texteCitation').textContent = `"${citation.text}"`;
    document.getElementById('auteurCitation').textContent = `- ${citation.author}`;
    document.getElementById('boutonAjouterFavori').disabled = false;
    document.getElementById('boutonCopierCitation').disabled = false;
}

function construireTexteCopie(citation) {
    return `"${citation.text}" - ${citation.author}`;
}

async function copierTexte(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        afficherSucces('Citation copiee');
    } catch (erreur) {
        afficherErreur('Impossible de copier la citation');
    }
}

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
        if (!reponse.ok) {
            throw new Error(donnees.detail || 'Erreur lors de l\'inscription');
        }

        localStorage.setItem('token', donnees.access_token);
        localStorage.setItem('user', JSON.stringify(donnees.user));

        utilisateurCourant = donnees.user;
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        afficherPage('pagePrincipale');
        afficherSucces('Inscription reussie');

        document.getElementById('nomInscription').value = '';
        document.getElementById('courrielInscription').value = '';
        document.getElementById('motDePasseInscription').value = '';
    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

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
        if (!reponse.ok) {
            throw new Error(donnees.detail || 'Email ou mot de passe incorrect');
        }

        localStorage.setItem('token', donnees.access_token);
        localStorage.setItem('user', JSON.stringify(donnees.user));

        utilisateurCourant = donnees.user;
        mettreAJourAffichageUtilisateur();
        await chargerFavoris();
        afficherPage('pagePrincipale');
        afficherSucces('Connexion reussie');

        document.getElementById('courrielConnexion').value = '';
        document.getElementById('motDePasseConnexion').value = '';
    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

function deconnecterUtilisateur() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    utilisateurCourant = null;
    citationCourante = null;
    favoris = [];
    rechercheFavoris = '';

    document.getElementById('texteCitation').textContent = 'Cliquez sur "Nouvelle citation" pour commencer';
    document.getElementById('auteurCitation').textContent = '';
    document.getElementById('boutonAjouterFavori').disabled = true;
    document.getElementById('boutonCopierCitation').disabled = true;
    document.getElementById('compteurFavoris').textContent = '0';
    document.getElementById('champRechercheFavoris').value = '';
    document.getElementById('listeFavoris').innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            Connectez-vous pour voir vos favoris
        </div>
    `;

    afficherPage('pageConnexion');
    afficherSucces('Deconnexion reussie');
}

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
        const reponse = await fetch(`${URL_API}/quotes/random`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

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

    afficherSucces('Citation personnalisee prete a etre ajoutee aux favoris');
}

async function copierCitationCourante() {
    if (!citationCourante) {
        afficherErreur('Aucune citation a copier');
        return;
    }

    await copierTexte(construireTexteCopie(citationCourante));
}

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
        if (!reponse.ok) {
            throw new Error(donnees.detail || 'Erreur lors de l\'ajout aux favoris');
        }

        afficherSucces(donnees.message || 'Citation ajoutee aux favoris');
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

async function retirerCitationDesFavoris(identifiantCitation) {
    const jeton = localStorage.getItem('token');

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites/${identifiantCitation}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${jeton}` }
        });

        const donnees = await reponse.json();
        if (!reponse.ok) {
            throw new Error(donnees.detail || 'Erreur lors du retrait des favoris');
        }

        afficherSucces(donnees.message || 'Citation retiree des favoris');
        await chargerFavoris();
    } catch (erreur) {
        afficherErreur(erreur.message);
    }
}

async function chargerFavoris() {
    const jeton = localStorage.getItem('token');
    if (!jeton) {
        return;
    }

    try {
        const reponse = await fetch(`${URL_API}/quotes/favorites`, {
            headers: { Authorization: `Bearer ${jeton}` }
        });

        if (!reponse.ok) {
            throw new Error('Erreur lors du chargement des favoris');
        }

        const donnees = await reponse.json();
        const detailsParIdentifiant = new Map(
            (donnees.favorite_quotes || []).map(citation => [citation.id, citation])
        );

        favoris = (donnees.favorites || []).map(identifiantCitation => {
            return detailsParIdentifiant.get(identifiantCitation) || {
                id: identifiantCitation,
                text: `Citation #${identifiantCitation}`,
                author: 'Details non disponibles'
            };
        });

        document.getElementById('compteurFavoris').textContent = favoris.length;
        afficherFavoris();
    } catch (erreur) {
        console.error('Erreur chargement favoris:', erreur);
        document.getElementById('listeFavoris').innerHTML = `
            <div class="error-message">
                Erreur lors du chargement des favoris
            </div>
        `;
    }
}

function filtrerFavoris() {
    const requete = rechercheFavoris.trim().toLowerCase();
    if (!requete) {
        return favoris;
    }

    return favoris.filter(citation => {
        const contenu = `${citation.text} ${citation.author} ${citation.category || ''}`.toLowerCase();
        return contenu.includes(requete);
    });
}

function afficherFavoris() {
    const listeFavoris = document.getElementById('listeFavoris');
    const favorisVisibles = filtrerFavoris();

    if (!favoris.length) {
        listeFavoris.innerHTML = `
            <div class="loading-spinner">
                <i class="far fa-heart"></i>
                <p>Aucun favori pour le moment</p>
                <small>Trouvez des citations et ajoutez-les a vos favoris !</small>
            </div>
        `;
        return;
    }

    if (!favorisVisibles.length) {
        listeFavoris.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-search"></i>
                <p>Aucun resultat pour cette recherche</p>
            </div>
        `;
        return;
    }

    const modeleFavori = document.getElementById('modeleFavori');
    listeFavoris.innerHTML = '';

    favorisVisibles.forEach(citation => {
        const clone = modeleFavori.content.cloneNode(true);
        clone.querySelector('.favorite-text').textContent = `"${citation.text}"`;
        clone.querySelector('.favorite-author').textContent = citation.author || 'Auteur inconnu';
        clone.querySelector('.copy-favorite').onclick = () => copierTexte(construireTexteCopie(citation));
        clone.querySelector('.remove-favorite').onclick = () => retirerCitationDesFavoris(citation.id);
        listeFavoris.appendChild(clone);
    });
}

function afficherPageInscription() {
    afficherPage('pageInscription');
}

function afficherPageConnexion() {
    afficherPage('pageConnexion');
}

async function verifierSessionExistante() {
    const jeton = localStorage.getItem('token');
    const utilisateurSauvegarde = localStorage.getItem('user');

    if (jeton && utilisateurSauvegarde) {
        try {
            utilisateurCourant = JSON.parse(utilisateurSauvegarde);
            mettreAJourAffichageUtilisateur();
            await chargerFavoris();
            afficherPage('pagePrincipale');
            return;
        } catch (erreur) {
            console.error('Erreur lors de la restauration de la session:', erreur);
            deconnecterUtilisateur();
            return;
        }
    }

    afficherPage('pageConnexion');
}

document.addEventListener('keypress', (evenement) => {
    if (evenement.key === 'Enter') {
        const pageActive = document.querySelector('.page.active');
        if (pageActive.id === 'pageConnexion') {
            connecterUtilisateur();
        } else if (pageActive.id === 'pageInscription') {
            inscrireUtilisateur();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    verifierSessionExistante();

    document.querySelector('.demo-account code')?.addEventListener('click', () => {
        document.getElementById('courrielConnexion').value = 'demo@test.com';
        document.getElementById('motDePasseConnexion').value = 'demo123';
    });

    document.getElementById('champRechercheFavoris')?.addEventListener('input', (evenement) => {
        rechercheFavoris = evenement.target.value;
        afficherFavoris();
    });
});
