# DEVIS DE PROJET - QuoteKeeper

## 1. Presentation generale

### Nom du projet
QuoteKeeper

### Contexte
QuoteKeeper est une application web developpee dans le cadre du cours `6GEI466 - Applications reseaux et securite informatique`. Le projet vise a demontrer la conception d'un portail web relie a un service web, avec persistance MongoDB et integration d'un service externe.

### Objectif
L'objectif de l'application est de permettre a un utilisateur de consulter des citations, conserver ses citations favorites, rechercher dans sa collection personnelle et ajouter ses propres citations.

### Public cible
- etudiants
- amateurs de citations
- utilisateurs souhaitant conserver rapidement des citations inspirantes

## 2. Description fonctionnelle

### Fonctionnalites principales

- inscription d'un utilisateur (email/mot de passe ou compte Google)
- connexion et deconnexion (email/mot de passe ou Google OAuth 2.0)
- authentification securisee par JWT
- recuperation d'une citation aleatoire avec filtres par categorie et auteur
- citation du jour (meme citation pour tous les utilisateurs dans la journee)
- traduction d'une citation en francais (service interne MyMemory)
- copie rapide de la citation courante dans le presse-papier
- ajout d'une citation aux favoris
- notes personnelles sur les citations favorites
- suppression d'une citation favorite
- consultation de la liste des favoris avec pagination
- recherche dans les favoris (texte, auteur, categorie)
- ajout d'une citation personnalisee
- page de profil (modifier le nom, changer le mot de passe)
- mode sombre / clair persistant (dark mode)

### Fonctionnalites de soutien
- mode demonstration si MongoDB n'est pas disponible
- liste locale de secours si l'API externe ne repond pas
- documentation automatique de l'API avec Swagger et ReDoc
- gestion uniforme des erreurs HTTP (400, 401, 403, 404, 500)
- toast de notification visuel pour les confirmations de succes
- application du theme sombre sans flash au chargement

## 3. Technologies retenues

### Backend
- Python
- FastAPI
- PyMongo
- passlib
- JWT

### Frontend
- HTML
- CSS
- JavaScript
- appels AJAX avec `fetch`

### Base de donnees

- MongoDB
- MongoDB Compass

### Services externes

- API Ninjas Quotes API (citations aleatoires)
- MyMemory Translation API (traduction en francais)
- Google OAuth 2.0 (authentification)

## 4. Architecture generale

L'application suit une architecture separee entre le client web et le service web.

```text
Portail web HTML/CSS/JavaScript
          |
          | requetes HTTP / JSON (AJAX)
          v
Service web FastAPI
     |        |           |
     |        |           +--> Google OAuth 2.0 (authentification)
     |        |
     |        +--> API Ninjas Quotes (citations aleatoires)
     |        +--> MyMemory API      (traduction en francais)
     |
     +--> MongoDB (persistance)
```

Description :

- le frontend affiche l'interface utilisateur et envoie des requetes AJAX au backend
- le backend applique la logique applicative, gere l'authentification et retourne des reponses JSON
- MongoDB assure la persistance des comptes, des favoris et des citations memorisees
- API Ninjas fournit des citations reelles provenant d'un service externe
- MyMemory traduit les citations en francais (service gratuit, sans cle API)
- Google OAuth 2.0 permet la connexion et l'inscription sans mot de passe

## 5. Maquettes des ecrans

### Page de connexion

```text
+-------------------------------------------+
|               QuoteKeeper                 |
|                                           |
|               Connexion                   |
|                                           |
|   Courriel :      [...................]   |
|   Mot de passe :  [...................]   |
|                                           |
|          [ Se connecter ]                 |
|                                           |
|         --------- ou ---------           |
|                                           |
|       [ G  Continuer avec Google ]        |
|                                           |
|  Compte demo : demo@test.com / demo123    |
|  Pas encore de compte ? S'inscrire        |
+-------------------------------------------+
```

### Page d'inscription

```text
+-------------------------------------------+
|               QuoteKeeper                 |
|                                           |
|               Inscription                 |
|                                           |
|   Nom :           [...................]   |
|   Courriel :      [...................]   |
|   Mot de passe :  [...................]   |
|                                           |
|            [ S'inscrire ]                 |
|                                           |
|         --------- ou ---------           |
|                                           |
|       [ G  Continuer avec Google ]        |
|                                           |
|      Deja inscrit ? Se connecter          |
+-------------------------------------------+
```

### Page principale

```text
+------------------------------------------------------------------+
| QuoteKeeper              Utilisateur  [profil] [lune] [logout]   |
+------------------------------------------------------------------+
| [soleil] Citation du jour : "Texte court..." — Auteur            |
+------------------------------------------------------------------+
|                                                                  |
|   "Citation aleatoire affichee ici..."                           |
|                                              - Auteur            |
|   Traduction : "Texte traduit en francais..."                    |
|                                                                  |
| [tag] Categorie v  [user] Auteur...          [x effacer filtres] |
|                                                                  |
| [Nouvelle citation]  [Ajouter aux favoris]                       |
| [Traduire]           [Copier]                                    |
|                                                                  |
| Ajouter ma propre citation                                       |
| Texte: [...]  Auteur: [...]  Categorie: [...]  [Utiliser]        |
|                                                                  |
+------------------------------------------------------------------+
| Mes citations favorites                                  [ 5 ]   |
| Recherche: [.................................................]   |
|                                                                  |
| "Citation..."                    Auteur  [note][copier][retirer] |
|   Note : ma note personnelle                                     |
| "Citation..."                    Auteur  [note][copier][retirer] |
|                                                                  |
|            [ < Prec ]  Page 1 / 2  [ Suiv > ]                   |
+------------------------------------------------------------------+
```

### Page de profil

```text
+------------------------------------------------------------------+
| QuoteKeeper                          [retour] [lune] [logout]    |
+------------------------------------------------------------------+
|                                                                  |
| [carte] Informations du compte                                   |
|   NOM ACTUEL          EMAIL                                      |
|   Jean Dupont         jean@test.com                              |
|                                                                  |
| [crayon] Modifier le nom                                         |
|   Nouveau nom : [Jean Dupont...]                                 |
|   [ Enregistrer le nom ]                                         |
|                                                                  |
| [cle] Changer le mot de passe                                    |
|   Mot de passe actuel : [...]                                    |
|   Nouveau mot de passe : [...]                                   |
|   Confirmer : [...]                                              |
|   [ Changer le mot de passe ]                                    |
+------------------------------------------------------------------+
```

## 6. Description des endpoints

| Methode | URL | Description |
| ------- | --- | ----------- |
| POST | /api/auth/register | Creer un compte utilisateur |
| POST | /api/auth/login | Authentifier un utilisateur |
| POST | /api/auth/logout | Confirmer la deconnexion |
| GET | /api/auth/verify | Verifier la validite d'un token JWT |
| GET | /api/auth/google | Initier le flux OAuth 2.0 Google |
| GET | /api/auth/google/callback | Traiter le retour Google OAuth |
| GET | /api/auth/profile | Obtenir le profil de l'utilisateur |
| PUT | /api/auth/profile | Modifier le nom d'affichage |
| PUT | /api/auth/profile/password | Changer le mot de passe |
| GET | /api/quotes/random | Citation aleatoire (filtres category, author) |
| GET | /api/quotes/daily | Citation du jour (meme pour tous) |
| GET | /api/quotes/translate | Traduire une citation en francais |
| GET | /api/quotes/favorites | Liste des favoris |
| POST | /api/quotes/favorites/{id} | Ajouter une citation aux favoris |
| PATCH | /api/quotes/favorites/{id}/note | Modifier la note sur un favori |
| DELETE | /api/quotes/favorites/{id} | Retirer une citation des favoris |
| GET | /api/health | Verifier la sante du service |
| GET | /api/config | Afficher la configuration non sensible |

### Detail de l'endpoint de traduction

#### GET /api/quotes/translate

Parametres de requete :

- `texte` (obligatoire) : le texte a traduire
- `langue_source` (optionnel, defaut `en`) : code de langue source (ex: `en`, `es`, `de`)

Authentification : Bearer token JWT requis

Exemple de reponse :

```json
{
  "texte_original": "The only way to do great work is to love what you do.",
  "texte_traduit": "La seule façon de faire un excellent travail est d'aimer ce que vous faites.",
  "langue_source": "en",
  "langue_cible": "fr"
}
```

Codes HTTP retournes :

- `200` : traduction reussie
- `400` : texte vide ou manquant
- `401` : token absent ou invalide
- `502` : le service MyMemory n'a pas retourne de resultat valide
- `503` : le service MyMemory est inaccessible

## 7. Flux d'information

### Flux d'inscription (email/mot de passe)

```text
Client Web -> POST /api/auth/register -> FastAPI -> MongoDB
Client Web <- access_token + informations utilisateur
```

### Flux de connexion (email/mot de passe)

```text
Client Web -> POST /api/auth/login -> FastAPI -> MongoDB
Client Web <- access_token + informations utilisateur
```

### Flux de connexion Google OAuth 2.0

```text
Client Web -> GET /api/auth/google -> FastAPI -> Redirection Google
Google     -> GET /api/auth/google/callback?code=... -> FastAPI
FastAPI    -> POST oauth2.googleapis.com/token (echange du code)
FastAPI    -> GET googleapis.com/userinfo (profil utilisateur)
FastAPI    -> MongoDB (creation ou mise a jour de l'utilisateur)
FastAPI    -> Redirection Client Web avec token JWT dans l'URL
Client Web <- token JWT stocke dans localStorage
```

### Flux de citation aleatoire (avec filtres optionnels)

```text
Client Web -> GET /api/quotes/random?category=X&author=Y -> FastAPI -> API Ninjas
Client Web <- citation JSON
(si API Ninjas indisponible : FastAPI retourne une citation locale)
```

### Flux de citation du jour

```text
Client Web -> GET /api/quotes/daily -> FastAPI
FastAPI : si cache valide pour aujourd'hui -> retourne la citation en cache
FastAPI : sinon -> API Ninjas (ou selection deterministe locale)
FastAPI -> mise en cache memoire pour la journee
Client Web <- citation JSON (identique pour tous les utilisateurs)
```

### Flux de note personnelle sur un favori

```text
Client Web -> PATCH /api/quotes/favorites/{id}/note -> FastAPI -> MongoDB
FastAPI : $set favorite_quotes.<id>.note = "texte"
Client Web <- confirmation JSON
```

### Flux de modification du profil

```text
Client Web -> PUT /api/auth/profile -> FastAPI -> MongoDB
FastAPI : verifier JWT, $set nom = "nouveau nom"
Client Web <- confirmation + mise a jour du nom en localStorage
```

### Flux de traduction

```text
Client Web -> GET /api/quotes/translate?texte=... -> FastAPI -> MyMemory API
Client Web <- texte traduit en francais (JSON)
```

### Flux d'ajout aux favoris

```text
Client Web -> POST /api/quotes/favorites/{id} -> FastAPI -> MongoDB
Client Web <- confirmation JSON
```

### Flux de consultation des favoris

```text
Client Web -> GET /api/quotes/favorites -> FastAPI -> MongoDB
Client Web <- liste des favoris + details complets des citations
```

### Flux de secours

```text
Si l'API Ninjas est indisponible :
FastAPI utilise une liste locale de citations afin de maintenir le service
```

## 8. Modele de donnees

### Collection `users`

```json
{
  "_id": "...",
  "nom": "Jean Dupont",
  "email": "jean@test.com",
  "mot_de_passe_hash": "...",
  "google_id": "...",
  "favorites": ["quote_123"],
  "favorite_quotes": {
    "quote_123": {
      "id": "quote_123",
      "text": "Citation...",
      "author": "Auteur",
      "category": "general",
      "note": "Ma note personnelle (optionnel)"
    }
  },
  "cree_le": "...",
  "modifie_le": "..."
}
```

Le champ `google_id` est absent pour les comptes email/mot de passe.
Le champ `mot_de_passe_hash` est `null` pour les comptes Google purs.
Le champ `note` dans `favorite_quotes` est optionnel (absent si aucune note).

### Collection `quotes`

```json
{
  "_id": "...",
  "id": "quote_123",
  "text": "Citation...",
  "author": "Auteur",
  "category": "general",
  "cree_le": "...",
  "modifie_le": "..."
}
```

## 9. Installation et execution

### Configuration requise

Le fichier `backend/.env` doit contenir :

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=quote_keeper
SECRET_KEY=une_cle_secrete
ACCESS_TOKEN_EXPIRE_MINUTES=30
HOST=0.0.0.0
PORT=8000
RELOAD=False
NINJAS_API_KEY=votre_cle_api
```

### Demarrage du backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

### Demarrage du frontend

```powershell
cd frontend
python -m http.server 5500
```

### URLs utiles

- Frontend : `http://localhost:5500`
- API : `http://localhost:8000`
- Swagger UI : `http://localhost:8000/api/docs`
- ReDoc : `http://localhost:8000/api/redoc`
- Verification de sante : `http://localhost:8000/api/health`

## 10. Demonstration de la persistance MongoDB

### Procedure de validation

1. creer un compte utilisateur
2. se connecter
3. recuperer une citation aleatoire
4. ajouter la citation aux favoris
5. ajouter eventuellement une citation personnalisee
6. recharger l'application ou se reconnecter
7. verifier que les favoris sont toujours presents

### Verification dans MongoDB Compass

Ouvrir :
- la base `quote_keeper`
- la collection `users`
- la collection `quotes`

La presence des documents prouve la persistance reelle des donnees.

## 11. Tests manuels effectues

- inscription d'un nouvel utilisateur (email/mot de passe)
- inscription via Google OAuth 2.0
- connexion avec un utilisateur existant
- verification de la session au rechargement (token valide)
- generation d'une citation aleatoire depuis le service externe
- filtrage des citations par categorie et par auteur
- affichage de la citation du jour (bandeau violet)
- traduction d'une citation en francais (MyMemory)
- copie d'une citation dans le presse-papier (toast de confirmation)
- ajout d'une citation aux favoris
- ajout d'une note personnelle sur un favori
- modification et suppression d'une note
- suppression d'une citation favorite
- affichage des favoris apres reconnexion
- navigation par pages dans les favoris (pagination)
- recherche dans les favoris (texte, auteur)
- ajout d'une citation personnalisee
- modification du nom sur la page profil
- changement du mot de passe sur la page profil
- bascule dark mode / light mode (persistance au rechargement)
- verification de la persistance dans MongoDB Compass

## 12. Captures d'ecran a fournir

- page de connexion (mode clair et mode sombre)
- page d'inscription
- page principale avec citation du jour et filtres
- page principale avec citation traduite
- page principale avec plusieurs favoris, notes et pagination
- page de profil
- terminal du backend en fonctionnement
- Swagger UI (nouveaux endpoints)
- ReDoc
- MongoDB Compass avec les collections `users` et `quotes`

## 13. Conformite du projet

### Exigences satisfaites

- service web FastAPI fonctionnel
- portail web HTML/CSS/JS avec appels AJAX
- MongoDB connecte et persistance active
- service externe integre
- authentification JWT
- reponses en JSON
- gestion des favoris
- documentation technique disponible
- flux d'information identifies
- consignes d'installation redigees

### Elements a finaliser pour la remise

- ajouter les captures d'ecran definitives
- appliquer la mise en page finale du document
- relire la coherence visuelle et orthographique du rapport

## 14. Application mobile (labo 4) personnelle 

## 15. Conclusion

QuoteKeeper respecte l'architecture attendue d'une application web moderne separee entre un frontend et un backend. Le projet met en evidence la communication reseau entre le client web, le service FastAPI, MongoDB et trois services externes (API Ninjas, MyMemory, Google OAuth 2.0).

L'application offre une interface complete avec dark mode, citation du jour, filtres de recherche, pagination des favoris, notes personnelles, page de profil et notifications visuelles. Elle illustre des notions importantes de securite (JWT, PBKDF2, OAuth 2.0), d'API REST, de persistance MongoDB et d'integration de services externes, tout en restant fonctionnelle en mode demonstration lorsque MongoDB est indisponible.
