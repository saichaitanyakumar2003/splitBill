import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper function to get initials (max 2 characters)
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    // First letter of first name + first letter of last name
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  // Just first 2 letters of the name
  return name.substring(0, 2).toUpperCase();
};

// Eye Icon Component
const EyeIcon = ({ visible }) => (
  <View style={styles.eyeIconSvg}>
    {visible ? (
      // Eye Open Icon
      <View style={styles.eyeOpen}>
        <View style={styles.eyeOutline} />
        <View style={styles.eyePupil} />
      </View>
    ) : (
      // Eye Closed Icon
      <View style={styles.eyeClosed}>
        <View style={styles.eyeOutline} />
        <View style={styles.eyeSlash} />
      </View>
    )}
  </View>
);

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, updateProfile, changePassword, changeEmail, isLoading: authLoading } = useAuth();
  
  // Check if user signed up with OAuth (no password)
  const isOAuthUser = user?.oauth_provider === 'google' || user?.oauth_provider === 'apple';
  
  // State from user context or defaults
  const [userName, setUserName] = useState(user?.name || 'User');
  const [email, setEmail] = useState(user?.mailId || '');
  const [newEmail, setNewEmail] = useState('');
  const [mobile, setMobile] = useState(user?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false); // For OAuth users setting password first time
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState(null);

  // Update state when user data changes
  useEffect(() => {
    if (user) {
      setUserName(user.name || 'User');
      setEmail(user.mailId || '');
      // Clean phone number - only digits
      const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
      setMobile(cleanPhone);
    }
  }, [user]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  const handleSave = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    
    // Validate phone number
    if (mobile && mobile.length !== 10) {
      return; // Error already shown inline
    }
    
    setIsSaving(true);
    try {
      const result = await updateProfile({
        name: userName,
        phone: mobile,
      });
      
      if (result.success) {
        setIsEditing(false);
        setProfileSuccess('Profile updated!');
        setTimeout(() => setProfileSuccess(null), 2000);
      } else {
        setProfileError(result.message || 'Failed to update profile');
      }
    } catch (error) {
      setProfileError('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if password form is valid for enabling save button
  const isPasswordFormValid = () => {
    return (
      newPassword.length >= 6 &&
      confirmNewPassword.length > 0 &&
      newPassword === confirmNewPassword
    );
  };

  // Check if email is valid
  const isValidEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Handle email save
  const handleSaveEmail = async () => {
    setEmailError(null);
    setEmailSuccess(null);
    
    if (!newEmail.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    if (!isValidEmail(newEmail.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (newEmail.toLowerCase().trim() === email.toLowerCase()) {
      setEmailError('New email must be different from current email');
      return;
    }
    
    setIsSavingEmail(true);
    try {
      const result = await changeEmail(newEmail.trim());
      
      if (result.success) {
        setEmail(newEmail.trim().toLowerCase());
        setIsEditingEmail(false);
        setNewEmail('');
        setEmailSuccess('Email updated successfully!');
        setTimeout(() => setEmailSuccess(null), 3000);
      } else {
        setEmailError(result.message || 'Failed to update email');
      }
    } catch (error) {
      setEmailError('Something went wrong');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const resetPasswordForm = () => {
    setIsChangingPassword(false);
    setIsSettingPassword(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPassword(false);
    setApiError(null);
    setSuccessMessage(null);
  };

  const handleChangePassword = async () => {
    // Double check validation (button should already be disabled if invalid)
    if (!isPasswordFormValid()) {
      return;
    }

    setIsSaving(true);
    setApiError(null);
    setSuccessMessage(null);
    
    try {
      const result = await changePassword(null, newPassword);
      
      if (result.success) {
        const message = isSettingPassword 
          ? 'Password set successfully! 🎉' 
          : 'Password changed successfully! 🎉';
        setSuccessMessage(message);
        // Reset form after a short delay to show success message
        setTimeout(() => {
          resetPasswordForm();
        }, 2000);
      } else {
        // Show inline error instead of alert
        setApiError(result.message || 'Failed to change password');
      }
    } catch (error) {
      setApiError('Oops! Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const maskPassword = (length = 8) => {
    return '•'.repeat(length);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable 
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]} 
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {({ pressed }) => (
              <Text style={[styles.backIcon, pressed && { opacity: 0.7 }]}>{Platform.OS === 'web' ? '←' : '<'}</Text>
            )}
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Photo Section */}
          <Animated.View
            style={[
              styles.photoSection,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.photoContainer}>
              <View style={styles.photoWrapper}>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitials}>
                    {getInitials(userName)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Profile Info Card */}
          <Animated.View
            style={[
              styles.infoCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Profile Error/Success Messages */}
            {profileError && (
              <View style={styles.apiErrorContainer}>
                <Text style={styles.apiErrorEmoji}>😅</Text>
                <Text style={styles.apiErrorMessage}>{profileError}</Text>
              </View>
            )}
            {profileSuccess && (
              <View style={styles.successContainer}>
                <Text style={styles.successEmoji}>✓</Text>
                <Text style={styles.successMessageText}>{profileSuccess}</Text>
              </View>
            )}

            {/* Username Field with Edit Button */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderWithEdit}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldIcon}>👤</Text>
                  <Text style={styles.fieldLabel}>User Name</Text>
                </View>
                <TouchableOpacity
                  style={[styles.editButtonInline, isEditing && styles.editButtonActive]}
                  onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
                  disabled={isSaving || (isEditing && mobile.length > 0 && mobile.length !== 10)}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FF6B35" />
                  ) : (
                    <Text style={[styles.editButtonInlineText, isEditing && styles.editButtonActiveText]}>
                      {isEditing ? 'Save' : 'Edit'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                />
              ) : (
                <Text style={styles.fieldValue}>{userName || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.fieldDivider} />

            {/* Email Field */}
            <View style={styles.fieldContainer}>
              {/* Email Error/Success Messages */}
              {emailError && (
                <View style={styles.apiErrorContainer}>
                  <Text style={styles.apiErrorEmoji}>😅</Text>
                  <Text style={styles.apiErrorMessage}>{emailError}</Text>
                </View>
              )}
              {emailSuccess && (
                <View style={styles.successContainer}>
                  <Text style={styles.successEmoji}>✓</Text>
                  <Text style={styles.successMessageText}>{emailSuccess}</Text>
                </View>
              )}
              
              <View style={styles.fieldHeaderWithEdit}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldIcon}>📧</Text>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                </View>
                {!isEditingEmail ? (
                  <TouchableOpacity
                    style={styles.editButtonInline}
                    onPress={() => {
                      setIsEditingEmail(true);
                      setNewEmail(email);
                      setEmailError(null);
                    }}
                  >
                    <Text style={styles.editButtonInlineText}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              
              {isEditingEmail ? (
                <View>
                  <TextInput
                    style={[styles.fieldInput, emailError && styles.fieldInputError]}
                    value={newEmail}
                    onChangeText={(text) => {
                      setNewEmail(text);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="Enter new email address"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldHint}>Your old email will be stored for reference</Text>
                  
                  <View style={styles.passwordActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsEditingEmail(false);
                        setNewEmail('');
                        setEmailError(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.savePasswordButton,
                        (isSavingEmail || !newEmail.trim() || !isValidEmail(newEmail.trim())) && styles.savePasswordButtonDisabled
                      ]}
                      onPress={handleSaveEmail}
                      disabled={isSavingEmail || !newEmail.trim() || !isValidEmail(newEmail.trim())}
                    >
                      {isSavingEmail ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={[
                          styles.savePasswordButtonText,
                          (!newEmail.trim() || !isValidEmail(newEmail.trim())) && styles.savePasswordButtonTextDisabled
                        ]}>Save Email</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.fieldValue}>{email || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.fieldDivider} />

            {/* Mobile Field */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldIcon}>📱</Text>
                <Text style={styles.fieldLabel}>Phone Number</Text>
              </View>
              {isEditing ? (
                <View>
                  <TextInput
                    style={[styles.fieldInput, mobile.length > 0 && mobile.length !== 10 && styles.fieldInputError]}
                    value={mobile}
                    onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, '').slice(0, 10))}
                    placeholder="Enter 10 digit phone number"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  {mobile.length > 0 && mobile.length !== 10 && (
                    <Text style={styles.errorText}>Phone number must be exactly 10 digits ({mobile.length}/10)</Text>
                  )}
                  {mobile.length === 10 && (
                    <Text style={styles.successText}>✓ Valid phone number</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.fieldValue}>{mobile || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.fieldDivider} />

            {/* Password Section */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderWithEdit}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldIcon}>🔒</Text>
                  <Text style={styles.fieldLabel}>Password</Text>
                </View>
                {!isChangingPassword && !isSettingPassword && (
                  <TouchableOpacity
                    style={styles.editButtonInline}
                    onPress={() => {
                      if (isOAuthUser) {
                        setIsSettingPassword(true);
                      } else {
                        setIsChangingPassword(true);
                      }
                    }}
                  >
                    <Text style={styles.editButtonInlineText}>
                      {isOAuthUser ? 'Set Password' : 'Change'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {(isChangingPassword || isSettingPassword) ? (
                <View>
                  {/* API Error Message */}
                  {apiError && (
                    <View style={styles.apiErrorContainer}>
                      <Text style={styles.apiErrorEmoji}>😅</Text>
                      <View style={styles.apiErrorContent}>
                        <Text style={styles.apiErrorTitle}>Oops!</Text>
                        <Text style={styles.apiErrorMessage}>{apiError}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.apiErrorClose}
                        onPress={() => setApiError(null)}
                      >
                        <Text style={styles.apiErrorCloseText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Success Message */}
                  {successMessage && (
                    <View style={styles.successContainer}>
                      <Text style={styles.successEmoji}>🎉</Text>
                      <Text style={styles.successMessageText}>{successMessage}</Text>
                    </View>
                  )}
                  
                  {/* OAuth user info */}
                  {isSettingPassword && (
                    <View style={styles.oauthInfoContainer}>
                      <Text style={styles.oauthInfoText}>
                        You signed up with Google. Set a password to also login with email.
                      </Text>
                    </View>
                  )}
                  
                  {/* New Password */}
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        newPassword && newPassword.length < 6 && styles.fieldInputError
                      ]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder={isSettingPassword ? "Create password (min 6 characters)" : "New password (min 6 characters)"}
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                    />
                    {newPassword && newPassword.length < 6 && (
                      <Text style={styles.errorText}>Password must be at least 6 characters</Text>
                    )}
                  </View>
                  
                  {/* Confirm New Password */}
                  <View style={[styles.passwordInputWrapper, { marginTop: 12 }]}>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        confirmNewPassword && newPassword !== confirmNewPassword && styles.fieldInputError
                      ]}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                    />
                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                      <Text style={styles.errorText}>Passwords do not match</Text>
                    )}
                    {confirmNewPassword && newPassword === confirmNewPassword && newPassword.length >= 6 && (
                      <Text style={styles.successText}>✓ Passwords match</Text>
                    )}
                  </View>
                  
                  {/* Show/Hide Password Toggle */}
                  <TouchableOpacity
                    style={styles.showPasswordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.showPasswordText}>
                      {showPassword ? '🙈 Hide passwords' : '👁️ Show passwords'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Password Action Buttons */}
                  <View style={styles.passwordActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={resetPasswordForm}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.savePasswordButton, 
                        (isSaving || !isPasswordFormValid()) && styles.savePasswordButtonDisabled
                      ]}
                      onPress={handleChangePassword}
                      disabled={isSaving || !isPasswordFormValid()}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={[
                          styles.savePasswordButtonText,
                          !isPasswordFormValid() && styles.savePasswordButtonTextDisabled
                        ]}>Save Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={[styles.fieldValue, styles.passwordValue]}>
                  {isOAuthUser ? 'Not set' : maskPassword(8)}
                </Text>
              )}
              
              {!isChangingPassword && !isSettingPassword && (
                <Text style={styles.fieldHint}>
                  {isOAuthUser 
                    ? 'Signed in with Google. Set a password for email login.' 
                    : 'Password is securely encrypted'}
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Version Info */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>SplitBill v1.0.0</Text>
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 12 : 50),
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 12 : 20,
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ scale: 0.95 }],
  },
  backIcon: {
    fontSize: 22,
    color: '#FFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  photoInitials: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFF',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cameraIconSimple: {
    width: 20,
    height: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBody: {
    width: 20,
    height: 14,
    backgroundColor: '#FF6B35',
    borderRadius: 3,
    position: 'absolute',
    bottom: 0,
  },
  cameraLens: {
    width: 8,
    height: 8,
    backgroundColor: '#FFF',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FF6B35',
    position: 'absolute',
    bottom: 3,
  },
  cameraFlash: {
    width: 6,
    height: 4,
    backgroundColor: '#FF6B35',
    borderRadius: 1,
    position: 'absolute',
    top: 0,
    left: 5,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fieldContainer: {
    paddingVertical: 18,
  },
  fieldHeaderWithEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButtonInline: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  editButtonActive: {
    backgroundColor: '#FF6B35',
  },
  editButtonInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },
  editButtonActiveText: {
    color: '#FFF',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  fieldInput: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
    paddingVertical: 8,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  fieldInputError: {
    borderBottomColor: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
    fontWeight: '500',
  },
  successText: {
    fontSize: 12,
    color: '#27AE60',
    marginTop: 4,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // API Error Container
  apiErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  apiErrorEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  apiErrorContent: {
    flex: 1,
  },
  apiErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C53030',
    marginBottom: 2,
  },
  apiErrorMessage: {
    fontSize: 13,
    color: '#742A2A',
    lineHeight: 18,
  },
  apiErrorClose: {
    padding: 4,
    marginLeft: 8,
  },
  apiErrorCloseText: {
    fontSize: 16,
    color: '#C53030',
    fontWeight: '600',
  },
  // Success Container
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    borderWidth: 1,
    borderColor: '#9AE6B4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  successMessageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#276749',
    flex: 1,
  },
  // OAuth Info Container
  oauthInfoContainer: {
    backgroundColor: '#EBF8FF',
    borderWidth: 1,
    borderColor: '#90CDF4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  oauthInfoText: {
    fontSize: 13,
    color: '#2B6CB0',
    lineHeight: 18,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#EEE',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordValue: {
    flex: 1,
    letterSpacing: 3,
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 8,
  },
  eyeIconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eyeShape: {
    width: 22,
    height: 14,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  eyeShapeOpen: {
    borderColor: '#FF6B35',
  },
  eyeBall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  eyeSlashLine: {
    position: 'absolute',
    width: 28,
    height: 2,
    backgroundColor: '#666',
    transform: [{ rotate: '45deg' }],
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  fieldHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  passwordInputWrapper: {
    marginTop: 8,
  },
  showPasswordToggle: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  showPasswordText: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '500',
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  savePasswordButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
  },
  savePasswordButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.7,
  },
  savePasswordButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  savePasswordButtonTextDisabled: {
    color: '#999',
  },
});
