import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTheme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Separator } from '../../components/ui/Separator';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { BASE_URL } from '../../api/client';

export function SignupScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { setToken, setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    if (!username.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const data = await authApi.signup(username.trim(), email.trim(), password);
      if (data.token && data.user) {
        await setToken(data.token);
        setUser(data.user);
      } else {
        const loginData = await authApi.login(email.trim(), password);
        if (loginData.token && loginData.user) {
          await setToken(loginData.token);
          setUser(loginData.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError('');
    try {
      // Generate a unique poll ID so we can retrieve the token from the server
      const pollId = Math.random().toString(36).substring(2) + Date.now().toString(36);
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
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const res = await fetch(`${BASE_URL}/api/auth/google/mobile-poll?id=${encodeURIComponent(pollId)}`);
            if (res.status === 200) {
              const data = await res.json();
              if (data.token) {
                await setToken(data.token);
                if (data.user) {
                  setUser(data.user);
                } else {
                  const userData = await authApi.me();
                  if (userData.user) setUser(userData.user);
                }
                gotToken = true;
                break;
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google sign up failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
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
          <Text style={[styles.logo, { color: colors.text }]}>
            Argu<Text style={{ fontWeight: '600', color: colors.accent }}>fight</Text>
          </Text>

          <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            Join the arena. Start debating today.
          </Text>

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
            onPress={handleGoogleSignup}
          >
            Continue with Google
          </Button>

          <Separator text="or" />

          {/* Form */}
          <Input
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
          />
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
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <Button
            variant="accent"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleSignup}
          >
            Create account
          </Button>

          <Text style={[styles.terms, { color: colors.text3 }]}>
            By signing up you agree to our Terms and Privacy Policy
          </Text>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text3 }]}>
              Already have an account?{' '}
            </Text>
            <Text
              style={[styles.footerLink, { color: colors.accent }]}
              onPress={() => navigation.navigate('Login')}
            >
              Sign in
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
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingBottom: 60 },
  logo: { fontSize: 19, fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: '500', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 28 },
  errorBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  errorText: { fontSize: 13 },
  terms: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 32, paddingBottom: 20 },
  footerText: { fontSize: 13 },
  footerLink: { fontSize: 13, fontWeight: '500' },
});
