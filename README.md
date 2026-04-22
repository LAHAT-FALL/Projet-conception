# QuoteKeeper

Application web de gestion de citations realisee dans le cadre du cours `6GEI466 - Applications reseaux et securite informatique`.

QuoteKeeper permet a un utilisateur de creer un compte, se connecter, obtenir des citations aleatoires, enregistrer ses citations favorites et conserver ses donnees dans MongoDB. Le projet repose sur une architecture separee entre un portail web en HTML/CSS/JavaScript et un service web en Python avec FastAPI.

## Resume du projet

Le projet est actuellement fonctionnel de bout en bout :
- backend FastAPI operationnel
- frontend HTML/CSS/JavaScript operationnel
- application mobile React Native (Expo SDK 54) operationnelle
- base MongoDB connectee et persistance active
- integration de l'API Ninjas pour les citations aleatoires avec persistance MongoDB
- chatbot culturel propulse par Groq (llama-3.3-70b-versatile)
- authentification par jeton JWT et Google OAuth 2.0
- gestion complete des favoris avec notes personnelles

## Fonctionnalites principales

- inscription d'un utilisateur (email/mot de passe ou Google OAuth 2.0)
- connexion et deconnexion
- authentification securisee par JWT
- recuperation d'une citation aleatoire avec filtres par categorie et auteur
- validation stricte de l'auteur (rejet si l'auteur retourne ne correspond pas)
- citation du jour (meme citation pour toute la journee)
- traduction d'une citation en francais (MyMemory API)
- copie rapide de la citation courante dans le presse-papier
- ajout d'une citation aux favoris
- notes personnelles sur les citations favorites
- suppression d'une citation favorite
- consultation de la liste des favoris avec pagination
- recherche dans les favoris (texte, auteur, categorie)
- ajout d'une citation personnalisee avec choix de categorie
- chatbot culturel (bouton Expliquer + chat flottant) avec injection du contexte de la citation
- explication d'un favori directement depuis la liste des favoris
- page de profil (modifier le nom, changer le mot de passe)
- mode sombre / clair persistant
- persistance MongoDB des citations issues de l'API Ninjas
- liste locale de secours si l'API externe ne repond pas

## Technologies utilisees

### Backend
- Python
- FastAPI
- PyMongo
- passlib
- JWT
- Groq SDK (llama-3.3-70b-versatile)

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
- Groq API (chatbot IA)

## Architecture du projet

```text
Navigateur Web
    |
    | requetes AJAX / JSON
    v
Service web FastAPI
    |         |           |            |
    |         |           |            +--> Groq API (chatbot IA)
    |         |           +--> MyMemory API (traduction)
    |         +--> API Ninjas Quotes (citations)
    |
    +--> MongoDB (persistance utilisateurs, favoris, citations)
```

## Structure du projet

```text
Projet-conception/
|-- backend/
|   |-- app/
|   |   |-- auth.py
|   |   |-- database.py
|   |   |-- demo_store.py
|   |   |-- main.py
|   |   `-- routes/
|   |       |-- auth_routes.py
|   |       |-- chat_routes.py
|   |       |-- google_routes.py
|   |       `-- quotes_routes.py
|   |-- .env
|   |-- requirements.txt
|   `-- run.py
|-- frontend/
|   |-- css/
|   |   `-- style.css
|   |-- js/
|   |   `-- script.js
|   `-- index.html
|-- mobile/
|   |-- app/
|   |-- constants/
|   |-- README.md
|   `-- ...
|-- DEVIS.md
`-- README.md
```

## Prerequis

- Python 3.11 ou plus recent
- MongoDB Community Server
- MongoDB Compass
- un navigateur web
- optionnel : VS Code avec l'extension `Live Server`

## Configuration

Le backend utilise un fichier `backend/.env`.

Exemple de configuration :

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=quote_keeper
SECRET_KEY=remplacer_par_une_cle_secrete_longue
ACCESS_TOKEN_EXPIRE_MINUTES=30
HOST=0.0.0.0
PORT=8000
RELOAD=False
NINJAS_API_KEY=remplacer_par_votre_cle
GROQ_API_KEY=remplacer_par_votre_cle_groq
GOOGLE_CLIENT_ID=remplacer_par_votre_client_id
GOOGLE_CLIENT_SECRET=remplacer_par_votre_client_secret
```

Remarques :
- `RELOAD=False` est recommande pour une demonstration plus stable.
- ne pas publier de vraies cles secretes dans Git.

## Installation

Depuis le dossier `backend` :

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Lancement de l'application

### 1. Demarrer MongoDB

Verifier que MongoDB est actif sur `localhost:27017`.

### 2. Demarrer le backend

Depuis le dossier `backend` :

```powershell
.\venv\Scripts\Activate.ps1
python run.py
```

URLs utiles :
- API : `http://localhost:8000`
- Swagger UI : `http://localhost:8000/api/docs`
- ReDoc : `http://localhost:8000/api/redoc`
- Verification de sante : `http://localhost:8000/api/health`

### 3. Demarrer le frontend

Option 1 avec `Live Server` :
- ouvrir `frontend/index.html`
- choisir `Open with Live Server`

Option 2 avec Python :

```powershell
cd frontend
python -m http.server 5500
```

Puis ouvrir : `http://localhost:5500`

## Utilisation

### Parcours principal

1. creer un compte ou se connecter avec Google
2. cliquer sur `Nouvelle citation`
3. filtrer par categorie ou auteur si souhaite
4. cliquer sur `Ajouter aux favoris`
5. cliquer sur `Expliquer` pour demander une explication au chatbot IA
6. consulter et gerer ses favoris

### Fonctionnalites supplementaires

- `Copier` : copie la citation courante dans le presse-papier
- `Traduire` : traduit la citation en francais
- `Expliquer` : ouvre le chatbot avec la citation en contexte
- `Ajouter ma propre citation` : saisir une citation personnalisee avec categorie
- bouton robot sur chaque favori : demander une explication de ce favori au chatbot
- bouton flottant robot en bas a droite : ouvrir le chat libre

### Compte de demonstration

```text
demo@test.com / demo123
```

## Base de donnees MongoDB

### Base utilisee

`quote_keeper`

### Collection `users`

```json
{
  "_id": "...",
  "nom": "Alice",
  "email": "alice@test.com",
  "mot_de_passe_hash": "...",
  "google_id": "...",
  "favorites": ["quote_123"],
  "favorite_quotes": {
    "quote_123": {
      "id": "quote_123",
      "text": "Citation...",
      "author": "Auteur",
      "category": "inspirational",
      "note": "Ma note personnelle (optionnel)"
    }
  },
  "cree_le": "...",
  "modifie_le": "..."
}
```

### Collection `quotes`

```json
{
  "_id": "...",
  "id": "quote_123",
  "text": "Citation...",
  "author": "Auteur",
  "category": "inspirational",
  "cree_le": "...",
  "modifie_le": "..."
}
```

## Endpoints principaux

### Authentification

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET  /api/auth/verify`
- `GET  /api/auth/google`
- `GET  /api/auth/google/callback`
- `GET  /api/auth/profile`
- `PUT  /api/auth/profile`
- `PUT  /api/auth/profile/password`

### Citations

- `GET  /api/quotes/random`
- `GET  /api/quotes/daily`
- `GET  /api/quotes/translate`
- `GET  /api/quotes/favorites`
- `POST /api/quotes/favorites/{id}`
- `PATCH /api/quotes/favorites/{id}/note`
- `DELETE /api/quotes/favorites/{id}`

### Chatbot

- `POST /api/chat`

### Service et supervision

- `GET /api/health`
- `GET /api/config`

## Tests manuels recommandes

- inscription d'un nouvel utilisateur (email/mot de passe et Google)
- connexion avec un compte existant
- recuperation d'une citation aleatoire avec et sans filtres
- filtre par auteur avec message d'erreur si aucun resultat
- traduction d'une citation en francais
- copie d'une citation dans le presse-papier
- ajout et suppression d'un favori
- ajout d'une note personnelle sur un favori
- ajout d'une citation personnalisee avec categorie
- explication d'une citation via le chatbot (bouton Expliquer)
- explication d'un favori via le bouton robot
- chat libre avec le bot
- bascule dark mode / light mode
- verification de la persistance dans MongoDB Compass
- consultation de la documentation Swagger et ReDoc

## Documentation associee

Le fichier [DEVIS.md](DEVIS.md) contient :
- la description complete du portail
- les maquettes des ecrans
- les flux d'information
- le modele de donnees
- les consignes d'installation
- la checklist de conformite

## Remarques pour la remise

- le backend et le frontend sont lances separement
- Swagger permet de tester les endpoints
- ReDoc permet de presenter la documentation de l'API
- MongoDB Compass permet de montrer la persistance
- les mots de passe sont haches avant stockage (passlib PBKDF2)
- le chatbot necessite une cle GROQ_API_KEY valide dans le `.env`

## Application mobile

L'application mobile React Native reproduit les fonctionnalites principales du portail web et se connecte au meme backend FastAPI.

Voir [mobile/README.md](mobile/README.md) pour les instructions de lancement.

## Auteur

Projet realise dans le cadre du cours `6GEI466 - Applications reseaux et securite informatique`.
