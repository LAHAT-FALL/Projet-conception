/**
 * Système de design QuoteKeeper — palette professionnelle.
 * Inspiré des meilleures pratiques de design mobile (Linear, Notion, Stripe).
 */

const ombre = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const ombreFaible = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
};

export const lightTheme = {
  sombre: false,
  ombre,
  ombreFaible,
  couleurs: {
    // Fonds
    fond:            '#F8FAFD',
    surface:         '#FFFFFF',
    surfaceAlt:      '#F1F5FB',
    surfaceElevee:   '#FFFFFF',

    // Palette principale — Indigo
    primaire:        '#5B6EF5',
    primaireDark:    '#4758E8',
    primaireLight:   '#EEF0FE',

    // Accents
    secondaire:      '#0EA5E9',
    succes:          '#10B981',
    danger:          '#EF4444',
    dangerLight:     '#FEF2F2',
    avertissement:   '#F59E0B',
    avertissementLight: '#FFFBEB',

    // Texte
    textePrincipal:  '#0F172A',
    texteSecondaire: '#64748B',
    texteTertiaire:  '#94A3B8',
    texteInverse:    '#FFFFFF',

    // Bordures
    bordure:         '#E8EDF4',
    bordureFocale:   '#5B6EF5',

    // Navigation
    tabBar:          '#FFFFFF',
    tabBarBordure:   '#E8EDF4',

    // Spécial
    noteFond:        '#FFFBEB',
    noteBordure:     '#FDE68A',
    gradient1:       '#5B6EF5',
    gradient2:       '#8B5CF6',
  },
};

export const darkTheme = {
  sombre: true,
  ombre: {
    ...ombre,
    shadowOpacity: 0.3,
  },
  ombreFaible: {
    ...ombreFaible,
    shadowOpacity: 0.2,
  },
  couleurs: {
    // Fonds
    fond:            '#080C18',
    surface:         '#111827',
    surfaceAlt:      '#1C2333',
    surfaceElevee:   '#1C2333',

    // Palette principale
    primaire:        '#7C8CF8',
    primaireDark:    '#6366F1',
    primaireLight:   '#1E2550',

    // Accents
    secondaire:      '#38BDF8',
    succes:          '#34D399',
    danger:          '#F87171',
    dangerLight:     '#2D1515',
    avertissement:   '#FBBF24',
    avertissementLight: '#2D2208',

    // Texte
    textePrincipal:  '#F1F5F9',
    texteSecondaire: '#94A3B8',
    texteTertiaire:  '#64748B',
    texteInverse:    '#FFFFFF',

    // Bordures
    bordure:         '#1E2A3A',
    bordureFocale:   '#7C8CF8',

    // Navigation
    tabBar:          '#111827',
    tabBarBordure:   '#1E2A3A',

    // Spécial
    noteFond:        '#1C1A08',
    noteBordure:     '#78570A',
    gradient1:       '#4338CA',
    gradient2:       '#7C3AED',
  },
};
