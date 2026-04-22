# RAPPORT DE PROJET — QuoteKeeper

**Cours :** 6GEI466 — Applications réseaux et sécurité informatique
**Session :** Hiver 2026
**Application :** QuoteKeeper — Portail web de gestion de citations

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Architecture générale](#2-architecture-générale)
3. [Service web — Backend FastAPI](#3-service-web--backend-fastapi)
4. [Portail web — Frontend](#4-portail-web--frontend)
5. [Application mobile — React Native](#5-application-mobile--react-native)
6. [Base de données MongoDB](#6-base-de-données-mongodb)
7. [Sécurité](#7-sécurité)
8. [Services externes intégrés](#8-services-externes-intégrés)
9. [Tests et validation](#9-tests-et-validation)
10. [Difficultés rencontrées et solutions](#10-difficultés-rencontrées-et-solutions)
11. [Conclusion](#11-conclusion)

---

## 1. Introduction

### 1.1 Contexte

QuoteKeeper est une application web complète développée dans le cadre du cours 6GEI466. L'objectif du projet est de démontrer la maîtrise de la conception d'un portail web communiquant avec un service web REST, avec persistance de données dans MongoDB et intégration de services externes.

### 1.2 Objectifs de l'application

L'application permet à un utilisateur de :

- créer un compte et s'authentifier (email/mot de passe ou Google OAuth 2.0)
- consulter des citations inspirantes provenant d'un service externe
- filtrer les citations par catégorie et par auteur
- enregistrer ses citations favorites avec des notes personnelles
- traduire une citation en français à la volée
- dialoguer avec un assistant littéraire IA qui connaît ses favoris
- accéder à ses données depuis un navigateur web ou un téléphone mobile

### 1.3 Périmètre du projet

Le projet se compose de trois composantes distinctes :

- un **service web** Python/FastAPI (backend)
- un **portail web** HTML/CSS/JavaScript (frontend)
- une **application mobile** React Native / Expo (mobile)

Les trois composantes partagent le même backend FastAPI et la même base MongoDB.

---

## 2. Architecture générale

### 2.1 Vue d'ensemble

```text
┌────────────────────────┐   ┌──────────────────────────┐
│   Portail Web          │   │  Application Mobile      │
│   HTML / CSS / JS      │   │  React Native (Expo 54)  │
│   (navigateur)         │   │  (Android / iOS)         │
└──────────┬─────────────┘   └────────────┬─────────────┘
           │  AJAX / JSON                 │  fetch / JSON
           │  Bearer JWT                  │  Bearer JWT
           └──────────────┬───────────────┘
                          │
              ┌───────────▼────────────┐
              │   Service Web FastAPI  │
              │   Python 3.11+         │
              │   port 8000            │
              └──┬────┬────┬────┬──────┘
                 │    │    │    │
      ┌──────────┘    │    │    └────────────────┐
      │               │    │                     │
      ▼               ▼    ▼                     ▼
  MongoDB        API Ninjas  MyMemory        Groq API
  (persistance)  (citations) (traduction)   (LLM Llama 3.3)
                                     │
                               Google OAuth 2.0
                               (authentification)
```

### 2.2 Principe de fonctionnement

L'architecture est de type **client–serveur stateless** :

- le frontend et le mobile envoient des requêtes HTTP avec un jeton JWT dans l'en-tête `Authorization: Bearer <token>`
- le backend valide le jeton à chaque requête protégée, sans maintenir de session côté serveur
- toutes les réponses sont au format JSON
- MongoDB assure la persistance des comptes utilisateurs et des favoris
- les services externes sont appelés côté serveur uniquement — les clés API ne sont jamais exposées au client

### 2.3 Séparation des responsabilités

| Composante | Responsabilité |
| ---------- | -------------- |
| Frontend / Mobile | Affichage, interactions utilisateur, appels AJAX |
| FastAPI | Logique métier, authentification, orchestration des services externes |
| MongoDB | Persistance des utilisateurs, favoris, citations |
| API Ninjas | Fourniture de citations réelles |
| MyMemory | Traduction des citations en français |
| Groq (Llama 3.3) | Assistant littéraire IA contextuel |
| Google OAuth 2.0 | Authentification sans mot de passe |

---

## 3. Service web — Backend FastAPI

### 3.1 Technologies utilisées

| Outil | Version | Rôle |
| ----- | ------- | ---- |
| Python | 3.11+ | Langage principal |
| FastAPI | 0.104.1 | Framework API REST |
| Uvicorn | 0.24.0 | Serveur ASGI |
| PyMongo | 4.5.0 | Driver MongoDB |
| PyJWT | ≥ 2.0.0 | Génération et validation des jetons JWT |
| passlib | 1.7.4 | Hachage des mots de passe (PBKDF2-SHA256) |
| python-dotenv | 1.0.0 | Chargement de la configuration |
| requests | 2.31.0 | Appels HTTP vers les API externes |
| google-auth | ≥ 2.0.0 | Validation des tokens Google |

### 3.2 Structure du backend

```text
backend/
├── app/
│   ├── main.py          # Point d'entrée — configuration FastAPI, middlewares, routeurs
│   ├── auth.py          # Hachage PBKDF2, génération et validation JWT
│   ├── database.py      # Connexion MongoDB, mode démonstration
│   ├── demo_store.py    # Magasin en mémoire (secours si MongoDB absent)
│   └── routes/
│       ├── auth_routes.py    # POST register, login, logout ; GET/PUT profile
│       ├── google_routes.py  # GET google, GET google/callback (OAuth 2.0)
│       ├── quotes_routes.py  # GET random, daily, translate ; CRUD favorites
│       ├── ai_routes.py      # POST chat, recommend, analyze (Groq)
│       └── otp_routes.py     # Authentification OTP (extension future)
├── .env                 # Variables d'environnement (non versionné)
├── requirements.txt
└── run.py
```

### 3.3 Configuration et démarrage

Le backend charge sa configuration depuis le fichier `backend/.env` :

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=quote_keeper
SECRET_KEY=<clé aléatoire longue>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
HOST=0.0.0.0
PORT=8000
RELOAD=False
NINJAS_API_KEY=<clé API Ninjas>
GROQ_API_KEY=<clé API Groq>
```

Si `SECRET_KEY` est absente, le serveur refuse de démarrer avec un message explicite. Cette validation précoce empêche tout démarrage avec une configuration incomplète.

### 3.4 Middlewares

Deux middlewares sont appliqués à toutes les requêtes :

**CORS** — autorise les requêtes provenant des origines configurées dans `CORS_ORIGINS` (par défaut `localhost:5500`). Les méthodes et en-têtes HTTP sont tous autorisés pour les origines listées.

**En-têtes de sécurité HTTP** — chaque réponse inclut automatiquement :

- `X-Content-Type-Options: nosniff` — empêche le MIME sniffing
- `X-Frame-Options: DENY` — prévient le clickjacking
- `X-XSS-Protection: 1; mode=block` — filtre XSS côté navigateur
- `Referrer-Policy: strict-origin-when-cross-origin` — limite les informations exposées au référent

### 3.5 Gestion des erreurs

Tous les codes d'erreur HTTP sont interceptés par un gestionnaire global qui retourne une réponse JSON uniforme :

```json
{
  "status": "error",
  "code": 401,
  "message": "Authentification requise",
  "detail": "Token invalide ou expiré",
  "path": "/api/quotes/favorites"
}
```

Les exceptions non gérées sont capturées par un second gestionnaire qui ne divulgue jamais le détail interne au client.

### 3.6 Endpoints REST

#### Authentification — `/api/auth`

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| POST | /register | Créer un compte (nom, email, mot de passe) |
| POST | /login | Connexion — retourne un token JWT |
| POST | /logout | Confirmation symbolique de déconnexion |
| GET | /verify | Vérifier la validité d'un token JWT |
| GET | /google | Redirection vers Google pour OAuth 2.0 |
| GET | /google/callback | Traitement du retour Google OAuth |
| GET | /profile | Profil de l'utilisateur connecté |
| PUT | /profile | Modifier le nom d'affichage |
| PUT | /profile/password | Changer le mot de passe |

#### Citations — `/api/quotes`

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | /random | Citation aléatoire (filtres `category`, `author`) |
| GET | /daily | Citation du jour (même pour tous les utilisateurs) |
| GET | /translate | Traduire une citation en français |
| GET | /favorites | Liste des favoris de l'utilisateur |
| POST | /favorites/{id} | Ajouter une citation aux favoris |
| PATCH | /favorites/{id}/note | Modifier la note personnelle d'un favori |
| DELETE | /favorites/{id} | Retirer une citation des favoris |

#### Assistant IA — `/api/ai`

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| POST | /chat | Envoyer un message à l'assistant |
| POST | /recommend | Recommandations selon l'humeur décrite |
| POST | /analyze | Analyse philosophique des citations favorites |

#### Supervision

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | /api/health | État du service et de la connexion MongoDB |
| GET | /api/config | Configuration non sensible |

### 3.7 Mode démonstration

Si MongoDB est inaccessible au démarrage, le backend bascule en mode démonstration. Un magasin en mémoire (`demo_store.py`) simule toutes les opérations CRUD, ce qui permet de tester l'application même sans base de données active.

Le compte de démonstration est `demo@test.com / demo123`. Les données saisies en mode démonstration ne sont pas persistées et sont perdues au redémarrage.

### 3.8 Citation du jour

La citation du jour est mise en cache en mémoire avec sa date. Tant que la date du jour ne change pas, la même citation est retournée à tous les utilisateurs. Ce cache est réinitialisé à chaque redémarrage du serveur. Son identifiant est déterministe : il repose sur un hachage SHA-256 de la date du jour, ce qui garantit une sélection reproductible même après redémarrage.

---

## 4. Portail web — Frontend

### 4.1 Technologies utilisées

| Outil | Usage |
| ----- | ----- |
| HTML5 | Structure des pages (SPA) |
| CSS3 | Design system indigo, portail avec sidebar fixe |
| JavaScript (ES6+) | Logique SPA, appels `fetch`, gestion d'état |
| Font Awesome 6 | Icônes |
| Poppins (Google Fonts) | Typographie |

Aucun framework JavaScript n'est utilisé. L'application est une **SPA (Single Page Application)** entièrement en JavaScript natif.

### 4.2 Layout — Portail web

Le frontend adopte un layout de **portail web** avec :

- une **barre latérale fixe** (250 px) contenant la marque, la navigation, les informations utilisateur, le bouton de thème et la déconnexion
- un **topbar sticky** par page affichant le titre, le sous-titre et les actions contextuelles
- une **zone de contenu principale** scrollable

Pour la page d'accueil, le contenu est organisé en **grille deux colonnes** :
- colonne principale (gauche) : carte citation, filtres, boutons d'action, ajout de citation personnalisée
- colonne latérale (droite) : citation du jour, favoris avec recherche et pagination

Les pages d'authentification (connexion, inscription) utilisent un layout **split deux panneaux** distinct, sans sidebar, présenté dans une carte centrée.

### 4.3 Navigation SPA

La navigation est gérée par la fonction `afficherPage(identifiantPage)`. Lors d'un changement de page :

1. La classe `active` est retirée de toutes les pages
2. La page cible reçoit la classe `active`
3. Si la page est une page d'authentification (`pageConnexion`, `pageInscription`), le portail est masqué et le wrapper d'authentification est affiché
4. Si la page est une page applicative, le portail est affiché, le wrapper d'authentification est masqué, et l'item de navigation actif est mis en évidence

### 4.4 Pages et fonctionnalités

#### Page de connexion / inscription

- formulaire email et mot de passe
- bouton Google OAuth 2.0 (redirige vers le backend qui orchestre le flux)
- compte de démonstration affiché si le backend est en mode démo

#### Page principale (Accueil)

- **Carte citation** : affiche la citation courante avec auteur, zone de traduction, marque décorative typographique
- **Filtres** : sélecteur de catégorie et champ auteur, bouton de réinitialisation
- **Actions** : Nouvelle citation, Ajouter aux favoris, Traduire, Copier
- **Citation personnalisée** : formulaire texte/auteur/catégorie pour ajouter sa propre citation
- **Citation du jour** : bandeau indigo en colonne droite
- **Favoris** : liste paginée avec recherche plein texte, notes personnelles, copie, suppression

#### Page de profil

- affichage des informations du compte (nom, email)
- formulaire de modification du nom
- formulaire de changement de mot de passe (masqué pour les comptes Google purs)

#### Page Assistant IA

- topbar avec statut en temps réel (point vert), bouton de réinitialisation, bouton de thème
- suggestions rapides (actions prédéfinies : analyser les favoris, recommandations selon l'humeur)
- zone de messages avec bulles utilisateur/assistant
- indicateur de frappe animé pendant la génération de la réponse
- zone de saisie avec envoi par `Enter` ou bouton

### 4.5 Mode sombre

Le thème sombre est appliqué via l'attribut `data-theme="dark"` sur la balise `<html>`. Un script inline en `<head>` lit la préférence stockée dans `localStorage` avant le chargement du CSS, évitant tout flash blanc au chargement. Les variables CSS (`--bg-card`, `--text-dark`, etc.) sont redéfinies sous `[data-theme="dark"]` pour basculer tout le design en une seule déclaration.

### 4.6 Gestion du JWT côté client

Au chargement, le script vérifie si un token est présent dans `localStorage` et appelle `GET /api/auth/verify` pour confirmer sa validité. Si le token est valide, la session est restaurée automatiquement et l'utilisateur est redirigé vers la page principale sans se reconnecter. Si le token est invalide ou expiré, il est supprimé et la page de connexion est affichée.

---

## 5. Application mobile — React Native

### 5.1 Technologies utilisées

| Outil | Version | Usage |
| ----- | ------- | ----- |
| React Native | 0.81.5 | Runtime natif iOS / Android |
| Expo SDK | 54 | Toolchain mobile |
| React Navigation | v6 | Stack + Bottom Tabs |
| AsyncStorage | 2.2.0 | Persistance locale (token JWT, thème) |
| expo-clipboard | ~8.0.8 | Copie dans le presse-papier |
| @expo/vector-icons | ^15.0.3 | Icônes Ionicons |

### 5.2 Architecture mobile

```text
App.js
└── Providers (AuthContext, ThemeContext)
    └── AppNavigator
        ├── AuthStack (non connecté)
        │   ├── LoginScreen
        │   └── RegisterScreen
        └── MainTabs (connecté)
            ├── HomeScreen       — Citation aléatoire, du jour, filtres
            ├── FavoritesScreen  — Liste paginée avec notes
            └── ProfileScreen    — Profil, thème, déconnexion
```

### 5.3 Hooks personnalisés

| Hook | Responsabilité |
| ---- | -------------- |
| `useApi` | Appels `fetch` avec `Authorization: Bearer` automatique |
| `useQuote` | Citation aléatoire, du jour, traduction |
| `useFavorites` | CRUD favoris, pagination (8/page), notes |

### 5.4 Persistance locale

Le token JWT est stocké dans AsyncStorage sous la clé `@qk_token`. Le thème (clair/sombre) est stocké sous `@qk_theme`. Au démarrage de l'application, les deux valeurs sont lues, le thème est appliqué et le token est vérifié avant de déterminer quelle vue afficher.

### 5.5 Modes de connexion au backend

Selon l'environnement, l'URL du backend est configurée dans `src/constants/api.js` :

| Environnement | URL |
| ------------- | --- |
| Appareil physique (même Wi-Fi) | `http://<IP_LAN>:8000/api` |
| Émulateur Android | `http://10.0.2.2:8000/api` |
| Simulateur iOS | `http://localhost:8000/api` |
| Réseaux différents | URL localtunnel (HTTPS) |

---

## 6. Base de données MongoDB

### 6.1 Configuration

- **Base de données** : `quote_keeper`
- **Collections** : `users`, `quotes`
- **Connexion** : `mongodb://localhost:27017` (configurable via `.env`)

### 6.2 Collection `users`

Chaque document représente un compte utilisateur :

```json
{
  "_id": "<ObjectId>",
  "nom": "Jean Dupont",
  "email": "jean@test.com",
  "mot_de_passe_hash": "<hash PBKDF2-SHA256>",
  "google_id": null,
  "favorites": ["sha1_de_la_citation"],
  "favorite_quotes": {
    "<id>": {
      "id": "<id>",
      "text": "Texte de la citation",
      "author": "Auteur",
      "category": "wisdom",
      "note": "Ma réflexion personnelle"
    }
  },
  "cree_le": "2026-01-15T10:00:00Z",
  "modifie_le": "2026-02-01T14:30:00Z"
}
```

Notes :
- `google_id` est absent pour les comptes email/mot de passe
- `mot_de_passe_hash` est `null` pour les comptes Google purs
- `note` dans `favorite_quotes` est optionnel

### 6.3 Collection `quotes`

Les citations récupérées depuis API Ninjas sont mémorisées pour éviter des appels répétés :

```json
{
  "_id": "<ObjectId>",
  "id": "<hash SHA-1 du contenu>",
  "text": "Texte de la citation",
  "author": "Auteur",
  "category": "inspirational",
  "cree_le": "2026-01-20T09:00:00Z",
  "modifie_le": "2026-01-20T09:00:00Z"
}
```

L'identifiant stable (`id`) est un hachage SHA-1 du contenu de la citation, garantissant l'unicité indépendamment de la source.

### 6.4 Mode démonstration

Si la connexion à MongoDB échoue au démarrage, le backend bascule en mode démonstration. Un magasin en mémoire (`demo_store.py`) réplique les opérations CRUD sans persistance. Ce mécanisme permet de tester l'interface complète sans infrastructure MongoDB.

---

## 7. Sécurité

### 7.1 Hachage des mots de passe

Les mots de passe sont hachés avec **PBKDF2-SHA256** via la bibliothèque `passlib`. Chaque hash inclut un sel aléatoire généré automatiquement. L'algorithme est lent par conception, ce qui résiste aux attaques par force brute et par tables arc-en-ciel. Le hash stocké intègre l'algorithme, les paramètres et le sel dans un seul champ, ce qui facilite une migration transparente vers un algorithme plus récent si nécessaire.

### 7.2 Authentification JWT

Les jetons JWT sont signés avec **HMAC-SHA256** (`HS256`). La clé secrète est lue depuis la variable `SECRET_KEY` — le serveur refuse de démarrer si elle est absente. Les tokens ont une durée de vie de **10 080 minutes (7 jours)**, ce qui offre une expérience fluide sur mobile tout en restant bornée dans le temps.

La vérification du token est effectuée à chaque requête protégée via un dépendance FastAPI (`Depends(obtenir_utilisateur_courant)`). En cas de token invalide, expiré ou absent, une réponse 401 est retournée immédiatement.

### 7.3 Google OAuth 2.0

Le flux OAuth 2.0 est entièrement géré côté serveur :

1. le client est redirigé vers Google
2. Google retourne un code d'autorisation au backend via callback
3. le backend échange ce code contre un token Google
4. le backend interroge l'API Google pour obtenir le profil
5. le backend crée ou met à jour l'utilisateur dans MongoDB
6. le backend retourne un token JWT propriétaire au client

Les clés Google (Client ID et Client Secret) ne sont jamais exposées au frontend.

### 7.4 En-têtes de sécurité HTTP

Tous les endpoints bénéficient des en-têtes suivants via le middleware `SecurityHeadersMiddleware` :

| En-tête | Valeur | Protection |
| ------- | ------ | ---------- |
| X-Content-Type-Options | nosniff | MIME sniffing |
| X-Frame-Options | DENY | Clickjacking |
| X-XSS-Protection | 1; mode=block | XSS côté navigateur |
| Referrer-Policy | strict-origin-when-cross-origin | Fuite d'URL |

### 7.5 CORS

Les origines autorisées sont explicitement listées dans la variable `CORS_ORIGINS`. En développement, seuls `localhost:5500` et `127.0.0.1:5500` sont autorisés. Cette configuration empêche les requêtes cross-origin non prévues.

### 7.6 Validation des entrées

Toutes les données reçues par le backend sont validées par des modèles Pydantic avec contraintes explicites :

- nom : 2 à 50 caractères, espaces nettoyés
- email : format validé par expression régulière, converti en minuscules
- mot de passe : 6 à 72 caractères (limite PBKDF2)
- messages chatbot : 1 à 1 000 caractères
- historique : maximum 20 messages

### 7.7 Protection contre l'injection XSS

Dans le frontend, les noms d'utilisateur sont insérés dans le DOM via `document.createTextNode()` (jamais via `innerHTML`) afin d'éviter toute injection XSS via le champ nom.

---

## 8. Services externes intégrés

### 8.1 API Ninjas Quotes API

**Rôle** : fournit des citations réelles avec auteur et catégorie.

**Intégration** : appelée côté serveur uniquement. La clé API est stockée dans `.env` et n'est jamais exposée au client. Les filtres `category` et `author` transmis par le frontend sont relayés à l'API externe.

**Mécanisme de secours** : si l'API Ninjas est inaccessible (timeout, quota dépassé), le backend retourne une citation tirée aléatoirement d'une liste locale pré-chargée. L'application reste fonctionnelle sans connexion au service externe.

### 8.2 MyMemory Translation API

**Rôle** : traduit une citation en français.

**Intégration** : service gratuit, aucune clé API requise. L'endpoint `GET /api/quotes/translate` reçoit le texte et la langue source, appelle MyMemory et retourne la traduction.

**Codes d'erreur gérés** :
- `502 Bad Gateway` : MyMemory a répondu mais la traduction est invalide
- `503 Service Unavailable` : MyMemory est inaccessible

### 8.3 Groq API — Llama 3.3 70B Versatile

**Rôle** : alimente l'assistant littéraire IA.

**Intégration** : l'API Groq expose une interface compatible OpenAI (`/v1/chat/completions`). Avant chaque appel, le backend récupère les citations favorites de l'utilisateur et les injecte dans l'instruction système, donnant au modèle un contexte personnalisé.

**Fonctionnalités exposées** :
- `/api/ai/chat` : conversation libre avec historique (max 20 messages)
- `/api/ai/recommend` : recommandations de citations selon une humeur décrite
- `/api/ai/analyze` : analyse philosophique et stylistique des favoris

**Paramètres du modèle** : température 0.7, modèle `llama-3.3-70b-versatile`.

### 8.4 Google OAuth 2.0

**Rôle** : authentification sans mot de passe.

**Flux** : Authorization Code Flow standard via les endpoints Google (`oauth2.googleapis.com/token` et `googleapis.com/oauth2/v1/userinfo`). Le backend crée le compte si l'utilisateur est nouveau, ou le met à jour si l'adresse email existe déjà.

---

## 9. Tests et validation

### 9.1 Tests fonctionnels effectués

| Fonctionnalité | Résultat |
| -------------- | -------- |
| Inscription email/mot de passe | OK |
| Connexion email/mot de passe | OK |
| Connexion Google OAuth 2.0 | OK |
| Vérification et restauration de session au rechargement | OK |
| Citation aléatoire (sans filtre) | OK |
| Citation aléatoire avec filtre catégorie | OK |
| Citation aléatoire avec filtre auteur | OK |
| Citation du jour (cohérence multi-requêtes) | OK |
| Traduction en français (MyMemory) | OK |
| Copie dans le presse-papier | OK |
| Ajout d'une citation aux favoris | OK |
| Affichage des favoris | OK |
| Recherche dans les favoris | OK |
| Pagination des favoris | OK |
| Note personnelle sur un favori | OK |
| Modification d'une note | OK |
| Suppression d'un favori | OK |
| Ajout d'une citation personnalisée | OK |
| Assistant IA — conversation libre | OK |
| Assistant IA — recommandation selon humeur | OK |
| Assistant IA — analyse des favoris | OK |
| Modification du nom (page profil) | OK |
| Changement du mot de passe | OK |
| Bascule dark mode / light mode | OK |
| Persistance du thème au rechargement | OK |
| Persistance des favoris après reconnexion | OK |
| Mode démonstration (MongoDB absent) | OK |
| Mécanisme de secours (API Ninjas absent) | OK |
| Documentation Swagger UI | OK |
| Documentation ReDoc | OK |
| Vérification de santé `/api/health` | OK |

### 9.2 Validation de la persistance MongoDB

La persistance a été validée via MongoDB Compass :

1. création d'un compte et ajout de favoris
2. redémarrage du navigateur (ou de l'application mobile)
3. reconnexion avec le même compte
4. vérification que les favoris sont intacts dans l'interface et dans Compass

Les documents dans les collections `users` et `quotes` confirment le stockage physique des données.

### 9.3 Validation des en-têtes de sécurité

Les en-têtes de sécurité HTTP ont été vérifiés via les outils de développement du navigateur (onglet Réseau) sur toutes les réponses de l'API. Les quatre en-têtes (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`) sont présents sur chaque réponse.

### 9.4 Tests de l'API via Swagger

L'interface Swagger (`http://localhost:8000/api/docs`) a permis de tester chaque endpoint directement, en fournissant les corps de requête et les tokens JWT. Tous les endpoints retournent les codes HTTP attendus selon les cas nominaux et les cas d'erreur.

---

## 10. Difficultés rencontrées et solutions

### 10.1 Authentification Google OAuth 2.0 en environnement local

**Problème** : Google OAuth 2.0 exige une URL de callback HTTPS en production. En développement local avec HTTP, la redirection vers `localhost` est acceptée uniquement si l'URI de redirection est explicitement listée dans la console Google Cloud.

**Solution** : ajout de `http://localhost:8000/api/auth/google/callback` dans les URI de redirection autorisées de la console Google Cloud. En développement, l'échange du code se fait en HTTP, ce qui est acceptable.

### 10.2 CORS entre le frontend et le backend

**Problème** : le navigateur bloquait les requêtes `fetch` depuis `http://localhost:5500` vers `http://localhost:8000` avec une erreur CORS.

**Solution** : configuration du middleware `CORSMiddleware` dans FastAPI avec les origines `localhost:5500` et `127.0.0.1:5500` explicitement listées. Les en-têtes `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` et `Access-Control-Allow-Headers` sont correctement retournés sur les requêtes `OPTIONS` (preflight).

### 10.3 Durée du token JWT trop courte pour le mobile

**Problème** : avec une expiration de 30 minutes, l'application mobile déconnectait l'utilisateur à chaque session, dégradant l'expérience.

**Solution** : augmentation de `ACCESS_TOKEN_EXPIRE_MINUTES` à 10 080 (7 jours). Cette valeur est configurable via le fichier `.env` sans modification du code.

### 10.4 Chat IA — page fixe dans un layout flex

**Problème** : la page de chat nécessite un layout flex colonne (topbar fixe + zone messages scrollable + saisie fixe en bas). Dans le portail web, la zone de contenu principale (`portal-main`) est scrollable, ce qui empêchait la page de chat d'avoir une hauteur fixe.

**Solution** : `#pageChat.active` reçoit `height: 100vh; overflow: hidden; display: flex; flex-direction: column`. La zone de messages (`chat-messages`) reçoit `flex: 1; overflow-y: auto`, ce qui la rend seule scrollable. La topbar et la zone de saisie restent ancrées.

### 10.5 Clés SecureStore sur mobile

**Problème** : la clé `@qk_token` contenait le caractère `@`, non autorisé par Expo SecureStore (seuls les caractères alphanumériques, `.`, `-` et `_` sont valides). L'application plantait silencieusement.

**Solution** : renommage de la clé en `qk_token` (sans `@`) dans AsyncStorage.

### 10.6 Injection XSS via le nom utilisateur

**Problème** : si un nom d'utilisateur contenait du HTML (ex. `<img src=x onerror=alert(1)>`), l'insertion via `innerHTML` dans le header pouvait déclencher du code arbitraire.

**Solution** : l'affichage du nom utilise exclusivement `document.createTextNode()` pour insérer le nom comme texte brut, jamais comme HTML.

---

## 11. Conclusion

### 11.1 Bilan technique

QuoteKeeper démontre la mise en œuvre d'une application web moderne à trois couches :

- un **service web REST** FastAPI stateless avec authentification JWT, OAuth 2.0 et intégration de quatre services externes
- un **portail web** SPA en JavaScript natif avec layout dashboard, mode sombre et récupération de session automatique
- une **application mobile** React Native avec la même base fonctionnelle

L'ensemble respecte les bonnes pratiques de sécurité : hachage PBKDF2, JWT, en-têtes HTTP protecteurs, CORS restrictif, validation Pydantic et protection XSS dans le DOM.

### 11.2 Fonctionnalités livrées

Toutes les fonctionnalités planifiées dans le devis ont été développées et testées. L'intégration de l'assistant IA (Groq, Llama 3.3) constitue un enrichissement notable par rapport aux exigences de base du cours, permettant une interaction personnalisée basée sur les favoris de chaque utilisateur.

### 11.3 Points d'amélioration possibles

- **Cache distribué** : remplacer le cache mémoire de la citation du jour par un TTL MongoDB ou Redis pour survivre aux redémarrages du serveur
- **Pagination côté serveur** : la pagination des favoris est actuellement gérée côté client ; une pagination serveur serait nécessaire pour de grands volumes de données
- **Tests automatisés** : ajouter des tests unitaires (pytest) et des tests d'intégration sur les endpoints FastAPI
- **Déploiement** : containeriser l'application avec Docker et exposer le backend derrière un reverse proxy HTTPS (nginx + Let's Encrypt)

### 11.4 Apprentissages

Ce projet a permis de mettre en pratique :

- la conception d'une API REST documentée avec FastAPI et Swagger
- l'intégration de plusieurs services externes hétérogènes dans un même backend
- la sécurisation d'une application web (JWT, OAuth 2.0, PBKDF2, CORS, en-têtes HTTP)
- la persistance de données NoSQL avec MongoDB
- la conception d'une interface web sans framework (SPA vanilla)
- le développement mobile cross-platform avec React Native et Expo
- la gestion d'un mode de fonctionnement dégradé (démonstration, secours API)

---

*Rapport généré pour le cours 6GEI466 — Applications réseaux et sécurité informatique — Hiver 2026.*
