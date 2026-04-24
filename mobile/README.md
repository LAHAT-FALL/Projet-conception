# QuoteKeeper Mobile

Application mobile React Native pour [QuoteKeeper](../README.md), développée avec Expo SDK 54.
Elle reproduit toutes les fonctionnalités de l'application web et se connecte au même backend FastAPI.
## auteur de l`application: lahat fall 
---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 18+ |
| npm | 9+ |
| Expo Go (téléphone) | SDK 54 |
| Backend QuoteKeeper | en cours d'exécution |

---

## Installation

```bash
cd mobile
npm install --legacy-peer-deps
```

---

## Configuration

Créez le fichier `mobile/.env` (non commité) :

```env
# URL du backend — choisissez selon votre environnement (voir tableau ci-dessous)
EXPO_PUBLIC_API_URL=http://<IP_LAN_MACHINE>:8001/api

# Client ID Google OAuth 2.0 (console.cloud.google.com)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
```

| Environnement | Valeur de `EXPO_PUBLIC_API_URL` |
|---------------|--------------------------------|
| Appareil physique (même Wi-Fi) | `http://<IP_LAN>:8001/api` |
| Appareil physique (hotspot iPhone) | `http://172.20.10.1:8001/api` |
| Émulateur Android | `http://10.0.2.2:8001/api` |
| Simulateur iOS | `http://localhost:8001/api` |

> Le mobile se connecte sur le **port 8001 (HTTP)** — pas besoin de certificat TLS.
> Le port 8000 (HTTPS) est réservé au navigateur web.

> Après toute modification du fichier `.env`, redémarrez Metro avec `npx expo start --clear`.

---

## Lancement

### Sur appareil physique (recommandé)

```bash
npx expo start
```

Scannez le QR code avec **Expo Go** (Android) ou l'**Appareil photo** (iOS).

Le téléphone et le PC doivent être sur le même réseau (Wi-Fi ou hotspot).

Pour trouver l'IP de votre machine :

```powershell
ipconfig   # chercher l'adresse IPv4 de l'interface active
```

### Sur émulateur Android

```bash
npx expo start --android
```

### Sur simulateur iOS (macOS uniquement)

```bash
npx expo start --ios
```

### En cas de port occupé

```bash
npx kill-port 8081
npx expo start
```

---

## Structure du projet

```
mobile/
├── App.js                              # Point d'entrée — providers + navigation
├── app.json                            # Configuration Expo (SDK 54)
├── package.json
├── .env                                # Variables d'environnement (non commité)
└── src/
    ├── constants/
    │   ├── api.js                      # BASE_URL et tous les endpoints
    │   └── theme.js                    # Tokens de couleur clair / sombre
    ├── contexts/
    │   ├── AuthContext.js              # Session JWT, login / inscription / déconnexion
    │   └── ThemeContext.js             # Dark mode persisté (AsyncStorage)
    ├── hooks/
    │   ├── useApi.js                   # fetch() avec Authorization automatique
    │   ├── useQuote.js                 # Citation aléatoire, du jour, traduction
    │   ├── useFavorites.js             # CRUD favoris, pagination, notes
    │   └── useNotifications.js         # Notification quotidienne planifiée (expo-notifications)
    ├── navigation/
    │   ├── AppNavigator.js             # Aiguillage auth ↔ app principale
    │   ├── AuthStack.js                # Login → Register / OTP / ForgotPassword
    │   └── MainTabs.js                 # Barre flottante : Accueil/Favoris/Chat/Profil
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.js          # Connexion email/MDP + email pré-rempli post-reset
    │   │   ├── RegisterScreen.js       # Inscription
    │   │   ├── OtpScreen.js            # Connexion sans mot de passe (code email)
    │   │   └── ForgotPasswordScreen.js # Réinitialisation MDP par code email (3 étapes)
    │   └── main/
    │       ├── HomeScreen.js           # Citation du jour + aléatoire + filtres
    │       ├── FavoritesScreen.js      # Liste paginée avec notes
    │       ├── ChatScreen.js           # Assistant IA (Groq Llama 3.3)
    │       └── ProfileScreen.js        # Nom, mot de passe, dark mode, notifications, déconnexion
    └── components/
        ├── QuoteCard.js                # Carte citation : favori, traduire, copier
        ├── FavoriteItem.js             # Ligne favori avec modal de note
        ├── FilterBar.js                # Filtre par catégorie et auteur
        ├── Pagination.js               # Contrôles Précédent / Suivant
        ├── Toast.js                    # Notification éphémère animée
        └── LoadingSpinner.js           # Indicateur de chargement
```

---

## Fonctionnalités

| Fonctionnalité | Écran |
|----------------|-------|
| Inscription email/mot de passe | Register |
| Connexion email/mot de passe | Login |
| Connexion sans mot de passe (OTP) | OTP |
| Mot de passe oublié — 3 étapes (email → code 6 chiffres → nouveau MDP) | ForgotPassword |
| Citation aléatoire avec filtres | Accueil |
| Citation du jour | Accueil |
| Traduire en français (MyMemory) | Accueil |
| Copier dans le presse-papier | Accueil |
| Ajouter / retirer des favoris | Accueil |
| Liste des favoris paginée (8/page) | Favoris |
| Notes personnelles sur les favoris | Favoris |
| Recherche dans les favoris | Favoris |
| Chat avec l'assistant IA | Chat |
| Recommandations selon l'humeur | Chat |
| Analyse des favoris par l'IA | Chat |
| Modifier le nom d'affichage | Profil |
| Changer le mot de passe | Profil |
| Mode sombre / clair persisté | Profil |
| Notification quotidienne planifiée (heure configurable) | Profil |
| Déconnexion | Profil |

---

## Flux mot de passe oublié

```
Login → "Oublié ?"
  ↓
Étape 1 — Email
  POST /api/auth/password-reset/request { email }
  → réponse 200 immédiate (SMTP en arrière-plan)
  → code à 6 chiffres reçu par email
  → timer 60 s avant renvoi, anti-spam 60 s, expiration 10 min
  ↓
Étape 2 — Code + Nouveau mot de passe
  POST /api/auth/password-reset/verify { email, code, nouveau_mot_de_passe }
  → vérification SHA-256 + mise à jour MDP en une seule requête
  ↓
Étape 3 — Succès → Se connecter
  → navigation vers Login avec email pré-rempli
```

Mêmes endpoints que le portail web (anti-énumération, anti-spam, hachage SHA-256 côté serveur).

---

## Endpoints utilisés

| Constante | Endpoint | Description |
|-----------|----------|-------------|
| `ENDPOINTS.login` | `POST /auth/login` | Connexion |
| `ENDPOINTS.register` | `POST /auth/register` | Inscription |
| `ENDPOINTS.logout` | `POST /auth/logout` | Déconnexion |
| `ENDPOINTS.profile` | `GET/PUT /auth/profile` | Profil |
| `ENDPOINTS.profilePassword` | `PUT /auth/profile/password` | Changer MDP |
| `ENDPOINTS.profileSetPassword` | `PUT /auth/profile/set-password` | Définir MDP post-OTP connexion |
| `ENDPOINTS.otpRequest` | `POST /auth/otp/request` | Demander code OTP (connexion) |
| `ENDPOINTS.otpVerify` | `POST /auth/otp/verify` | Vérifier code OTP (connexion) |
| `ENDPOINTS.passwordResetRequest` | `POST /auth/password-reset/request` | Demander code de réinitialisation MDP |
| `ENDPOINTS.passwordResetVerify` | `POST /auth/password-reset/verify` | Vérifier code + définir nouveau MDP |
| `ENDPOINTS.random` | `GET /quotes/random` | Citation aléatoire |
| `ENDPOINTS.daily` | `GET /quotes/daily` | Citation du jour |
| `ENDPOINTS.translate` | `GET /quotes/translate` | Traduction |
| `ENDPOINTS.favorites` | `GET /quotes/favorites` | Liste favoris |
| `ENDPOINTS.favoriteById(id)` | `POST/DELETE /quotes/favorites/{id}` | Ajouter/retirer |
| `ENDPOINTS.favoriteNote(id)` | `PATCH /quotes/favorites/{id}/note` | Modifier note |
| `ENDPOINTS.favoriteTag(id)` | `PATCH /quotes/favorites/{id}/tag` | Modifier tag |
| `ENDPOINTS.aiChat` | `POST /ai/chat` | Chat IA |
| `ENDPOINTS.aiAnalyze` | `POST /ai/analyze` | Analyse favoris |
| `ENDPOINTS.aiRecommend` | `POST /ai/recommend` | Recommandations |

---

## Dépendances principales

| Package | Version | Usage |
|---------|---------|-------|
| expo | ~54.0.0 | Framework mobile |
| react-native | 0.81.5 | Runtime natif |
| @react-navigation/native | ^6.1.18 | Navigation |
| @react-navigation/bottom-tabs | ^6.6.1 | Onglets |
| @react-navigation/native-stack | ^6.11.0 | Stack d'écrans |
| expo-secure-store | ~14.0.0 | Stockage sécurisé du JWT |
| @react-native-async-storage/async-storage | 2.2.0 | Persistance thème |
| expo-clipboard | ~8.0.8 | Copier dans le presse-papier |
| expo-notifications | ~0.32.16 | Notifications locales quotidiennes |
| @expo/vector-icons | ^15.0.3 | Icônes Ionicons |

---

## Notes techniques

- **Port 8001 (HTTP)** : le mobile utilise le port HTTP du backend — le certificat mkcert auto-signé (RSA 2048 bits, SHA-256) émis pour `localhost`/`127.0.0.1` n'est pas reconnu par le téléphone physique. Le backend lance automatiquement un second serveur HTTP non-TLS sur le port `8001` dédié au mobile.
- **JWT sécurisé** : le token est stocké dans `expo-secure-store` (chiffrement matériel). La clé de stockage doit être alphanumérique (`.`, `-`, `_` autorisés) — les caractères spéciaux comme `@` provoquent une erreur à l'exécution.
- **Expiration JWT** : configurée à 7 jours (`ACCESS_TOKEN_EXPIRE_MINUTES=10080`) pour éviter les déconnexions forcées sur mobile.
- **Timeout réseau** : tous les appels API utilisent un `AbortController` (30 secondes) via la fonction `fetchTimeout` — un message d'erreur explicite s'affiche si le délai est dépassé.
- **SMTP en arrière-plan** : les endpoints `/password-reset/request` et `/otp/request` retournent 200 immédiatement (FastAPI `BackgroundTasks`) — l'envoi Gmail peut prendre plusieurs secondes sans bloquer la réponse ni déclencher le timeout mobile.
- **Champs mot de passe** : tous les `TextInput` de type password ont `autoCorrect={false}` et `autoCapitalize="none"` — indispensable quand l'icône œil révèle le texte en clair, car iOS activerait alors l'autocorrection et modifierait silencieusement la valeur.
- **Email pré-rempli après reset** : à l'étape 3 de ForgotPassword, le bouton "Se connecter" transmet l'email via `navigation.navigate('Login', { email })` — LoginScreen lit ce paramètre via `route.params` pour éviter une ressaisie inutile.
- **Chat — accès à la barre de navigation** : la `FlatList` du chat utilise `keyboardDismissMode="on-drag"` — faire défiler vers le haut dans la conversation ferme le clavier et rend la barre flottante accessible.
- **Thème** : persisté dans AsyncStorage sous la clé `@qk_theme`.
- **Pas de CORS** : React Native utilise des clients HTTP natifs (OkHttp / NSURLSession), pas un navigateur. Aucune modification CORS n'est nécessaire pour le mobile.
- **Barre de navigation flottante** : positionnée en `absolute` (bottom 24, hauteur 70). Les écrans principaux ont un `paddingBottom: 110` pour que le contenu ne soit pas masqué.
- **KeyboardAvoidingView** : le chat utilise `behavior: 'padding'` (iOS) / `'height'` (Android) avec `keyboardVerticalOffset: 94` (iOS) aligné sur la hauteur de la barre flottante.
- **Bundle Expo** : après modification de `.env` ou d'un fichier source, relancer Metro avec `npx expo start --clear` et rescanner le QR code pour obtenir un bundle frais (le fast refresh ne recharge pas les variables d'environnement).
