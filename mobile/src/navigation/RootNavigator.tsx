import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Linking } from 'react-native';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import { useTheme } from '../theme';
import { registerForPushNotifications } from '../utils/notifications';

/** Extract token from an auth callback URL (exp://...?token=...&success=true) */
function extractAuthToken(url: string): string | null {
  try {
    // Handle exp:// URLs by extracting query string after '?'
    const qsIndex = url.indexOf('?');
    if (qsIndex === -1) return null;
    const params = new URLSearchParams(url.substring(qsIndex));
    if (params.get('success') === 'true' && params.get('token')) {
      return params.get('token');
    }
  } catch {}
  return null;
}

export function RootNavigator() {
  const { colors } = useTheme();
  const { token, isAuthenticated, isLoading, loadStoredToken, setUser, setToken, clearAuth } = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  // Handle incoming deep link auth callbacks (Google OAuth redirect)
  useEffect(() => {
    async function handleAuthUrl(url: string) {
      const authToken = extractAuthToken(url);
      if (!authToken) return;
      try {
        await setToken(authToken);
        const data = await authApi.me();
        if (data.user) {
          setUser(data.user);
          registerForPushNotifications().catch(() => {});
        } else {
          await clearAuth();
        }
      } catch {
        await clearAuth();
      }
    }

    // Check if the app was opened with an auth URL
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    // Listen for auth URLs while the app is running
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function init() {
      const storedToken = await loadStoredToken();
      if (storedToken) {
        try {
          // Validate the stored token with the server
          const data = await authApi.me();
          if (data.user) {
            await setToken(storedToken);
            setUser(data.user);
            // Register for push notifications after successful auth
            registerForPushNotifications().catch(() => {});
          } else {
            await clearAuth();
          }
        } catch {
          await clearAuth();
        }
      }
      setInitializing(false);
    }
    init();
  }, []);

  if (initializing || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}
