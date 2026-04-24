/**
 * Configuration de l'URL de base de l'API QuoteKeeper.
 *
 * Les valeurs sont lues depuis les variables d'environnement Expo (préfixe EXPO_PUBLIC_).
 * Copiez mobile/.env.example en mobile/.env et remplissez vos valeurs.
 *
 * Changer EXPO_PUBLIC_API_URL selon l'environnement :
 *   - Émulateur Android  : http://10.0.2.2:8001/api
 *   - Simulateur iOS     : http://localhost:8001/api
 *   - Appareil physique  : http://<IP_LAN_MACHINE>:8001/api  (ex: 192.168.1.42:8001)
 *
 * Le port 8001 (HTTP) est le serveur mobile lancé par run.py.
 * Le port 8000 (HTTPS) est réservé au navigateur web.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8001/api';

export const ENDPOINTS = {
  // Authentification
  register:        `${BASE_URL}/auth/register`,
  login:           `${BASE_URL}/auth/login`,
  logout:          `${BASE_URL}/auth/logout`,
  profile:         `${BASE_URL}/auth/profile`,
  profilePassword:    `${BASE_URL}/auth/profile/password`,
  profileSetPassword: `${BASE_URL}/auth/profile/set-password`,
  profileDelete:      `${BASE_URL}/auth/profile`,
  profileExport:      `${BASE_URL}/auth/profile/export`,
  otpRequest:           `${BASE_URL}/auth/otp/request`,
  otpVerify:            `${BASE_URL}/auth/otp/verify`,
  passwordResetRequest: `${BASE_URL}/auth/password-reset/request`,
  passwordResetVerify:  `${BASE_URL}/auth/password-reset/verify`,
  aiChat:          `${BASE_URL}/ai/chat`,
  aiAnalyze:       `${BASE_URL}/ai/analyze`,
  aiRecommend:     `${BASE_URL}/ai/recommend`,

  // Citations
  random:          `${BASE_URL}/quotes/random`,
  daily:           `${BASE_URL}/quotes/daily`,
  translate:       `${BASE_URL}/quotes/translate`,
  favorites:       `${BASE_URL}/quotes/favorites`,
  favoriteById:    (id) => `${BASE_URL}/quotes/favorites/${id}`,
  favoriteNote:    (id) => `${BASE_URL}/quotes/favorites/${id}/note`,
  favoriteTag:     (id) => `${BASE_URL}/quotes/favorites/${id}/tag`,
};
