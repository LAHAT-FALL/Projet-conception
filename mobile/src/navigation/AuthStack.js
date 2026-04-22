import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const { theme } = useTheme();
  const c = theme.couleurs;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.textePrincipal,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.fond },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Créer un compte' }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Code email' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
