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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [profileImage, setProfileImage] = useState(null);
  const [userName, setUserName] = useState('John Doe');
  const [mobile, setMobile] = useState('+91 98765 43210');
  const [password, setPassword] = useState('mypassword123');
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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

  const handleImagePick = () => {
    // TODO: Implement image picker
    alert('Image picker coming soon!');
  };

  const handleSave = () => {
    setIsEditing(false);
    // TODO: Save to backend
    alert('Profile saved successfully!');
  };

  const maskPassword = (pwd) => {
    return '•'.repeat(pwd.length);
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
              <Text style={[styles.backIcon, pressed && { opacity: 0.7 }]}>←</Text>
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
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoInitials}>
                      {userName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                )}
                
                {/* Camera Icon Overlay */}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handleImagePick}
                  activeOpacity={0.8}
                >
                  <View style={styles.cameraIconContainer}>
                    <View style={styles.cameraIconSimple}>
                      <View style={styles.cameraBody} />
                      <View style={styles.cameraLens} />
                      <View style={styles.cameraFlash} />
                    </View>
                  </View>
                </TouchableOpacity>
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
                >
                  <Text style={[styles.editButtonInlineText, isEditing && styles.editButtonActiveText]}>
                    {isEditing ? 'Save' : 'Edit'}
                  </Text>
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
                <Text style={styles.fieldValue}>{userName}</Text>
              )}
            </View>

            <View style={styles.fieldDivider} />

            {/* Mobile Field */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldIcon}>📱</Text>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
              </View>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.fieldValue}>{mobile}</Text>
              )}
            </View>

            <View style={styles.fieldDivider} />

            {/* Password Field - Masked */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldIcon}>🔒</Text>
                <Text style={styles.fieldLabel}>Password</Text>
              </View>
              <View style={styles.passwordContainer}>
                {isEditing ? (
                  <TextInput
                    style={[styles.fieldInput, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                  />
                ) : (
                  <Text style={[styles.fieldValue, styles.passwordValue]}>
                    {showPassword ? password : maskPassword(password)}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <View style={styles.eyeIconWrapper}>
                    <View style={[styles.eyeShape, showPassword && styles.eyeShapeOpen]}>
                      <View style={styles.eyeBall} />
                    </View>
                    {!showPassword && <View style={styles.eyeSlashLine} />}
                  </View>
                </TouchableOpacity>
              </View>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    marginTop: 8,
    marginBottom: 16,
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
});
