/**
 * Composant Toast — notification ephemere (succes ou erreur).
 * Usage : const toastRef = useRef(); toastRef.current.afficher('msg')
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

const Toast = forwardRef(function Toast(_, ref) {
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState(false);
  const opacite = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    afficher(msg, estErreur = false) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setErreur(estErreur);
      Animated.timing(opacite, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timerRef.current = setTimeout(() => {
        Animated.timing(opacite, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }, 3000);
    },
  }));

  return (
    <Animated.View style={[styles.toast, erreur && styles.toastErreur, { opacity: opacite }]}>
      <Text style={styles.texte}>{message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#48bb78',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
  },
  toastErreur: {
    backgroundColor: '#f56565',
  },
  texte: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default Toast;
