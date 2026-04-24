# QuoteKeeper

Application web et mobile de gestion de citations réalisée dans le cadre du cours `6GEI466 - Applications réseaux et sécurité informatique`.

QuoteKeeper permet à un utilisateur de créer un compte, se connecter (email/mot de passe, Google OAuth 2.0 ou code OTP), obtenir des citations aléatoires, enregistrer ses citations favorites, dialoguer avec un assistant littéraire IA et conserver ses données dans MongoDB. Le projet repose sur une architecture séparée entre un portail web HTML/CSS/JavaScript, un service web Python FastAPI et une application mobile React Native.

---

## Résumé du projet

Le projet est fonctionnel de bout en bout :

- backend FastAPI opérationnel (HTTPS port 8000, HTTP port 8001 pour mobile)
- portail web HTML/CSS/JavaScript avec navigation par barre latérale
- application mobile React Native (Expo SDK 54) opérationnelle sur iOS et Android
- base MongoDB connectée avec persistance active et indexes TTL automatiques
- intégration d'un service externe de citations (API Ninjas)
- intégration d'un assistant IA (Groq API, modèle Llama 3.3)
- authentification par JWT stocké en cookie httpOnly (web) et SecureStore (mobile)
- réinitialisation de mot de passe par code OTP envoyé par email
- gestion complète des favoris avec notes et tags personnels
- suppression de compte et export des données personnelles (RGPD)
- traduction en français (MyMemory)
- mode sombre / clair persistant

---

## Fonctionnalités principales

### Authentification
- inscription et connexion par email/mot de passe
- connexion sans mot de passe via code OTP envoyé par email
- connexion Google OAuth 2.0
- jetons JWT avec expiration configurable (défaut : 7 jours)
- révocation de token à la déconnexion (liste noire MongoDB + fallback mémoire)
- cookie httpOnly SameSite=Strict pour les clients web (protection XSS et CSRF)
- mot de passe oublié : code de réinitialisation envoyé par email (web et mobile)

### Citations
- citation aléatoire avec filtres par catégorie et auteur
- citation du jour (identique pour tous les utilisateurs dans la journée)
- traduction d'une citation en français
- copie rapide dans le presse-papier

### Favoris
- ajout et suppression de citations favorites
- notes personnelles sur les favoris
- tags personnalisés
- recherche par texte ou auteur
- pagination (8 par page)
- ajout d'une citation personnalisée

### Profil
- modifier le nom d'affichage
- changer le mot de passe (en connaissant l'ancien)
- réinitialiser le mot de passe par OTP (sans connaître l'ancien)

### RGPD dans la BD
- suppression définitive du compte et de toutes les données associées
- export des données personnelles au format JSON (article 20 RGPD)

### Assistant IA
- chat libre avec l'assistant littéraire (Groq, Llama 3.3 70B)
- recommandations selon l'humeur
- analyse philosophique des citations favorites

---

## Technologies utilisées

### Backend
- Python 3.11+
- FastAPI 0.104.1
- PyMongo 4.5.0 (pool de connexions : maxPoolSize=50, minPoolSize=10)
- passlib 1.7.4 (hachage PBKDF2-SHA256)
- PyJWT 2.8.0 (HS256, algorithme fixe — protection algorithm confusion)
- python-multipart 0.0.9
- google-auth 2.28.0
- slowapi 0.1.9 (rate limiting)
- smtplib (envoi d'emails OTP/reset)

### Frontend web
- HTML5 / CSS3 / JavaScript (vanilla)
- `credentials: 'include'` sur tous les appels `fetch` (cookie httpOnly)
- timeout automatique 10 secondes via `AbortController`
- mode sombre/clair

### Application mobile
- React Native 0.81.5
- Expo SDK 54
- React Navigation v6
- expo-secure-store (stockage sécurisé du JWT)
- @expo/vector-icons (Ionicons)

### Base de données
- MongoDB Community Server
- MongoDB Compass
- Index TTL automatiques pour OTP, codes de reset et tokens révoqués

### Services externes
- API Ninjas Quotes API (citations aléatoires)
- MyMemory Translation API (traduction en français)
- Google OAuth 2.0 (authentification sans mot de passe)
- Groq API — modèle Llama 3.3 70B Versatile (assistant IA)
- Gmail SMTP (envoi des codes OTP et de réinitialisation)

---

## Architecture du projet

```
Portail Web HTML/CSS/JS          Application Mobile React Native
          |                                   |
          | HTTPS 8000 (cookie httpOnly)      | HTTP 8001 (Bearer token SecureStore)
          v                                   v
              Service web FastAPI (Python)
         |          |           |           |
         |          |           |           +--> Google OAuth 2.0
         |          |           |           +--> Gmail SMTP (OTP / reset MDP)
         |          |           |
         |          |           +--> API Ninjas (citations)
         |          |           +--> MyMemory  (traduction)
         |          |           +--> Groq API  (assistant IA)
         |          |
         |          +--> MongoDB (persistance + TTL indexes)
```

Le backend expose deux ports simultanément :
- `8000` (HTTPS) — pour le navigateur web (certificat mkcert)
- `8001` (HTTP) — pour l'application mobile (pas de certificat nécessaire)

---

## Structure du projet

```
Projet-conception/
├── backend/
│   ├── app/
│   │   ├── auth.py              # PBKDF2-SHA256, JWT HS256, révocation
│   │   ├── database.py          # Connexion MongoDB + pool, TTL indexes, mode démo
│   │   ├── demo_store.py        # Données de démonstration en mémoire
│   │   ├── dependencies.py      # Dépendance JWT : cookie qk_token OU Bearer header
│   │   ├── main.py              # Application FastAPI, CORS, middlewares sécurité
│   │   └── routes/
│   │       ├── auth_routes.py   # Register, login, profil, RGPD (export/delete)
│   │       ├── otp_routes.py    # OTP request/verify, reset MDP par OTP
│   │       ├── quotes_routes.py # Citations, favoris
│   │       ├── ai_routes.py     # Chat IA, recommandations, analyse
│   │       └── google_routes.py # OAuth 2.0 Google (cookie web + token mobile)
│   ├── certs/                   # Certificats TLS mkcert (non commités)
│   ├── .env                     # Variables d'environnement (non commité)
│   ├── .env.example             # Modèle de configuration
│   ├── requirements.txt
│   └── run.py                   # Lance HTTPS (8000) + HTTP mobile (8001)
├── frontend/
│   ├── css/style.css
│   ├── js/script.js
│   └── index.html
application-                    # EXPO_PUBLIC_API_URL (non commité)
│   ├── README.md
│   └── src/
│       ├── constants/
│       │   ├── api.js           # BASE_URL et endpoints (inclut profileDelete, profileExport)
│       │   └── theme.js         # Tokens couleur clair/sombre
│       ├── contexts/
│       │   ├── AuthContext.js   # Session JWT, login/inscription/déconnexion
│       │   └── ThemeContext.js  # Dark mode persisté
│       ├── hooks/
│       │   ├── useApi.js        # fetch() avec Authorization automatique
│       │   ├── useQuote.js      # Citation aléatoire, du jour, traduction
│       │   └── useFavorites.js  # CRUD favoris, pagination, notes
│       ├── navigation/
│       │   ├── AppNavigator.js  # Aiguillage auth ↔ app principale
│       │   ├── AuthStack.js     # Login, Register, OTP, ForgotPassword
│       │   └── MainTabs.js      # Barre flottante : Accueil/Favoris/Chat/Profil
│       ├── screens/
│       │   ├── auth/
│       │   │   ├── LoginScreen.js
│       │   │   ├── RegisterScreen.js
│       │   │   ├── OtpScreen.js          # Connexion sans mot de passe
│       │   │   └── ForgotPasswordScreen.js
│       │   └── main/
│       │       ├── HomeScreen.js
│       │       ├── FavoritesScreen.js
│       │       ├── ChatScreen.js         # Assistant IA
│       │       └── ProfileScreen.js
│       └── components/
│           ├── QuoteCard.js
│           ├── FavoriteItem.js
│           ├── FilterBar.js
│           ├── Pagination.js
│           ├── Toast.js
│           └── LoadingSpinner.js
├── DEVIS.md
└── README.md
```

---

## Prérequis

- Python 3.11 ou plus récent
- MongoDB Community Server
- MongoDB Compass
- mkcert (certificat TLS local pour le navigateur)
- Node.js 18+ et npm 9+ (pour l'application mobile)
- Expo Go sur le téléphone (SDK 54)
- Un navigateur web moderne

---

## Configuration

Le backend utilise un fichier `backend/.env` (à créer à partir de `backend/.env.example`).

```env
# Base de données
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=quote_keeper

# Sécurité — générer avec : python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=remplacer_par_une_cle_aleatoire_de_64_caracteres_hex
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Serveur
HOST=0.0.0.0
PORT=8000
RELOAD=False
ENV=development

# API externes
NINJAS_API_KEY=remplacer_par_votre_cle_ninjas
GROQ_API_KEY=remplacer_par_votre_cle_groq

# Google OAuth 2.0
GOOGLE_CLIENT_ID=remplacer
GOOGLE_CLIENT_SECRET=remplacer
GOOGLE_REDIRECT_URI=https://localhost:8000/api/auth/google/callback
FRONTEND_URL=https://localhost:5500

# CORS
CORS_ORIGINS=https://localhost:5500,https://127.0.0.1:5500

# SMTP (Gmail) — pour les codes OTP et la réinitialisation de MDP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=votre.email@gmail.com
SMTP_PASSWORD=mot_de_passe_application_gmail

# Mode démonstration (MongoDB indisponible)
DEMO_EMAIL=demo@test.com
DEMO_PASSWORD=demo123
```

> **SMTP** : activez la validation en 2 étapes sur votre compte Gmail, puis créez un « Mot de passe d'application » sur https://myaccount.google.com/apppasswords

> **SECRET_KEY** : générez une clé forte avec `python -c "import secrets; print(secrets.token_hex(32))"`

---

## Installation

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Certificat TLS (pour le navigateur)

```powershell
cd backend
mkdir certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1
```

---

## Lancement

### 1. Démarrer MongoDB

Vérifier que MongoDB est actif sur `localhost:27017`.

### 2. Démarrer le backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python run.py
```

Le script démarre automatiquement :
- le serveur **HTTPS** sur le port `8000` (navigateur web)
- le serveur **HTTP** sur le port `8001` (application mobile — pas de certificat requis)
- le serveur frontend sur `https://localhost:5500`

URLs utiles :
| URL | Description |
|-----|-------------|
| `https://localhost:5500` | Portail web |
| `https://localhost:8000/api/docs` | Swagger UI |
| `https://localhost:8000/api/redoc` | ReDoc |
| `https://localhost:8000/api/health` | Vérification de santé |

### 3. Application mobile

Voir [mobile/README.md](mobile/README.md) pour les instructions complètes.

---

## Endpoints de l'API

### Authentification

| Méthode | URL | Auth | Description |
|---------|-----|------|-------------|
| POST | `/api/auth/register` | — | Créer un compte (pose le cookie) |
| POST | `/api/auth/login` | — | Connexion email/mot de passe (pose le cookie) |
| POST | `/api/auth/logout` | cookie/Bearer | Déconnexion (révoque le token, efface le cookie) |
| GET  | `/api/auth/verify` | cookie/Bearer | Vérifier la validité d'un token JWT |
| GET  | `/api/auth/google` | — | Initier le flux OAuth 2.0 Google |
| GET  | `/api/auth/google/callback` | — | Retour OAuth 2.0 Google (pose le cookie) |
| POST | `/api/auth/google/mobile` | — | OAuth Google pour mobile (retourne access_token JSON) |
| GET  | `/api/auth/profile` | cookie/Bearer | Obtenir le profil |
| PUT  | `/api/auth/profile` | cookie/Bearer | Modifier le nom d'affichage |
| DELETE | `/api/auth/profile` | cookie/Bearer | Supprimer le compte (RGPD) |
| GET  | `/api/auth/profile/export` | cookie/Bearer | Exporter les données personnelles (RGPD) |
| PUT  | `/api/auth/profile/password` | cookie/Bearer | Changer le mot de passe (ancien requis) |
| PUT  | `/api/auth/profile/set-password` | cookie/Bearer | Définir le mot de passe après OTP |

### OTP (connexion et réinitialisation)

| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/auth/otp/request` | Envoyer un code OTP par email (connexion sans MDP) |
| POST | `/api/auth/otp/verify` | Vérifier le code OTP → JWT |
| POST | `/api/auth/password-reset/request` | Demander un code de réinitialisation |
| POST | `/api/auth/password-reset/verify` | Vérifier le code et définir un nouveau MDP |

### Citations

| Méthode | URL | Auth | Description |
|---------|-----|------|-------------|
| GET    | `/api/quotes/random` | cookie/Bearer | Citation aléatoire (filtres : category, author) |
| GET    | `/api/quotes/daily` | cookie/Bearer | Citation du jour |
| GET    | `/api/quotes/translate` | cookie/Bearer | Traduire en français |
| GET    | `/api/quotes/favorites` | cookie/Bearer | Liste des favoris |
| POST   | `/api/quotes/favorites/{id}` | cookie/Bearer | Ajouter aux favoris |
| PATCH  | `/api/quotes/favorites/{id}/note` | cookie/Bearer | Modifier la note |
| PATCH  | `/api/quotes/favorites/{id}/tag` | cookie/Bearer | Modifier le tag |
| DELETE | `/api/quotes/favorites/{id}` | cookie/Bearer | Retirer des favoris |

### Assistant IA

| Méthode | URL | Auth | Description |
|---------|-----|------|-------------|
| POST | `/api/ai/chat` | cookie/Bearer | Chat avec l'assistant littéraire |
| POST | `/api/ai/recommend` | cookie/Bearer | Recommandations selon l'humeur |
| POST | `/api/ai/analyze` | cookie/Bearer | Analyse philosophique des favoris |

### Service

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/health` | État du service et de MongoDB |

> **Auth** : `cookie` = cookie httpOnly `qk_token` (clients web) ; `Bearer` = header `Authorization: Bearer <token>` (clients mobile/API)

---

## Sécurité

| Mesure | Description |
|--------|-------------|
| TLS / HTTPS | Certificat auto-signé mkcert — RSA 2048 bits, SHA-256 ; SAN : `localhost` + `127.0.0.1` ; CA locale reconnue par le navigateur via `mkcert -install` |
| PBKDF2-SHA256 | Mots de passe jamais stockés en clair ; algorithme résistant à la force brute |
| JWT HS256 fixe | Algorithme non configurable — protection contre les attaques algorithm confusion |
| Cookie httpOnly | Token JWT inaccessible depuis JavaScript (protection XSS) |
| SameSite=Strict | Aucun cookie envoyé depuis un site tiers (protection CSRF) |
| Token révoqué | Liste noire MongoDB (TTL auto) + fallback mémoire — invalidation immédiate à la déconnexion |
| Rate limiting | slowapi — 200 req/min global, 5/min sur register, 10/min sur login, 3/min sur OTP et reset |
| Anti-spam OTP | 60 secondes minimum entre deux demandes pour le même email |
| Expiration code | OTP/reset : 10 minutes, 5 tentatives maximum, hachage SHA-256 avant stockage |
| Codes jamais en clair | OTP et codes de reset stockés sous forme de hash SHA-256 |
| Headers sécurité | HSTS, X-Frame-Options: DENY, CSP, X-Content-Type-Options: nosniff |
| CORS strict | Origines explicites, jamais `*` avec `credentials: true` |
| Enumération masquée | `/password-reset/request` retourne toujours 200 |
| CSRF OAuth | Paramètre `state` signé HMAC-SHA256 sur le flux OAuth web |
| `email_verified` | Vérifié côté serveur avant d'accepter un compte Google |
| Audit logs | Connexion réussie, changement de MDP, export et suppression de compte |
| Timeout fetch | AbortController 10 s sur le frontend web ; 30 s sur le mobile (connexion SMTP plus lente) |
| SMTP en arrière-plan | `BackgroundTasks` FastAPI — la réponse 200 est envoyée immédiatement, l'envoi SMTP s'exécute après ; évite les timeouts sur mobile lors d'une connexion Gmail lente |
| MongoDB pool | `maxPoolSize=50, minPoolSize=10` — robustesse sous charge |
| Datetimes UTC normalisés | `_aware()` convertit les datetimes naïfs retournés par MongoDB en UTC-aware avant toute comparaison avec `datetime.now(timezone.utc)` — évite les `TypeError` sur l'anti-spam et l'expiration des codes |
| RGPD | Suppression de compte (`DELETE /profile`) et export de données (`GET /profile/export`) |

---

## Base de données MongoDB

### Base utilisée : `quote_keeper`

### Collection `users`

```json
{
  "_id": "ObjectId",
  "nom": "Alice",
  "email": "alice@test.com",
  "mot_de_passe_hash": "pbkdf2_sha256_hash_ou_null",
  "google_id": null,
  "favorites": ["quote_123"],
  "favorite_quotes": {
    "quote_123": {
      "id": "quote_123",
      "text": "...",
      "author": "...",
      "category": "general",
      "note": "note personnelle",
      "tag": "philosophie"
    }
  },
  "cree_le": "ISO8601",
  "modifie_le": "ISO8601"
}
```

### Collection `otp_codes`

```json
{ "_id": "email@test.com", "code_hash": "sha256...", "expires_at": "ISO8601", "tentatives": 0 }
```

Index TTL sur `expires_at` — suppression automatique par MongoDB à expiration.

### Collection `reset_codes`

Même structure que `otp_codes`. Index TTL sur `expires_at`.

### Collection `revoked_tokens`

```json
{ "_id": "sha256_token_hash", "expires_at": "ISO8601" }
```

Index TTL sur `expires_at` — nettoyage automatique des tokens expirés.

---

## Tests manuels recommandés

- inscription avec email/mot de passe
- connexion avec email/mot de passe
- connexion via code OTP (sans mot de passe)
- connexion Google OAuth 2.0
- vérification que le cookie `qk_token` est présent dans les outils développeurs (httpOnly)
- mot de passe oublié web : flux complet en 3 étapes (email → code 6 chiffres → nouveau MDP → connexion), incluant le bouton "Modifier l'email" (retour étape 1 avec email pré-rempli)
- mot de passe oublié mobile : même flux en 3 étapes confirmé fonctionnel sur appareil physique
- citation aléatoire avec filtres
- traduction d'une citation
- ajout / suppression de favoris
- note et tag personnels sur un favori
- recherche dans les favoris
- assistant IA (chat, recommandation, analyse)
- modification du nom et du mot de passe (profil)
- export des données (GET /profile/export)
- suppression de compte (DELETE /profile)
- mode sombre / clair
- persistance dans MongoDB Compass
- Swagger UI et ReDoc

---

## Mode démonstration

Si MongoDB n'est pas disponible, le mode démonstration permet de tester l'application sans base de données (données en mémoire, non persistées) :

```
Email    : demo@test.com
MDP      : demo123
```

---

## Documentation associée

- [DEVIS.md](DEVIS.md) — description fonctionnelle, maquettes, flux, modèle de données
- [mobile/README.md](mobile/README.md) — instructions de lancement mobile

---

## Auteur

Projet réalisé dans le cadre du cours `6GEI466 - Applications réseaux et sécurité informatique`.
