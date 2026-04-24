/**
 * Contexte de theme (clair / sombre).
 * Persiste le choix dans AsyncStorage sous la cle '@qk_theme'.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../constants/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(lightTheme);

  // Chargement du theme sauvegarde au demarrage
  useEffect(() => {
    AsyncStorage.getItem('@qk_theme').then((valeur) => {
      if (valeur === 'dark') setTheme(darkTheme);
    });
  }, []);

  function basculerTheme() {
    const nouveauTheme = theme.sombre ? lightTheme : darkTheme;
    setTheme(nouveauTheme);
    AsyncStorage.setItem('@qk_theme', nouveauTheme.sombre ? 'dark' : 'light');
  }

  return (
    <ThemeContext.Provider value={{ theme, basculerTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook pour acceder au theme courant dans n'importe quel composant */
export function useTheme() {
  return useContext(ThemeContext);
}
