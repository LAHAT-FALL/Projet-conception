# DEVIS DE PROJET - QuoteKeeper

## 1. Présentation générale

### Nom du projet

QuoteKeeper

### Contexte

QuoteKeeper est une application web développée dans le cadre du cours `6GEI466 - Applications réseaux et sécurité informatique`. Le projet vise à démontrer la conception d'un portail web relié à un service web, avec persistance MongoDB et intégration de services externes.

### Objectif

L'objectif de l'application est de permettre à un utilisateur de consulter des citations, conserver ses citations favorites, rechercher dans sa collection personnelle, ajouter ses propres citations et interagir avec un assistant littéraire IA.

### Public cible

- étudiants
- amateurs de citations
- utilisateurs souhaitant conserver et explorer des citations inspirantes

---

## 2. Description fonctionnelle

### Fonctionnalités principales

- inscription d'un utilisateur (email/mot de passe ou compte Google)
- connexion et déconnexion (email/mot de passe, Google OAuth 2.0 ou code OTP)
- authentification sécurisée par JWT (cookie httpOnly pour le web, SecureStore pour le mobile)
- récupération d'une citation aléatoire avec filtres par catégorie et auteur
- citation du jour (même citation pour tous les utilisateurs dans la journée)
- traduction d'une citation en français (service interne MyMemory)
- copie rapide de la citation courante dans le presse-papier
- ajout d'une citation aux favoris
- notes personnelles sur les citations favorites
- tags personnalisés sur les favoris
- suppression d'une citation favorite
- consultation de la liste des favoris avec pagination
- recherche dans les favoris (texte, auteur, tag)
- ajout d'une citation personnalisée
- page de profil (modifier le nom, changer le mot de passe)
- réinitialisation de mot de passe par code OTP (sans connaître l'ancien)
- assistant IA littéraire (Groq, Llama 3.3) avec contexte des favoris
- mode sombre / clair persistant (dark mode)
- suppression de compte et de toutes les données associées (RGPD)
- export des données personnelles au format JSON (RGPD article 20)

### Fonctionnalités de soutien

- mode démonstration si MongoDB n'est pas disponible
- liste locale de secours si l'API externe ne répond pas
- documentation automatique de l'API avec Swagger et ReDoc
- gestion uniforme des erreurs HTTP (400, 401, 403, 404, 500, 502, 503)
- toast de notification visuel pour les confirmations de succès
- application du thème sombre sans flash au chargement
- timeout automatique de 10 secondes sur les appels API frontend web, 30 secondes sur mobile (AbortController)
- audit log serveur pour les événements sensibles (connexion, changement MDP, export, suppression)

---

## 3. Technologies retenues

### Backend

- Python 3.11+
- FastAPI 0.104.1
- PyMongo 4.5.0 (pool de connexions MongoDB)
- passlib 1.7.4 (PBKDF2-SHA256)
- PyJWT 2.8.0 (HS256 fixe)
- python-multipart 0.0.9
- google-auth 2.28.0
- slowapi 0.1.9 (rate limiting)

### Frontend

- HTML5 / CSS3 / JavaScript (vanilla)
- `credentials: 'include'` sur tous les `fetch` (cookie httpOnly)
- timeout 10 secondes via `AbortController`
- mode sombre/clair persisté dans `localStorage`

### Base de données

- MongoDB Community Server
- MongoDB Compass
- Index TTL automatiques sur `otp_codes`, `reset_codes`, `revoked_tokens`

### Services externes

- API Ninjas Quotes API (citations aléatoires)
- MyMemory Translation API (traduction en français)
- Google OAuth 2.0 (authentification)
- Groq API — modèle Llama 3.3 70B Versatile (assistant IA littéraire)
- Gmail SMTP (envoi des codes OTP et de réinitialisation de mot de passe)

---

## 4. Architecture générale

```text
Portail Web HTML/CSS/JS          Application Mobile React Native
          |                                   |
          | HTTPS 8000 (cookie httpOnly)      | HTTP 8001 (Bearer token SecureStore)
          v                                   v
              Service web FastAPI (Python)
         |          |           |           |
         |          |           |           +--> Google OAuth 2.0
         |          |           |           +--> Gmail SMTP (OTP / reset MDP)
         |          |           |
         |          |           +--> API Ninjas Quotes (citations)
         |          |           +--> MyMemory API     (traduction)
         |          |           +--> Groq API         (assistant IA)
         |          |
         |          +--> MongoDB (persistance + TTL indexes)
```

Description :

- le frontend envoie ses requêtes avec `credentials: 'include'` ; le cookie httpOnly est transmis automatiquement par le navigateur
- le backend vérifie le JWT depuis le cookie `qk_token` (web) ou le header `Authorization: Bearer` (mobile)
- MongoDB assure la persistance des comptes, favoris, codes OTP/reset et tokens révoqués
- API Ninjas fournit des citations réelles provenant d'un service externe
- MyMemory traduit les citations en français (service gratuit, sans clé API)
- Google OAuth 2.0 permet la connexion et l'inscription sans mot de passe
- Groq API (Llama 3.3) fournit l'assistant IA littéraire qui connaît les favoris de l'utilisateur
- Gmail SMTP envoie les codes OTP à usage unique et les codes de réinitialisation de MDP

---

## 5. Maquettes des écrans

### Page de connexion (portail web)

```text
+------------------------------------------------------+
|  [icone]  |                                          |
|QuoteKeeper|             Connexion                    |
|           |  Bienvenue, content de vous revoir.      |
| Citations |                                          |
| aleatoires|  Email    [ votre@email.com         ]    |
|           |  Mot de   [ ••••••••               ]    |
| Favoris   |  passe                                   |
|           |         [ Se connecter ]                 |
| Assist.IA |                                          |
|           |          -------- ou --------            |
|           |       [ G  Continuer avec Google ]       |
|           |       [ @ Connexion par code OTP  ]      |
|           |                                          |
|           |  demo@test.com / demo123                 |
|           |  Pas encore de compte ? S'inscrire       |
+------------------------------------------------------+
```

### Page principale — portail

```text
+----------------------------------------------------------+
|  [Q]        |  Topbar : Accueil                          |
| QuoteKeeper |  Decouvrez des citations inspirantes       |
|             +---------------------------------------------|
| [home]      |                                            |
| Accueil  <  |  "Citation aleatoire affichee ici..."      |  Citation du jour
|             |                         — Auteur           |  +------------------+
| [profil]    |                                            |  | [soleil] DU JOUR  |
| Mon Profil  |  [tag] Cat. v  [user] Auteur [x effacer]  |  | "Texte court..."  |
|             |                                            |  | — Auteur          |
| [robot]     |  [Nouvelle]  [Ajouter favoris]            |  +------------------+
| Assist. IA  |  [Traduire]  [Copier]                     |
|          ●  |                                            |  Mes favoris
|             |  Ajouter ma propre citation                |  [recherche...]
|─────────────|  Texte: [...] Auteur: [...] [Utiliser]    |
|  [user] Nom |                                            |  "Cit..." Auteur ✦✕
|  [lune] [→] |                                            |  "Cit..." Auteur ✦✕
+----------------------------------------------------------+
```

### Page profil — portail

```text
+----------------------------------------------------------+
|  [Q]        |  [←] Mon Profil                            |
| QuoteKeeper |  Gerez vos informations personnelles        |
|             +---------------------------------------------|
| [home]      |                                            |
| Accueil     |  [carte] Informations du compte            |
|             |    NOM ACTUEL      |   EMAIL               |
| [profil]    |    Jean Dupont     |   jean@test.com       |
| Mon Profil<-|                                            |
|             |  [crayon] Modifier le nom                  |
| [robot]     |    Nouveau nom : [Jean Dupont...]          |
| Assist. IA  |    [ Enregistrer le nom ]                  |
|          ●  |                                            |
|             |  [cle] Changer le mot de passe             |
|─────────────|    Mot de passe actuel : [...]             |
|  [user] Nom |    Nouveau mot de passe : [...]            |
|  [lune] [→] |    Confirmer : [...]                       |
|             |    [ Changer le mot de passe ]             |
|             |                                            |
|             |  [RGPD] Mes données                        |
|             |    [ Exporter mes données (JSON) ]         |
|             |    [ Supprimer mon compte ]                |
+----------------------------------------------------------+
```

### Page Assistant IA — portail

```text
+----------------------------------------------------------+
|  [Q]        |  [←] Assistant IA ●  Groq AI (Llama 3.3) [↺][lune]
| QuoteKeeper |  Assistant litteraire                       |
|             +---------------------------------------------|
| [home]      |  Suggestions : [Analyser favoris] [Joyeux] [Philo] ...
| Accueil     |                                            |
|             |                                            |
| [profil]    |    [assistant] Bonjour ! Je suis votre     |
| Mon Profil  |               assistant litteraire...      |
|             |                                            |
| [robot]     |                  Parlez-moi de Camus [user]|
| Assist. IA<-|                                            |
|          ●  |    [assistant] Albert Camus est...         |
|             |                                            |
|─────────────|  [ Posez une question sur les citations… ] [>]
|  [user] Nom |
|  [lune] [→] |
+----------------------------------------------------------+
```

---

## 6. Description des endpoints

| Méthode | URL | Auth | Description |
| ------- | --- | ---- | ----------- |
| POST | `/api/auth/register` | — | Créer un compte (pose le cookie `qk_token`) |
| POST | `/api/auth/login` | — | Authentifier (pose le cookie `qk_token`) |
| POST | `/api/auth/logout` | cookie/Bearer | Révoquer le token, effacer le cookie |
| GET | `/api/auth/verify` | cookie/Bearer | Vérifier la validité d'un token JWT |
| GET | `/api/auth/google` | — | Initier le flux OAuth 2.0 Google |
| GET | `/api/auth/google/callback` | — | Traiter le retour Google OAuth (pose le cookie) |
| POST | `/api/auth/google/mobile` | — | OAuth Google pour mobile (retourne JSON) |
| GET | `/api/auth/profile` | cookie/Bearer | Obtenir le profil de l'utilisateur |
| PUT | `/api/auth/profile` | cookie/Bearer | Modifier le nom d'affichage |
| DELETE | `/api/auth/profile` | cookie/Bearer | Supprimer le compte et les données (RGPD) |
| GET | `/api/auth/profile/export` | cookie/Bearer | Exporter les données personnelles (RGPD) |
| PUT | `/api/auth/profile/password` | cookie/Bearer | Changer le mot de passe (ancien requis) |
| PUT | `/api/auth/profile/set-password` | cookie/Bearer | Définir le MDP après vérification OTP |
| POST | `/api/auth/otp/request` | — | Envoyer un code OTP par email |
| POST | `/api/auth/otp/verify` | — | Vérifier le code OTP → JWT |
| POST | `/api/auth/password-reset/request` | — | Demander un code de réinitialisation |
| POST | `/api/auth/password-reset/verify` | — | Vérifier le code et définir un nouveau MDP |
| GET | `/api/quotes/random` | cookie/Bearer | Citation aléatoire (filtres category, author) |
| GET | `/api/quotes/daily` | cookie/Bearer | Citation du jour (même pour tous) |
| GET | `/api/quotes/translate` | cookie/Bearer | Traduire une citation en français |
| GET | `/api/quotes/favorites` | cookie/Bearer | Liste des favoris |
| POST | `/api/quotes/favorites/{id}` | cookie/Bearer | Ajouter une citation aux favoris |
| PATCH | `/api/quotes/favorites/{id}/note` | cookie/Bearer | Modifier la note sur un favori |
| PATCH | `/api/quotes/favorites/{id}/tag` | cookie/Bearer | Modifier le tag sur un favori |
| DELETE | `/api/quotes/favorites/{id}` | cookie/Bearer | Retirer une citation des favoris |
| POST | `/api/ai/chat` | cookie/Bearer | Converser avec l'assistant littéraire |
| POST | `/api/ai/recommend` | cookie/Bearer | Recommandations selon l'humeur |
| POST | `/api/ai/analyze` | cookie/Bearer | Analyse philosophique des favoris |
| GET | `/api/health` | — | Vérifier la santé du service |

> **Auth** : `cookie` = cookie httpOnly `qk_token` (navigateur web) ; `Bearer` = header `Authorization: Bearer <token>` (mobile / API)

### Détail de l'endpoint de traduction

#### GET /api/quotes/translate

Paramètres de requête :

- `texte` (obligatoire) : le texte à traduire
- `langue_source` (optionnel, défaut `en`) : code de langue source (`en`, `es`, `de`, …)

Exemple de réponse :

```json
{
  "texte_original": "The only way to do great work is to love what you do.",
  "texte_traduit": "La seule façon de faire un excellent travail est d'aimer ce que vous faites.",
  "langue_source": "en",
  "langue_cible": "fr"
}
```

Codes HTTP :

- `200` : traduction réussie
- `400` : texte vide ou manquant
- `401` : token absent ou invalide
- `502` : MyMemory n'a pas retourné de résultat valide
- `503` : MyMemory est inaccessible

### Détail de l'endpoint de chat IA

#### POST /api/ai/chat

Corps de la requête :

```json
{
  "message": "Parlez-moi de l'auteur de ma citation favorite.",
  "historique": [
    { "role": "user", "content": "Bonjour" },
    { "role": "assistant", "content": "Bonjour ! Comment puis-je vous aider ?" }
  ]
}
```

Le chatbot reçoit en contexte les 10 premières citations favorites de l'utilisateur. L'historique est limité à 20 messages côté backend, 40 messages côté frontend (les 40 derniers sont conservés).

Exemple de réponse :

```json
{
  "reponse": "Albert Camus, prix Nobel de littérature 1957, est l'un des grands philosophes de l'absurde..."
}
```

Codes HTTP :

- `200` : réponse de l'assistant
- `401` : token absent ou invalide
- `503` : clé API Groq non configurée
- `502` : erreur retournée par l'API Groq
- `504` : timeout Groq (> 30 secondes)

---

## 7. Flux d'information

### Flux d'inscription (email/mot de passe)

```text
Client Web -> POST /api/auth/register (JSON : nom, email, mot_de_passe)
FastAPI    -> validation, hachage PBKDF2-SHA256, insertion MongoDB
FastAPI    -> Set-Cookie: qk_token=<JWT>; HttpOnly; SameSite=Strict
Client Web <- access_token (JSON) + cookie httpOnly posé automatiquement
```

### Flux de connexion (email/mot de passe)

```text
Client Web -> POST /api/auth/login (JSON : email, mot_de_passe)
FastAPI    -> vérification hash PBKDF2-SHA256, génération JWT
FastAPI    -> Set-Cookie: qk_token=<JWT>; HttpOnly; SameSite=Strict
Client Web <- access_token (JSON) + cookie httpOnly posé automatiquement
```

### Flux de connexion Google OAuth 2.0 (web)

```text
Client Web -> GET /api/auth/google
FastAPI    -> redirection vers accounts.google.com (state CSRF signé HMAC-SHA256)
Google     -> GET /api/auth/google/callback?code=...&state=...
FastAPI    -> vérification state CSRF
FastAPI    -> POST oauth2.googleapis.com/token (échange du code, serveur à serveur)
FastAPI    -> GET googleapis.com/userinfo (profil + email_verified)
FastAPI    -> MongoDB (upsert atomique)
FastAPI    -> Set-Cookie: qk_token=<JWT>; HttpOnly; SameSite=Strict
FastAPI    -> redirection Client Web vers ?google_ok=1
Client Web -> GET /api/auth/profile (cookie envoyé automatiquement)
Client Web <- profil utilisateur JSON
```

### Flux de connexion par OTP

```text
Client Web -> POST /api/auth/otp/request { email }
FastAPI    -> génération code 6 chiffres, hachage SHA-256, stockage MongoDB (TTL 10 min)
FastAPI    -> envoi email via Gmail SMTP
Client Web <- { message: "code envoyé" }

Client Web -> POST /api/auth/otp/verify { email, code }
FastAPI    -> vérification hash, incrément tentatives (max 5)
FastAPI    -> Set-Cookie: qk_token=<JWT>; HttpOnly; SameSite=Strict
Client Web <- access_token (JSON) + cookie httpOnly posé automatiquement
```

### Flux de réinitialisation de mot de passe

```text
Client     -> POST /api/auth/password-reset/request { email }
FastAPI    -> génération code, hachage SHA-256, stockage MongoDB (TTL 10 min)
FastAPI    <- 200 immédiat (anti-énumération — même réponse si email inconnu)
FastAPI    -> (arrière-plan) si email connu : envoi Gmail SMTP via BackgroundTasks

Client     -> POST /api/auth/password-reset/verify { email, code, nouveau_mot_de_passe }
FastAPI    -> vérification hash, mise à jour MDP haché PBKDF2-SHA256
Client     <- { message: "mot de passe modifié" }
```

L'envoi SMTP est délégué à `BackgroundTasks` FastAPI : la réponse 200 part immédiatement, sans attendre la connexion TLS Gmail (qui peut dépasser 10–15 s). Cela s'applique aussi à `/otp/request`.

### Flux de déconnexion

```text
Client Web -> POST /api/auth/logout (cookie envoyé automatiquement)
FastAPI    -> hachage SHA-256 du token, insertion dans revoked_tokens MongoDB (TTL)
FastAPI    -> Set-Cookie: qk_token=""; Max-Age=0 (effacement du cookie)
Client Web <- { status: "success" } + cookie effacé
```

### Flux de citation aléatoire (avec filtres optionnels)

```text
Client Web -> GET /api/quotes/random?category=X&author=Y (cookie auto)
FastAPI    -> vérification JWT (cookie qk_token)
FastAPI    -> GET api.api-ninjas.com/v1/quotes (clé API côté serveur uniquement)
Client Web <- citation JSON
(si API Ninjas indisponible : FastAPI retourne une citation de la liste locale)
```

### Flux de citation du jour

```text
Client Web -> GET /api/quotes/daily (cookie auto)
FastAPI    -> si cache valide pour aujourd'hui -> retourne la citation en cache
FastAPI    -> sinon -> API Ninjas (ou sélection déterministe locale)
FastAPI    -> mise en cache mémoire pour la journée
Client Web <- citation JSON (identique pour tous les utilisateurs)
```

### Flux de l'assistant IA

```text
Client Web -> POST /api/ai/chat { message, historique } (cookie auto)
FastAPI    -> MongoDB (lecture des favoris de l'utilisateur)
FastAPI    -> Groq API (Llama 3.3) avec instruction système + contexte favoris + historique
Groq API  <- réponse texte
Client Web <- { "reponse": "..." }
```

### Flux d'ajout aux favoris

```text
Client Web -> POST /api/quotes/favorites/{id} (body JSON : citation complète, cookie auto)
FastAPI    -> vérification JWT, $set dans favorite_quotes MongoDB
Client Web <- confirmation JSON
```

### Flux de note personnelle sur un favori

```text
Client Web -> PATCH /api/quotes/favorites/{id}/note { note } (cookie auto)
FastAPI    -> vérification JWT, $set favorite_quotes.<id>.note
Client Web <- confirmation JSON
```

### Flux de modification du profil

```text
Client Web -> PUT /api/auth/profile { nom } (cookie auto)
FastAPI    -> vérification JWT, $set nom, $set modifie_le
Client Web <- { status: "success", nom: "nouveau nom" }
Client Web   met à jour l'affichage et localStorage.user (donnée publique uniquement)
```

### Flux de suppression de compte (RGPD)

```text
Client Web -> DELETE /api/auth/profile (cookie auto)
FastAPI    -> vérification JWT, suppression document users MongoDB
FastAPI    -> révocation JWT (revoked_tokens)
FastAPI    -> effacement cookie qk_token
Client Web <- { status: "success" } — redirection vers la page de connexion
```

### Flux d'export des données (RGPD)

```text
Client Web -> GET /api/auth/profile/export (cookie auto)
FastAPI    -> vérification JWT, lecture document users MongoDB
FastAPI    -> [AUDIT] log
Client Web <- JSON : id, nom, email, cree_le, modifie_le, favoris, notes, tags
```

### Flux de traduction

```text
Client Web -> GET /api/quotes/translate?texte=... (cookie auto)
FastAPI    -> GET api.mymemory.translated.net (service gratuit, sans clé)
Client Web <- texte traduit en français (JSON)
```

### Flux de secours

```text
Si l'API Ninjas est indisponible :
FastAPI utilise une liste locale de citations afin de maintenir le service
```

---

## 8. Modèle de données

### Collection `users`

```json
{
  "_id": "ObjectId",
  "nom": "Jean Dupont",
  "email": "jean@test.com",
  "mot_de_passe_hash": "pbkdf2_sha256$...",
  "google_id": "1234567890",
  "favorites": ["quote_123"],
  "favorite_quotes": {
    "quote_123": {
      "id": "quote_123",
      "text": "Citation...",
      "author": "Auteur",
      "category": "general",
      "note": "Ma note personnelle (optionnel)",
      "tag": "philosophie (optionnel)"
    }
  },
  "cree_le": "2026-01-15T10:30:00Z",
  "modifie_le": "2026-03-20T14:22:00Z"
}
```

Le champ `google_id` est absent pour les comptes email/mot de passe.
Le champ `mot_de_passe_hash` est `null` pour les comptes Google purs.

### Collection `otp_codes`

```json
{
  "_id": "jean@test.com",
  "code_hash": "sha256_du_code_a_6_chiffres",
  "expires_at": "2026-04-11T10:40:00Z",
  "tentatives": 0
}
```

Index TTL sur `expires_at` (`expireAfterSeconds=0`) — MongoDB supprime automatiquement à expiration.

### Collection `reset_codes`

Même structure que `otp_codes`. Index TTL sur `expires_at`.

### Collection `revoked_tokens`

```json
{
  "_id": "sha256_du_token_jwt",
  "expires_at": "2026-05-11T10:30:00Z"
}
```

Index TTL sur `expires_at` — nettoyage automatique des entrées expirées.

### Collection `quotes`

```json
{
  "_id": "ObjectId",
  "id": "quote_123",
  "text": "Citation...",
  "author": "Auteur",
  "category": "general",
  "cree_le": "2026-01-15T10:30:00Z",
  "modifie_le": "2026-01-15T10:30:00Z"
}
```

---

## 9. Mesures de sécurité

| Mesure | Description |
| ------ | ----------- |
| PBKDF2-SHA256 | Mots de passe jamais stockés en clair ; résistant à la force brute |
| JWT HS256 fixe | Algorithme non configurable — protection contre algorithm confusion |
| Cookie httpOnly | JWT inaccessible depuis JavaScript (protection XSS) |
| SameSite=Strict | Cookie non transmis depuis un site tiers (protection CSRF) |
| Révocation JWT | Liste noire MongoDB (TTL auto) + fallback mémoire |
| Rate limiting | 200 req/min global, 5/min register, 10/min login, 3/min OTP et reset |
| Anti-spam OTP | 60 secondes minimum entre deux demandes pour le même email |
| Expiration OTP | 10 minutes, 5 tentatives maximum |
| Hachage OTP | Codes OTP et reset jamais stockés en clair (SHA-256) |
| Headers sécurité | HSTS, X-Frame-Options: DENY, CSP, X-Content-Type-Options: nosniff |
| CORS strict | Origines explicites, jamais `*` avec `credentials: true` |
| Énumération masquée | `/password-reset/request` retourne toujours 200 |
| CSRF OAuth | Paramètre `state` signé HMAC-SHA256 sur le flux OAuth web |
| `email_verified` | Vérifié côté serveur avant d'accepter un compte Google |
| Audit logs | Connexion, changement MDP, export données, suppression compte |
| TLS / HTTPS | Certificat auto-signé mkcert — RSA 2048 bits, SHA-256 ; SAN : `localhost` + `127.0.0.1` ; validité : 14 avr. 2026 → 14 juil. 2028 ; CA locale installée via `mkcert -install` |
| Timeout fetch | AbortController 10 s sur le frontend web ; 30 s sur le mobile |
| SMTP en arrière-plan | `BackgroundTasks` FastAPI — réponse 200 immédiate, SMTP exécuté après ; évite les timeouts mobiles sur connexion Gmail lente |
| MongoDB pool | `maxPoolSize=50, minPoolSize=10` — robustesse sous charge |
| Datetimes UTC normalisés | `_aware()` convertit les datetimes naïfs retournés par MongoDB en UTC-aware avant comparaison avec `datetime.now(timezone.utc)` — évite les erreurs 500 sur l'anti-spam et l'expiration des codes |
| RGPD | Suppression de compte et export de données personnelles |

---

## 10. Installation et exécution

### Configuration requise

Le fichier `backend/.env` doit contenir (voir `backend/.env.example`) :

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=quote_keeper
SECRET_KEY=cle_hex_64_caracteres_generee_avec_secrets_token_hex_32
ACCESS_TOKEN_EXPIRE_MINUTES=10080
HOST=0.0.0.0
PORT=8000
RELOAD=False
ENV=development
NINJAS_API_KEY=votre_cle_api_ninjas
GROQ_API_KEY=votre_cle_api_groq
GOOGLE_CLIENT_ID=votre_client_id
GOOGLE_CLIENT_SECRET=votre_client_secret
GOOGLE_REDIRECT_URI=https://localhost:8000/api/auth/google/callback
FRONTEND_URL=https://localhost:5500
CORS_ORIGINS=https://localhost:5500,https://127.0.0.1:5500
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=votre.email@gmail.com
SMTP_PASSWORD=mot_de_passe_application_gmail
DEMO_EMAIL=demo@test.com
DEMO_PASSWORD=demo123
```

`ACCESS_TOKEN_EXPIRE_MINUTES=10080` correspond à 7 jours — recommandé pour éviter les déconnexions forcées sur mobile.

### Certificat TLS auto-signé (mkcert)

Le portail web et le backend utilisent HTTPS. Le certificat est généré avec **mkcert**, un outil qui crée une autorité de certification locale (CA) reconnue par le navigateur, évitant les avertissements de sécurité liés aux certificats auto-signés classiques.

| Propriété | Valeur |
| --------- | ------ |
| Outil | mkcert |
| Algorithme de clé | RSA 2048 bits |
| Signature | SHA-256 avec RSA (`sha256WithRSAEncryption`) |
| SAN (Subject Alternative Names) | `DNS:localhost`, `IP:127.0.0.1` |
| Validité | 14 avril 2026 → 14 juillet 2028 |
| Émetteur | `mkcert development CA` (CA locale, non publique) |
| Ports couverts | 8000 (backend HTTPS), 5500 (frontend HTTPS) |
| Port mobile | 8001 — HTTP simple, pas de certificat requis |

Génération du certificat :

```powershell
mkcert -install                          # installe la CA locale dans le magasin du navigateur
cd backend
mkdir certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1
```

> Ce certificat est destiné au développement local uniquement. En production, il faudrait le remplacer par un certificat signé par une CA publique (Let's Encrypt, Sectigo, etc.).

### Démarrage du backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

### Démarrage du frontend

Le portail web est servi automatiquement par `run.py` sur `https://localhost:5500`.

### URLs utiles

| URL | Description |
| --- | ----------- |
| `https://localhost:5500` | Portail web |
| `https://localhost:8000/api/docs` | Swagger UI |
| `https://localhost:8000/api/redoc` | ReDoc |
| `https://localhost:8000/api/health` | État du service |

---

## 11. Démonstration de la persistance MongoDB

### Procédure de validation

1. créer un compte utilisateur
2. se connecter
3. récupérer une citation aléatoire
4. ajouter la citation aux favoris avec une note personnelle
5. ajouter éventuellement une citation personnalisée
6. recharger l'application ou se reconnecter
7. vérifier que les favoris et notes sont toujours présents

### Vérification dans MongoDB Compass

Ouvrir :

- la base `quote_keeper`
- la collection `users` — favoris et notes stockés dans `favorite_quotes`
- la collection `quotes` — citations persistées
- la collection `otp_codes` — codes OTP avec TTL (si OTP utilisé)
- la collection `revoked_tokens` — tokens révoqués avec TTL (après déconnexion)

La présence des documents prouve la persistance réelle des données.

---

## 12. Tests manuels effectués

- inscription d'un nouvel utilisateur (email/mot de passe)
- inscription via Google OAuth 2.0
- connexion par code OTP (sans mot de passe)
- connexion avec un utilisateur existant
- vérification du cookie `qk_token` dans les outils développeurs (httpOnly, SameSite=Strict)
- vérification de la session au rechargement (cookie envoyé automatiquement)
- génération d'une citation aléatoire depuis le service externe
- filtrage des citations par catégorie et par auteur
- affichage de la citation du jour
- traduction d'une citation en français (MyMemory)
- copie d'une citation dans le presse-papier
- ajout d'une citation aux favoris
- ajout d'une note personnelle sur un favori
- modification et suppression d'une note
- ajout et suppression d'un tag sur un favori
- suppression d'une citation favorite
- affichage des favoris après reconnexion
- navigation par pages dans les favoris (pagination)
- recherche dans les favoris (texte, auteur, tag)
- ajout d'une citation personnalisée
- utilisation de l'assistant IA (chat libre, recommandation selon humeur, analyse des favoris)
- navigation via la barre latérale du portail
- modification du nom sur la page profil
- changement du mot de passe sur la page profil
- réinitialisation du mot de passe (portail web) : flux complet en 3 étapes (email → code 6 chiffres → nouveau MDP → connexion avec le nouveau MDP) confirmé fonctionnel
- bouton "Modifier l'email" dans le flux reset : retour à l'étape 1 avec email pré-rempli
- réinitialisation du mot de passe (application mobile) : même flux en 3 étapes confirmé fonctionnel sur appareil physique (iOS)
- export des données personnelles (GET /profile/export)
- suppression de compte (DELETE /profile)
- bascule dark mode / light mode (persistance au rechargement)
- vérification de la persistance dans MongoDB Compass
- timeout fetch : déconnexion du réseau → message d'erreur après 10 secondes

---

## 13. Captures d'écran à fournir

- page de connexion (mode clair et mode sombre)
- page d'inscription
- page principale avec citation du jour et filtres (layout portail)
- page principale avec citation traduite
- page principale avec plusieurs favoris et pagination
- page de l'assistant IA avec conversation
- page de profil (section RGPD visible)
- terminal du backend en fonctionnement
- Swagger UI (tous les endpoints)
- ReDoc
- MongoDB Compass avec les collections `users`, `otp_codes`, `revoked_tokens`
- outils développeurs du navigateur — cookie `qk_token` httpOnly visible

---

## 14. Conformité du projet

### Exigences satisfaites

- service web FastAPI fonctionnel
- portail web HTML/CSS/JS avec appels AJAX
- MongoDB connecté et persistance active
- services externes intégrés (API Ninjas, MyMemory, Groq, Google OAuth 2.0, Gmail SMTP)
- authentification JWT sécurisée (cookie httpOnly pour web, Bearer pour mobile)
- réponses en JSON
- gestion des favoris avec notes et tags personnels
- assistant IA littéraire contextualisé
- documentation technique disponible (Swagger, ReDoc)
- flux d'information identifiés
- consignes d'installation rédigées
- conformité RGPD (suppression de compte, export des données)

### Éléments à finaliser pour la remise

- ajouter les captures d'écran définitives
- appliquer la mise en page finale du document
- relire la cohérence visuelle et orthographique du rapport

---

## 15. Application mobile (labo 4)

L'application mobile QuoteKeeper est développée avec React Native et Expo SDK 54. Elle reproduit toutes les fonctionnalités du portail web et se connecte au même service FastAPI.

### Technologies

- React Native 0.81.5 avec Expo SDK 54
- React Navigation v6 (Stack + Bottom Tabs)
- expo-secure-store (stockage sécurisé du JWT — clés alphanumériques uniquement)
- Context API : AuthContext (session), ThemeContext (dark mode)
- Hooks personnalisés : useApi, useQuote, useFavorites

### Fonctionnalités

- inscription et connexion par email/mot de passe
- connexion Google OAuth 2.0 (via expo-auth-session, code échangé côté serveur)
- connexion par code OTP et réinitialisation de MDP
- récupération de la citation aléatoire avec filtres par catégorie et auteur
- citation du jour
- traduction en français (MyMemory via le backend)
- copie dans le presse-papier
- ajout et suppression de favoris
- notes et tags personnels sur les favoris
- liste des favoris paginée (8 par page)
- modification du nom et du mot de passe sur la page profil
- mode sombre / clair persisté

### Endpoints mobiles disponibles

```javascript
ENDPOINTS = {
  register, login, logout, profile,
  profilePassword, profileSetPassword,
  profileDelete, profileExport,        // RGPD
  otpRequest, otpVerify,
  passwordResetRequest, passwordResetVerify,
  aiChat, aiAnalyze, aiRecommend,
  random, daily, translate,
  favorites, favoriteById,
  favoriteNote, favoriteTag
}
```

### Architecture mobile

```text
Application React Native (Expo Go)
          |
          | requêtes HTTP/JSON (fetch + Authorization: Bearer)
          | token JWT stocké dans expo-secure-store
          v
Service web FastAPI (port 8001 HTTP — même backend que le portail web)
```

### Lancement

```bash
# Terminal 1 — backend (depuis le dossier backend/)
python run.py

# Terminal 2 — application mobile
cd mobile && npx expo start
```

Voir `mobile/README.md` pour les instructions complètes (appareil physique, émulateur, tunnel).

### Critères satisfaits (labo 4)

| Critère | Détail |
| ------- | ------ |
| Technologie React Native + Expo Go | Expo SDK 54, testé sur appareil physique |
| Interface fonctionnelle | 4 onglets : Accueil, Favoris, Chat IA, Profil |
| Appels réseau (fetch) | 15+ endpoints utilisés avec jeton JWT |
| Stockage sécurisé | expo-secure-store (clés alphanumériques validées) |
| Instructions d'installation | `mobile/README.md` |
| Commentaires dans le code | JSDoc sur chaque fichier source |

---

## 16. Conclusion

QuoteKeeper respecte l'architecture attendue d'une application web moderne séparée entre un frontend et un backend. Le projet met en évidence la communication réseau entre le client web, le service FastAPI, MongoDB et cinq services externes (API Ninjas, MyMemory, Google OAuth 2.0, Groq API, Gmail SMTP).

Le portail web offre une interface complète de type tableau de bord avec barre latérale de navigation, topbar par page, grille dashboard et mode sombre. L'assistant IA littéraire (Llama 3.3 via Groq) enrichit l'expérience en permettant d'analyser les favoris, d'obtenir des recommandations personnalisées et de dialoguer librement sur les citations et la littérature.

Le projet illustre des notions importantes de sécurité : hachage PBKDF2-SHA256, JWT HS256 avec cookie httpOnly SameSite=Strict, OAuth 2.0 avec vérification CSRF, révocation de tokens via liste noire MongoDB, rate limiting, codes OTP hachés avec TTL automatique, headers de sécurité HTTP et conformité RGPD (suppression et export de données). La robustesse du code est assurée par la normalisation des datetimes MongoDB (`_aware()`) pour éviter les incompatibilités entre datetimes naïfs et timezone-aware, et par l'utilisation de `BackgroundTasks` FastAPI pour les envois SMTP — la réponse HTTP est retournée immédiatement sans attendre la connexion TLS Gmail, ce qui élimine les timeouts côté mobile. Le flux de réinitialisation de mot de passe (3 étapes, anti-spam, anti-énumération, navigation retour) est confirmé fonctionnel sur le portail web et sur l'application mobile (appareil physique). Ces mesures s'appliquent tant au portail web qu'à l'application mobile React Native, tout en maintenant un mode démonstration fonctionnel lorsque MongoDB est indisponible.
