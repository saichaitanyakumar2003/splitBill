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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Required for web browser auth to complete
WebBrowser.maybeCompleteAuthSession();

// Google OAuth - Use Web Client ID for all platforms (browser-based flow)
// This works on Android, iOS, and Web without needing separate client IDs or SHA-1 fingerprints
const GOOGLE_WEB_CLIENT_ID = '543880175096-lftcjh1p2nv2k66ver4ch7pq5qdee40v.apps.googleusercontent.com';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, register, loginWithGoogle, forgotPassword } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // Forgot password state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // Track touched fields for validation display
  const [touchedFields, setTouchedFields] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Google OAuth Setup
  // Note: Google SSO is only available on Web. Android/iOS users should use email login.
  // We provide the web client ID for all platforms to satisfy the hook requirements,
  // but Google SSO button is only enabled on web.
  const isGoogleSSOAvailable = Platform.OS === 'web';
  
  // Use web client ID for all platforms - the hook requires androidClientId/iosClientId
  // but we disable the button on non-web platforms anyway
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_WEB_CLIENT_ID, // Required to prevent crash, but won't work for actual auth
    iosClientId: GOOGLE_WEB_CLIENT_ID,     // Required to prevent crash, but won't work for actual auth
    selectAccount: true,
    scopes: ['profile', 'email'],
  });

  // Debug: Log OAuth request state (only on web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    console.log('🔐 ===== GOOGLE OAUTH DEBUG =====');
    console.log('🔐 Request Ready:', !!request);
    console.log('🔐 Platform:', Platform.OS);
    console.log('🔐 Web Client ID:', GOOGLE_WEB_CLIENT_ID);
    if (request) {
      console.log('🔐 Full Request URL:', request.url);
      console.log('🔐 Redirect URI:', request.redirectUri);
      console.log('🔐 Code Challenge:', request.codeChallenge);
      console.log('🔐 Scopes:', request.scopes);
    }
    console.log('🔐 ================================');
  }, [request]);

  // Handle Google OAuth Response
  useEffect(() => {
    if (!response) return;
    
    console.log('🔐 Google OAuth Response Type:', response?.type);
    
    if (response?.type === 'success') {
      console.log('✅ Google OAuth Success!');
      handleGoogleAuthSuccess(response.authentication);
    } else if (response?.type === 'error') {
      setIsGoogleLoading(false);
      console.error('❌ Google OAuth Error:', response.error?.message || response.error?.code);
      // User-friendly error message
      setApiError('Google SSO is not authorized for this app. Please use email login instead.');
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setIsGoogleLoading(false);
      // User cancelled - no error message needed
    }
  }, [response]);

  // Process Google Auth Success
  const handleGoogleAuthSuccess = async (authentication) => {
    try {
      // Get the ID token from the authentication response
      const idToken = authentication?.idToken;
      
      const mode = isLogin ? 'login' : 'signup';
      let result;

      if (idToken) {
        // Call backend with ID token (preferred)
        result = await loginWithGoogle(idToken, mode);
      } else {
        // If no ID token, try to get user info with access token
        const accessToken = authentication?.accessToken;
        if (accessToken) {
          // Fetch user info from Google
          const userInfoResponse = await fetch(
            'https://www.googleapis.com/userinfo/v2/me',
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const userInfo = await userInfoResponse.json();
          
          if (userInfo.email) {
            // Call backend with user info
            result = await loginWithGoogle(null, mode, userInfo);
          } else {
            setApiError('Failed to get user info from Google.');
            setIsGoogleLoading(false);
            return;
          }
        } else {
          setApiError('Google authentication failed. No token received.');
          setIsGoogleLoading(false);
          return;
        }
      }

      if (result.success) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setApiError(result.message || 'Google authentication failed.');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      setApiError('Failed to complete Google sign in. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };
  const [showSplash, setShowSplash] = useState(true);

  // Input refs for Enter key navigation
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  // Splash Animation Values
  const splashLogoScale = useRef(new Animated.Value(1.5)).current; // Start bigger
  const splashLogoRotate = useRef(new Animated.Value(0)).current; // For spin effect
  const splashOpacity = useRef(new Animated.Value(1)).current;
  
  // Form Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Splash Animation Sequence
    Animated.sequence([
      // Phase 1: Logo spins 360° fast in center
      Animated.parallel([
        Animated.timing(splashLogoRotate, {
          toValue: 2, // Two full rotations (720°)
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(splashLogoScale, {
          toValue: 1, // Scale down to normal while spinning
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: Brief pause
      Animated.delay(200),
      // Phase 3: Fade out splash
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After splash animation, show form
      setShowSplash(false);
      
      // Animate form elements
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
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

  // Mark field as touched on blur
  const handleFieldBlur = (field) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  // Validation helper functions
  const isNameValid = () => name && name.trim().length > 0;
  const isEmailValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email && emailRegex.test(email);
  };
  const isPasswordValid = () => password && password.length >= 6;
  const isConfirmPasswordValid = () => confirmPassword && password === confirmPassword;

  // Check if form is complete for signup
  const isSignupFormValid = () => {
    return isNameValid() && isEmailValid() && isPasswordValid() && isConfirmPasswordValid();
  };

  const handleEmailLogin = async () => {
    // Clear any previous error
    setApiError(null);
    
    // Mark all fields as touched to show validation errors
    setTouchedFields({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    
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
    setApiError(null);
    
    // Check if Google SSO is available on this platform
    if (!isGoogleSSOAvailable) {
      setApiError('Google SSO is only available on web. Please use email login on mobile.');
      return;
    }
    
    // Check if OAuth request is ready
    if (!request) {
      setApiError('Google SSO is not available. Please use email login instead.');
      return;
    }
    
    setIsGoogleLoading(true);
    
    // Set a timeout - if no response in 120 seconds, show error
    const timeoutId = setTimeout(() => {
      setIsGoogleLoading(false);
      setApiError('Google SSO request timed out. Please try again or use email login.');
    }, 120000);
    
    try {
      const result = await promptAsync();
      clearTimeout(timeoutId);
      
      // Handle different result types immediately
      if (result?.type === 'error') {
        setIsGoogleLoading(false);
        setApiError('Google SSO failed. Please use email login.');
      } else if (result?.type === 'dismiss' || result?.type === 'cancel') {
        setIsGoogleLoading(false);
      } else if (result?.type !== 'success') {
        setIsGoogleLoading(false);
        setApiError('Google SSO is not authorized. Please use email login instead.');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setIsGoogleLoading(false);
      setApiError('Google SSO is not authorized. Please use email login instead.');
    }
  };

  // Interpolate rotation (2 full rotations = 720°)
  const spin = splashLogoRotate.interpolate({
    inputRange: [0, 2],
    outputRange: ['0deg', '720deg'],
  });

  // Forgot password handler - directly sends to the email in login form
  const handleForgotPassword = async () => {
    // Validate email from login form
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setApiError('Please enter your email address first');
      return;
    }
    if (!emailRegex.test(email)) {
      setApiError('Please enter a valid email address');
      return;
    }

    setIsSendingReset(true);
    setApiError(null);

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setResetEmailSent(true);
        setShowForgotPasswordModal(true);
      } else {
        setApiError(result.message || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      setApiError('Network error. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setResetEmailSent(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Splash Screen Overlay */}
        {showSplash && (
          <Animated.View 
            style={[
              styles.splashOverlay,
              { opacity: splashOpacity }
            ]}
            pointerEvents="none"
          >
            <Animated.View
              style={[
                styles.splashLogoContainer,
                {
                  transform: [
                    { scale: splashLogoScale },
                    { rotate: spin },
                  ],
                },
              ]}
            >
              <View style={styles.splashLogoCircle}>
                <Text style={styles.splashLogoText}>
                  <Text style={styles.splashLogoS}>S</Text>
                  <Text style={styles.splashLogoB}>B</Text>
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
        )}
        
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
              <View style={[styles.tabContainer, (isLoading || isGoogleLoading || isSendingReset) && styles.tabContainerDisabled]}>
                <Pressable
                  style={[styles.tab, isLogin && styles.activeTab]}
                  onPress={() => { 
                    if (isLoading || isGoogleLoading || isSendingReset) return;
                    setIsLogin(true); 
                    setApiError(null);
                    setEmail('');
                    setPassword('');
                    setName('');
                    setConfirmPassword('');
                    setShowPassword(false);
                    setTouchedFields({ name: false, email: false, password: false, confirmPassword: false });
                  }}
                  disabled={isLoading || isGoogleLoading || isSendingReset}
                >
                  <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, !isLogin && styles.activeTab]}
                  onPress={() => { 
                    if (isLoading || isGoogleLoading || isSendingReset) return;
                    setIsLogin(false); 
                    setApiError(null);
                    setEmail('');
                    setPassword('');
                    setName('');
                    setConfirmPassword('');
                    setShowPassword(false);
                    setTouchedFields({ name: false, email: false, password: false, confirmPassword: false });
                  }}
                  disabled={isLoading || isGoogleLoading || isSendingReset}
                >
                  <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
                </Pressable>
              </View>

              {/* Required Fields Note (Sign Up only) */}
              {!isLogin && (
                <View style={styles.requiredNote}>
                  <Text style={styles.requiredNoteText}>
                    <Text style={styles.requiredAsterisk}>*</Text> indicates required fields
                  </Text>
                </View>
              )}

              {/* Error Message */}
              {apiError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorEmoji}>😔</Text>
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

              {/* Name Input (Sign Up only) */}
              {!isLogin && (
                <View>
                  <View style={[
                    styles.inputContainer,
                    touchedFields.name && !isNameValid() && styles.inputContainerError
                  ]}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      ref={nameInputRef}
                      style={styles.input}
                      placeholder="Full Name *"
                      placeholderTextColor="#999"
                      value={name}
                      onChangeText={(text) => {
                        setName(text);
                        if (apiError) setApiError(null);
                      }}
                      onBlur={() => handleFieldBlur('name')}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                    {name && name.trim().length > 0 && (
                      <Text style={styles.matchIcon}>✓</Text>
                    )}
                  </View>
                  {touchedFields.name && !isNameValid() && (
                    <Text style={styles.validationError}>Full name is required</Text>
                  )}
                </View>
              )}

              {/* Email Input */}
              <View>
                <View style={[
                  styles.inputContainer, 
                  touchedFields.email && !isEmailValid() && styles.inputContainerError,
                  touchedFields.email && isEmailValid() && styles.inputContainerSuccess
                ]}>
                  <Text style={styles.inputIcon}>📧</Text>
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    placeholder={isLogin ? "Email address" : "Email address *"}
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={handleEmailChange}
                    onBlur={() => handleFieldBlur('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                  {email && isEmailValid() && (
                    <Text style={styles.matchIcon}>✓</Text>
                  )}
                </View>
                {touchedFields.email && !email && !isLogin && (
                  <Text style={styles.validationError}>Email is required</Text>
                )}
                {touchedFields.email && email && !isEmailValid() && (
                  <Text style={styles.validationError}>Please enter a valid email address</Text>
                )}
              </View>

              {/* Password Input */}
              <View>
                <View style={[
                  styles.inputContainer, 
                  touchedFields.password && !isLogin && !isPasswordValid() && styles.inputContainerError,
                  touchedFields.password && !isLogin && isPasswordValid() && styles.inputContainerSuccess
                ]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder={isLogin ? "Password" : "Password (min 6 characters) *"}
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={() => handleFieldBlur('password')}
                    secureTextEntry={!showPassword}
                    returnKeyType={isLogin ? "done" : "next"}
                    onSubmitEditing={isLogin ? handleEmailLogin : () => confirmPasswordInputRef.current?.focus()}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </Pressable>
                  {!isLogin && password && password.length >= 6 && (
                    <Text style={styles.matchIcon}>✓</Text>
                  )}
                </View>
                {!isLogin && touchedFields.password && !password && (
                  <Text style={styles.validationError}>Password is required</Text>
                )}
                {!isLogin && password && password.length > 0 && password.length < 6 && (
                  <Text style={styles.validationError}>Password must be at least 6 characters</Text>
                )}
              </View>

              {/* Confirm Password (Sign Up only) */}
              {!isLogin && (
                <View>
                  <View style={[
                    styles.inputContainer,
                    touchedFields.confirmPassword && !confirmPassword && styles.inputContainerError,
                    confirmPassword && password !== confirmPassword && styles.inputContainerError,
                    confirmPassword && password === confirmPassword && password.length >= 6 && styles.inputContainerSuccess
                  ]}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={styles.input}
                      placeholder="Confirm Password *"
                      placeholderTextColor="#999"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (apiError) setApiError(null);
                      }}
                      onBlur={() => handleFieldBlur('confirmPassword')}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleEmailLogin}
                    />
                    {confirmPassword && password === confirmPassword && password.length >= 6 && (
                      <Text style={styles.matchIcon}>✓</Text>
                    )}
                  </View>
                  {touchedFields.confirmPassword && !confirmPassword && (
                    <Text style={styles.validationError}>Please confirm your password</Text>
                  )}
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
                  pressed && !isLoading && !isGoogleLoading && !isSendingReset && styles.primaryButtonPressed,
                  (isLoading || isGoogleLoading || isSendingReset) && styles.buttonDisabled,
                ]}
                onPress={handleEmailLogin}
                disabled={isLoading || isGoogleLoading || isSendingReset}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
                </Text>
              </Pressable>

              {/* Forgot Password Link - Only show on Login */}
              {isLogin && (
                <Pressable
                  style={styles.forgotPasswordLink}
                  onPress={handleForgotPassword}
                  disabled={isLoading || isGoogleLoading || isSendingReset}
                >
                  {isSendingReset ? (
                    <View style={styles.forgotPasswordLoading}>
                      <ActivityIndicator size="small" color="#FF6B35" />
                      <Text style={styles.forgotPasswordText}>Sending...</Text>
                    </View>
                  ) : (
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  )}
                </Pressable>
              )}

              {/* Divider */}
              {/* Google SSO - Web only */}
              {Platform.OS === 'web' && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or continue with</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.googleSSOButton,
                      pressed && !isLoading && !isGoogleLoading && !isSendingReset && styles.googleSSOButtonPressed,
                      (isGoogleLoading || isLoading || isSendingReset) && styles.googleSSOButtonDisabled,
                    ]}
                    onPress={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading || isSendingReset || !request}
                  >
                    {isGoogleLoading ? (
                      <>
                        <ActivityIndicator size="small" color="#4285F4" style={{ marginRight: 10 }} />
                        <Text style={styles.googleSSOText}>Connecting to Google...</Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.googleLogoWrap}>
                          <Svg width={20} height={20} viewBox="0 0 48 48">
                            <Path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            />
                            <Path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            />
                            <Path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            />
                            <Path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            />
                          </Svg>
                        </View>
                        <Text style={styles.googleSSOText}>{isLogin ? 'Login with Google SSO' : 'Sign up with Google SSO'}</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </Animated.View>


          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* Forgot Password Success Modal */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={closeForgotPasswordModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeForgotPasswordModal}>
          <Pressable style={styles.forgotPasswordModal} onPress={(e) => e.stopPropagation()}>
            {/* Close button */}
            <Pressable style={styles.modalCloseButton} onPress={closeForgotPasswordModal}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>

            {/* Success state */}
            <View style={styles.forgotPasswordHeader}>
              <View style={[styles.forgotPasswordIconCircle, styles.successIconCircle]}>
                <Ionicons name="checkmark-circle" size={40} color="#38A169" />
              </View>
              <Text style={styles.forgotPasswordTitle}>Check Your Email!</Text>
              <Text style={styles.forgotPasswordSubtitle}>
                If an account exists for {email}, we've sent a temporary password. Please check your inbox (and spam folder).
              </Text>
            </View>

            <View style={styles.forgotPasswordInstructions}>
              <Text style={styles.instructionsTitle}>Next Steps:</Text>
              <Text style={styles.instructionsText}>1. Check your email for the temporary password</Text>
              <Text style={styles.instructionsText}>2. Login with the temporary password</Text>
              <Text style={styles.instructionsText}>3. Go to View Profile to change password</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.forgotPasswordButton,
                pressed && styles.forgotPasswordButtonPressed,
              ]}
              onPress={closeForgotPasswordModal}
            >
              <Text style={styles.forgotPasswordButtonText}>Back to Login</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  // Splash Screen Styles
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  splashLogoContainer: {
    alignItems: 'center',
  },
  splashLogoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  splashLogoText: {
    fontSize: 46,
    fontWeight: '800',
  },
  splashLogoS: {
    color: '#FF6B35',
  },
  splashLogoB: {
    color: '#E64A19',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: Platform.OS === 'web' ? 60 : 30,
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
  tabContainerDisabled: {
    opacity: 0.6,
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
    overflow: 'hidden',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    minWidth: 0,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  eyeButton: {
    padding: 8,
    flexShrink: 0,
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
  // Google SSO Button
  googleSSOButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  googleSSOButtonPressed: {
    backgroundColor: '#F5F5F5',
    transform: [{ scale: 0.98 }],
  },
  googleSSOButtonDisabled: {
    opacity: 0.7,
  },
  googleLogoWrap: {
    marginRight: 10,
  },
  googleSSOText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
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
    marginLeft: 4,
    flexShrink: 0,
  },
  requiredNote: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  requiredNoteText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  requiredAsterisk: {
    color: '#E53E3E',
    fontWeight: '700',
    fontStyle: 'normal',
  },
  // Forgot Password Link
  forgotPasswordLink: {
    alignSelf: 'center',
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  forgotPasswordLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Forgot Password Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  forgotPasswordModal: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  forgotPasswordHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgotPasswordIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconCircle: {
    backgroundColor: '#F0FFF4',
  },
  forgotPasswordTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  forgotPasswordSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  forgotPasswordButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  forgotPasswordButtonPressed: {
    backgroundColor: '#E65100',
    transform: [{ scale: 0.98 }],
  },
  forgotPasswordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  forgotPasswordInstructions: {
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38A169',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 13,
    color: '#276749',
    lineHeight: 22,
  },
});
