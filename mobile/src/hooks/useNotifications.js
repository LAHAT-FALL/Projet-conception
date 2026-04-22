/**
 * Hook pour la gestion des notifications quotidiennes de citation du jour.
 * Utilise expo-notifications pour planifier une notification locale chaque jour.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE_NOTIF = 'qk_notifications_activees';
const CLE_HEURE = 'qk_notifications_heure';
const HEURE_DEFAUT = 8; // 8h00 du matin

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const [activees, setActivees] = useState(false);
  const [heure, setHeure] = useState(HEURE_DEFAUT);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const valActivees = await AsyncStorage.getItem(CLE_NOTIF);
        const valHeure = await AsyncStorage.getItem(CLE_HEURE);
        setActivees(valActivees === 'true');
        if (valHeure) setHeure(parseInt(valHeure, 10));
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  const demanderPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }, []);

  const planifier = useCallback(async (heureNotif) => {
    // Annuler toutes les notifications existantes de l'app
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Planifier une notification récurrente chaque jour à l'heure choisie
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✨ Citation du jour',
        body: 'Votre citation quotidienne vous attend dans QuoteKeeper !',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: heureNotif,
        minute: 0,
      },
    });
  }, []);

  const activer = useCallback(async (heureNotif = heure) => {
    const permise = await demanderPermission();
    if (!permise) throw new Error('Permission de notification refusée.');
    await planifier(heureNotif);
    await AsyncStorage.setItem(CLE_NOTIF, 'true');
    await AsyncStorage.setItem(CLE_HEURE, String(heureNotif));
    setActivees(true);
    setHeure(heureNotif);
  }, [heure, demanderPermission, planifier]);

  const desactiver = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(CLE_NOTIF, 'false');
    setActivees(false);
  }, []);

  const changerHeure = useCallback(async (nouvelleHeure) => {
    setHeure(nouvelleHeure);
    if (activees) {
      await planifier(nouvelleHeure);
      await AsyncStorage.setItem(CLE_HEURE, String(nouvelleHeure));
    }
  }, [activees, planifier]);

  return { activees, heure, chargement, activer, desactiver, changerHeure };
}
