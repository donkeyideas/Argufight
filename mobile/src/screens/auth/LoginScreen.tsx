import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTheme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Separator } from '../../components/ui/Separator';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { BASE_URL } from '../../api/client';

/** Generate a random poll ID */
function randomId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/** Poll the server for the OAuth result */
async function pollForToken(pollId: string, maxAttempts = 15): Promise<{ token: string; user: any } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(`${BASE_URL}/api/auth/google/mobile-poll?id=${encodeURIComponent(pollId)}`);
      if (res.status === 200) {
        return await res.json();
      }
    } catch {}
  }
  return null;
}

export function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { setToken, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);

    try {
      const data = await authApi.login(email.trim(), password);

      if (data.requires2FA) {
        Alert.alert('2FA Required', 'Two-factor authentication is required.');
        return;
      }

      if (data.token && data.user) {
        await setToken(data.token);
        setUser(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError('');
    try {
      // Generate a unique poll ID so we can retrieve the token from the server
      const pollId = randomId();
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'argufight', path: 'auth' });
      const authUrl = `${BASE_URL}/api/auth/google?returnTo=${encodeURIComponent(redirectUri)}&pollId=${encodeURIComponent(pollId)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      // Try to extract token from the redirect URL (works if redirect succeeded)
      let gotToken = false;
      if (result.type === 'success' && result.url) {
        try {
          const qsIndex = result.url.indexOf('?');
          if (qsIndex !== -1) {
            const params = new URLSearchParams(result.url.substring(qsIndex));
            const token = params.get('token');
            if (token) {
              await setToken(token);
              const userData = await authApi.me();
              if (userData.user) {
                setUser(userData.user);
              }
              gotToken = true;
            }
          }
        } catch {}
      }

      // Fallback: poll the server for the token (works even if redirect didn't)
      if (!gotToken) {
        const pollResult = await pollForToken(pollId);
        if (pollResult?.token) {
          await setToken(pollResult.token);
          if (pollResult.user) {
            setUser(pollResult.user);
          } else {
            const userData = await authApi.me();
            if (userData.user) setUser(userData.user);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={18} color={colors.text2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <Text style={[styles.logo, { color: colors.text }]}>
            Argu<Text style={{ fontWeight: '600', color: colors.accent }}>fight</Text>
          </Text>

          <Text style={[styles.title, { color: colors.text }]}>Sign in</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            Welcome back. Enter your credentials to continue.
          </Text>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.redMuted, borderColor: colors.red + '4D' }]}>
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            </View>
          ) : null}

          {/* Google only */}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={googleLoading}
            onPress={handleGoogleLogin}
          >
            Continue with Google
          </Button>

          <Separator text="or" />

          {/* Form */}
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword
                  ? <EyeOff size={16} color={colors.text3} />
                  : <Eye size={16} color={colors.text3} />
                }
              </TouchableOpacity>
            }
          />

          <Button
            variant="accent"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleLogin}
          >
            Sign in
          </Button>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotBtn}
          >
            <Text style={[styles.forgotText, { color: colors.text3 }]}>
              Forgot your password?
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text3 }]}>
              No account?{' '}
            </Text>
            <Text
              style={[styles.footerLink, { color: colors.accent }]}
              onPress={() => navigation.navigate('Signup')}
            >
              Create one
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingBottom: 60 },
  logo: {
    fontSize: 19,
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 32,
  },
  title: { fontSize: 22, fontWeight: '500', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 28 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13 },
  forgotBtn: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 20,
  },
  footerText: { fontSize: 13 },
  footerLink: { fontSize: 13, fontWeight: '500' },
});
