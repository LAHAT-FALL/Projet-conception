# QuoteKeeper

Application web de gestion de citations realisee dans le cadre du cours `6GEI466 - Applications reseaux et securite informatique`.

QuoteKeeper permet a un utilisateur de creer un compte, se connecter, obtenir des citations aleatoires, enregistrer ses citations favorites et conserver ses donnees dans MongoDB. Le projet repose sur une architecture separee entre un portail web en HTML/CSS/JavaScript et un service web en Python avec FastAPI.

## Resume du projet

Le projet est actuellement fonctionnel de bout en bout :
- backend FastAPI operationnel
- frontend HTML/CSS/JavaScript operationnel
- application mobile React Native (Expo SDK 54) operationnelle
- base MongoDB connectee et persistance active
- integration d'un service externe de citations avec API Ninjas
- authentification par jeton JWT
- gestion complete des favoris
- recherche, copie et ajout de citations personnalisees

## Fonctionnalites principales

- inscription d'un utilisateur
- connexion et deconnexion
- authentification par JWT
- recuperation d'une citation aleatoire
- ajout d'une citation aux favoris
- suppression d'une citation favorite
- consultation de la liste des favoris
- recherche dans les favoris par texte, auteur ou categorie
- copie rapide de la citation courante
- ajout d'une citation personnalisee
- mode demonstration si MongoDB est indisponible
- mecanisme de secours si l'API externe ne repond pas

## Technologies utilisees

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

### Service externe
- API Ninjas Quotes API

## Architecture du projet

```text
Navigateur Web
    |
    | requetes AJAX / JSON
    v
Service web FastAPI
    |                |
    |                +--> API Ninjas Quotes
    |
    +--> MongoDB
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
|   |-- App.js
|   |-- app.json
|   |-- package.json
INFO:     127.0.0.1:50726 - "GET / HTTP/1.1" 200 OK
INFO:     127.0.0.1:50742 - "GET /favicon.ico HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:38488 - "OPTIONS /api/auth/login HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "POST /api/auth/login HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "OPTIONS /api/quotes/favorites HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "GET /api/quotes/favorites HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "OPTIONS /api/quotes/daily HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "GET /api/quotes/daily HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "GET /api/quotes/daily HTTP/1.1" 200 OK
INFO:     127.0.0.1:50726 - "GET / HTTP/1.1" 200 OK
INFO:     127.0.0.1:50742 - "GET /favicon.ico HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:38488 - "OPTIONS /api/auth/login HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "POST /api/auth/login HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "OPTIONS /api/quotes/favorites HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "GET /api/quotes/favorites HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "OPTIONS /api/quotes/daily HTTP/1.1" 200 OK
INFO:     127.0.0.1:38488 - "GET /api/quotes/daily HTTP/1.1" 200 OK
|   |-- README.md
|   `-- src/
|       |-- constants/
|       |-- contexts/
|       |-- hooks/
|       |-- navigation/
|       |-- screens/
|       `-- components/
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
```

Remarques :
- `RELOAD=False` est recommande pour une demonstration plus stable.
- ne pas publier de vraies cles secretes dans Git ou dans le rapport.

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

Puis ouvrir :
- `http://localhost:5500`

## Utilisation

### Parcours principal

1. creer un compte
2. se connecter
3. cliquer sur `Nouvelle citation`
4. cliquer sur `Ajouter aux favoris`
5. consulter les favoris

### Fonctionnalites supplementaires

- `Copier` : copie la citation courante dans le presse-papiers
- `Ajouter ma propre citation` : permet d'enregistrer une citation personnalisee
- champ de recherche : filtre les favoris par texte, auteur ou categorie

### Compte de demonstration

Si MongoDB n'est pas disponible, le mode demonstration permet tout de meme de tester l'application :

```text
demo@test.com / demo123
```

## Base de donnees MongoDB

### Base utilisee

- `quote_keeper`

### Collection `users`

Exemple de document :

```json
{
  "_id": "...",
  "nom": "Alice",
  "email": "alice@test.com",
  "mot_de_passe_hash": "...",
  "favorites": ["quote_123"],
  "favorite_quotes": {
    "quote_123": {
      "id": "quote_123",
      "text": "Citation...",
      "author": "Auteur",
      "category": "general"
    }
  },
  "cree_le": "...",
  "modifie_le": "..."
}
```

### Collection `quotes`

Exemple de document :

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

## Endpoints principaux

### Authentification

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Citations

- `GET /api/quotes/random`
- `GET /api/quotes/favorites`
- `POST /api/quotes/favorites/{id}`
- `DELETE /api/quotes/favorites/{id}`

### Service et supervision

- `GET /api/health`
- `GET /api/config`

## Service externe

Le projet utilise `API Ninjas Quotes API` pour obtenir des citations reelles.

Si l'API externe n'est pas accessible, le backend utilise automatiquement une liste locale de secours afin de garder l'application fonctionnelle.

## Tests manuels recommandes

- inscription d'un nouvel utilisateur
- connexion avec un compte existant
- recuperation d'une citation aleatoire
- ajout d'un favori
- suppression d'un favori
- ajout d'une citation personnalisee
- recherche dans les favoris
- verification de la persistance dans MongoDB Compass
- consultation de la documentation Swagger et ReDoc

## Documentation associee

Le fichier [DEVIS.md](/c:/Users/zoodollar/OneDrive/Documents/Projet-conception/DEVIS.md) contient :
- la description du portail
- les maquettes
- les flux d'information
- le modele de donnees
- les consignes d'installation
- la checklist de conformite

## Remarques pour la remise

- le backend et le frontend sont lances separement
- Swagger permet de tester les endpoints
- ReDoc permet de presenter la documentation de l'API
- MongoDB Compass permet de montrer la persistance
- les mots de passe sont haches avant stockage
- certaines URLs et certains champs JSON restent en anglais pour respecter les conventions web usuelles

## Application mobile

L'application mobile React Native reproduit toutes les fonctionnalites du portail web et se connecte au meme backend FastAPI.

Voir [mobile/README.md](mobile/README.md) pour les instructions de lancement.

## Auteur

Projet realise dans le cadre du cours `6GEI466 - Applications reseaux et securite informatique`.
