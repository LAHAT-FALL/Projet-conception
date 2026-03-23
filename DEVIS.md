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
- inscription d'un utilisateur
- connexion et deconnexion
- authentification securisee par JWT
- recuperation d'une citation aleatoire
- ajout d'une citation aux favoris
- suppression d'une citation favorite
- consultation de la liste des favoris
- recherche dans les favoris
- copie rapide de la citation courante
- ajout d'une citation personnalisee

### Fonctionnalites de soutien
- mode demonstration si MongoDB n'est pas disponible
- liste locale de secours si l'API externe ne repond pas
- documentation automatique de l'API avec Swagger et ReDoc

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

### Service externe
- API Ninjas Quotes API

## 4. Architecture generale

L'application suit une architecture separee entre le client web et le service web.

```text
Portail web HTML/CSS/JavaScript
          |
          | requetes HTTP / JSON
          v
Service web FastAPI
     |             |
     |             +--> API Ninjas Quotes
     |
     +--> MongoDB
```

Description :
- le frontend affiche l'interface utilisateur et envoie des requetes AJAX au backend
- le backend applique la logique applicative, gere l'authentification et retourne des reponses JSON
- MongoDB assure la persistance des comptes, des favoris et des citations memorisees
- API Ninjas fournit des citations reelles provenant d'un service externe

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
|      Deja inscrit ? Se connecter          |
+-------------------------------------------+
```

### Page principale

```text
+---------------------------------------------------------------+
| QuoteKeeper                             Utilisateur  Logout   |
+---------------------------------------------------------------+
|                                                               |
|   "Citation aleatoire..."                                     |
|                                          - Auteur             |
|                                                               |
| [Nouvelle citation] [Ajouter aux favoris] [Copier]            |
|                                                               |
| Ajouter ma propre citation                                    |
| Texte: [...................................................]  |
| Auteur: [.............]  Categorie: [.............]          |
| [Utiliser ma citation]                                        |
|                                                               |
+---------------------------------------------------------------+
| Mes citations favorites                              [ 5 ]    |
| Recherche: [..............................................]   |
|                                                               |
| "Citation..."                                  Auteur [X]     |
| "Citation..."                                  Auteur [X]     |
| "Citation..."                                  Auteur [X]     |
+---------------------------------------------------------------+
```

## 6. Description des endpoints

| Methode | URL | Description |
|---------|-----|-------------|
| POST | /api/auth/register | Creer un compte utilisateur |
| POST | /api/auth/login | Authentifier un utilisateur |
| POST | /api/auth/logout | Confirmer la deconnexion |
| GET | /api/quotes/random | Obtenir une citation aleatoire |
| GET | /api/quotes/favorites | Obtenir la liste des favoris |
| POST | /api/quotes/favorites/{id} | Ajouter une citation aux favoris |
| DELETE | /api/quotes/favorites/{id} | Retirer une citation des favoris |
| GET | /api/health | Verifier la sante du service |
| GET | /api/config | Afficher la configuration non sensible |

## 7. Flux d'information

### Flux d'inscription

```text
Client Web -> POST /api/auth/register -> FastAPI -> MongoDB
Client Web <- access_token + informations utilisateur
```

### Flux de connexion

```text
Client Web -> POST /api/auth/login -> FastAPI -> MongoDB
Client Web <- access_token + informations utilisateur
```

### Flux de citation aleatoire

```text
Client Web -> GET /api/quotes/random -> FastAPI -> API Ninjas
Client Web <- citation JSON
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

- inscription d'un nouvel utilisateur
- connexion avec un utilisateur existant
- generation d'une citation aleatoire depuis le service externe
- ajout d'une citation aux favoris
- suppression d'une citation favorite
- affichage des favoris apres reconnexion
- ajout d'une citation personnalisee
- recherche dans les favoris
- verification de la persistance dans MongoDB Compass

## 12. Captures d'ecran a fournir

- page de connexion
- page d'inscription
- page principale avec une citation
- page principale avec plusieurs favoris
- terminal du backend en fonctionnement
- Swagger UI
- ReDoc
- MongoDB Compass avec les collections

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

## 14. Conclusion

QuoteKeeper respecte l'architecture attendue d'une application web moderne separee entre un frontend et un backend. Le projet met en evidence la communication reseau entre le client web, le service FastAPI, MongoDB et un service externe de citations. Il offre egalement une interface simple, fonctionnelle et suffisamment complete pour une demonstration academique, tout en illustrant des notions importantes de securite, d'API web, de persistance et d'integration de services.
