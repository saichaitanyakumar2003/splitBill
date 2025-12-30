import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, register, loginWithGoogle, skipLogin } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.back),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Clear error when user types
  const handleEmailChange = (text) => {
    setEmail(text);
    if (apiError) setApiError(null);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (apiError) setApiError(null);
  };

  const handleEmailLogin = async () => {
    // Clear any previous error
    setApiError(null);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setApiError('Please enter your email address');
      return;
    }
    if (!emailRegex.test(email)) {
      setApiError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setApiError('Please enter your password');
      return;
    }

    if (!isLogin) {
      // Registration validations
      if (!name || name.trim().length === 0) {
        setApiError('Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setApiError('Password must be at least 6 characters long');
        return;
      }
      if (!confirmPassword) {
        setApiError('Please confirm your password');
        return;
      }
      if (password !== confirmPassword) {
        setApiError('Passwords do not match. Please check and try again.');
        return;
      }
    }

    setIsLoading(true);
    
    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        result = await register(email, password, name);
      }

      if (result.success) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        // Show specific error messages from backend
        setApiError(result.message || 'Authentication failed. Please try again.');
      }
    } catch (error) {
      setApiError('Unable to connect to server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // TODO: Implement Google OAuth with Expo AuthSession
    setApiError('Google OAuth requires setting up Google Cloud Console credentials. Configure GOOGLE_CLIENT_ID in your backend .env file.');
  };

  const handleAppleLogin = () => {
    // Placeholder for Apple Sign In
    setApiError('Apple Sign In will be integrated soon!');
  };

  const handleSkip = async () => {
    await skipLogin();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <Animated.View 
              style={[
                styles.logoContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>
                  <Text style={styles.logoS}>S</Text>
                  <Text style={styles.logoB}>B</Text>
                </Text>
              </View>
              <Text style={styles.appName}>SplitBill</Text>
              <Text style={styles.tagline}>Split smart. Pay fair.</Text>
            </Animated.View>

            {/* Login/Signup Card */}
            <Animated.View 
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Tab Toggle */}
              <View style={styles.tabContainer}>
                <Pressable
                  style={[styles.tab, isLogin && styles.activeTab]}
                  onPress={() => { 
                    setIsLogin(true); 
                    setApiError(null);
                    setEmail('');
                    setPassword('');
                    setName('');
                    setConfirmPassword('');
                    setShowPassword(false);
                  }}
                >
                  <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, !isLogin && styles.activeTab]}
                  onPress={() => { 
                    setIsLogin(false); 
                    setApiError(null);
                    setEmail('');
                    setPassword('');
                    setName('');
                    setConfirmPassword('');
                    setShowPassword(false);
                  }}
                >
                  <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
                </Pressable>
              </View>

              {/* Name Input (Sign Up only) */}
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#999"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              )}

              {/* Error Message */}
              {apiError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorEmoji}>😅</Text>
                  <View style={styles.errorContent}>
                    <Text style={styles.errorTitle}>Oops!</Text>
                    <Text style={styles.errorMessage}>{apiError}</Text>
                  </View>
                  <Pressable 
                    style={styles.errorClose}
                    onPress={() => setApiError(null)}
                  >
                    <Text style={styles.errorCloseText}>✕</Text>
                  </Pressable>
                </View>
              )}

              {/* Email Input */}
              <View style={[styles.inputContainer, apiError && styles.inputContainerError]}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View>
                <View style={[
                  styles.inputContainer, 
                  apiError && styles.inputContainerError,
                  !isLogin && password && password.length < 6 && styles.inputContainerError
                ]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={isLogin ? "Password" : "Password (min 6 characters)"}
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </Pressable>
                </View>
                {!isLogin && password && password.length < 6 && (
                  <Text style={styles.validationError}>Password must be at least 6 characters</Text>
                )}
              </View>

              {/* Confirm Password (Sign Up only) */}
              {!isLogin && (
                <View>
                  <View style={[
                    styles.inputContainer,
                    confirmPassword && password !== confirmPassword && styles.inputContainerError,
                    confirmPassword && password === confirmPassword && password.length >= 6 && styles.inputContainerSuccess
                  ]}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor="#999"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                    {confirmPassword && password === confirmPassword && password.length >= 6 && (
                      <Text style={styles.matchIcon}>✓</Text>
                    )}
                  </View>
                  {confirmPassword && password !== confirmPassword && (
                    <Text style={styles.validationError}>Passwords do not match</Text>
                  )}
                  {confirmPassword && password === confirmPassword && password.length >= 6 && (
                    <Text style={styles.validationSuccess}>✓ Passwords match</Text>
                  )}
                </View>
              )}

              {/* Login/Signup Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleEmailLogin}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
                </Text>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth Buttons */}
              <View style={styles.oauthContainer}>
                {/* Google Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.oauthButton,
                    pressed && styles.oauthButtonPressed,
                  ]}
                  onPress={handleGoogleLogin}
                >
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={styles.oauthButtonText}>Google</Text>
                </Pressable>

                {/* Apple Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.oauthButton,
                    styles.appleButton,
                    pressed && styles.appleButtonPressed,
                  ]}
                  onPress={handleAppleLogin}
                >
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.appleButtonText}>Apple</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Skip Button */}
            <Animated.View style={{ opacity: fadeAnim }}>
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip for now →</Text>
              </Pressable>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
  },
  logoS: {
    color: '#FF6B35',
  },
  logoB: {
    color: '#E64A19',
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 16,
    width: '100%',
    maxWidth: 380,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 3,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  eyeButton: {
    padding: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  eyeIcon: {
    fontSize: 18,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  primaryButtonPressed: {
    backgroundColor: '#E65100',
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#888',
  },
  oauthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  oauthButtonPressed: {
    backgroundColor: '#F5F5F5',
    transform: [{ scale: 0.98 }],
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  googleG: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  oauthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  appleButtonPressed: {
    backgroundColor: '#333',
  },
  appleIcon: {
    fontSize: 16,
    color: '#FFF',
    marginRight: 6,
  },
  appleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  skipText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  // Error Container
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C53030',
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 13,
    color: '#742A2A',
    lineHeight: 18,
  },
  errorClose: {
    padding: 4,
    marginLeft: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  errorCloseText: {
    fontSize: 16,
    color: '#C53030',
    fontWeight: '600',
  },
  inputContainerError: {
    borderColor: '#E53E3E',
    borderWidth: 1.5,
  },
  inputContainerSuccess: {
    borderColor: '#38A169',
    borderWidth: 1.5,
  },
  validationError: {
    fontSize: 12,
    color: '#E53E3E',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 14,
    fontWeight: '500',
  },
  validationSuccess: {
    fontSize: 12,
    color: '#38A169',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 14,
    fontWeight: '500',
  },
  matchIcon: {
    fontSize: 18,
    color: '#38A169',
    fontWeight: '700',
    marginRight: 8,
  },
});
