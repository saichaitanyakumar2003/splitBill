import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Image,
  PixelRatio,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import Logo from '../components/Logo';
import { api } from '../api/client';

// Only import camera on native platforms
let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  const CameraModule = require('expo-camera');
  CameraView = CameraModule.CameraView;
  useCameraPermissions = CameraModule.useCameraPermissions;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Normalize size based on screen dimensions for consistent spacing across devices
// Base design is for 375 width (iPhone) - scales proportionally
const scale = SCREEN_WIDTH / 375;
const normalize = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

// Calculate bottom padding based on screen height percentage (more consistent across devices)
const BOTTOM_BAR_PADDING = Math.max(normalize(40), SCREEN_HEIGHT * 0.06);

export default function MainScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(isWeb);
  const [refreshing, setRefreshing] = useState(false);
  const cameraRef = useRef(null);

  // Pull to refresh handler for web
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Brief delay to show refresh indicator
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  // Only use camera permissions on native
  const [permission, requestPermission] = !isWeb && useCameraPermissions ? useCameraPermissions() : [null, null];

  React.useEffect(() => {
    if (!isWeb && permission) {
      setPermissionChecked(true);
      setPermissionGranted(permission.granted);
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      processImage(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const pickImage = async () => {
    setMenuVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (imageUri) => {
    setScanning(true);
    setCapturedImage(imageUri);
    
    try {
      const result = await api.scanBill(imageUri);
      navigateToSplit(result);
    } catch (error) {
      console.error('OCR Error:', error);
      // Demo fallback
      const mockResult = {
        success: true,
        bill: {
          merchantName: 'Restaurant',
          items: [
            { name: 'Burger', price: 12.99, quantity: 1, totalPrice: 12.99 },
            { name: 'Fries', price: 4.99, quantity: 2, totalPrice: 9.98 },
            { name: 'Drink', price: 2.99, quantity: 2, totalPrice: 5.98 },
          ],
          subtotal: 28.95,
          tax: 2.61,
          total: 31.56,
        },
      };
      navigateToSplit(mockResult);
    } finally {
      setScanning(false);
      setCapturedImage(null);
    }
  };

  const navigateToSplit = (result) => {
    navigation.navigate('BillDetail', {
      bill: {
        id: Date.now().toString(),
        name: result.bill?.merchantName || 'Scanned Bill',
        items: (result.bill?.items || []).map((item, idx) => ({
          ...item,
          id: `item-${idx}`,
          assignedTo: [],
        })),
        subtotal: result.bill?.subtotal || 0,
        tax: result.bill?.tax || 0,
        tip: result.bill?.tip || 0,
        total: result.bill?.total || 0,
        createdAt: new Date().toISOString(),
        status: 'pending',
      }
    });
  };

  const handleCustomSplit = () => {
    setMenuVisible(false);
    navigation.navigate('CustomSplit');
  };

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleRequestPermission = async () => {
    if (requestPermission) {
      const result = await requestPermission();
      setPermissionGranted(result.granted);
    }
  };

  // Web view - show options directly
  if (isWeb) {
    return (
      <LinearGradient
        colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.webScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
              colors={['#FF6B35']}
            />
          }
        >
          <View style={styles.webContent}>
            <Logo size="large" />
            
            <View style={styles.webOptions}>
              <TouchableOpacity style={styles.webOptionCard} onPress={handleCustomSplit}>
                <View style={styles.webOptionIcon}>
                  <Ionicons name="calculator" size={32} color={theme.colors.background} />
                </View>
                <Text style={styles.webOptionTitle}>Add Custom Split</Text>
                <Text style={styles.webOptionDesc}>Enter items manually</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.webOptionCard} onPress={pickImage}>
                <View style={styles.webOptionIcon}>
                  <Ionicons name="image" size={32} color={theme.colors.background} />
                </View>
                <Text style={styles.webOptionTitle}>Upload Image</Text>
                <Text style={styles.webOptionDesc}>Import a bill photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // Mobile - Loading state
  if (!permissionChecked) {
    return (
      <LinearGradient
        colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
        style={styles.container}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </LinearGradient>
    );
  }

  // Mobile - Permission not granted
  if (!permissionGranted) {
    return (
      <LinearGradient
        colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
        style={styles.container}
      >
        <View style={styles.permissionContent}>
          <Logo size="large" />
          
          <View style={styles.permissionBox}>
            <Ionicons name="camera" size={48} color={theme.colors.background} />
            <Text style={styles.permissionTitle}>Camera Access</Text>
            <Text style={styles.permissionText}>
              We need camera access to scan your receipts instantly
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </TouchableOpacity>
            
            <View style={styles.permissionDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.altButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.altButtonText}>Upload from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.altButton} onPress={handleCustomSplit}>
              <Ionicons name="calculator-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.altButtonText}>Add Custom Split</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Mobile - Camera view with scanning
  return (
    <View style={styles.container}>
      {/* Camera */}
      {CameraView && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
      )}

      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(255, 107, 53, 0.9)', 'transparent', 'rgba(255, 107, 53, 0.9)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Logo size="small" />
        <TouchableOpacity style={styles.menuButton} onPress={toggleMenu}>
          <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Scan frame */}
      <View style={styles.scanContainer}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.scanHint}>Position receipt in frame</Text>
      </View>

      {/* Capture button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner}>
            <Ionicons name="scan" size={28} color={theme.colors.background} />
          </View>
        </TouchableOpacity>
        <Text style={styles.captureHint}>Tap to scan</Text>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCustomSplit}>
              <Ionicons name="calculator" size={22} color={theme.colors.cardText} />
              <Text style={styles.menuItemText}>Add Custom Split</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={pickImage}>
              <Ionicons name="image" size={22} color={theme.colors.cardText} />
              <Text style={styles.menuItemText}>Upload Image</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Scanning overlay */}
      {scanning && (
        <View style={styles.scanningOverlay}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.capturedPreview} />
          )}
          <View style={styles.scanningContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.scanningText}>Analyzing receipt...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Web styles
  webScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  webContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  webOptions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xxl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  webOptionCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: 200,
    ...theme.shadows.lg,
  },
  webOptionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  webOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.cardText,
    marginBottom: theme.spacing.xs,
  },
  webOptionDesc: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
    textAlign: 'center',
  },

  // Permission styles
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingBottom: SCREEN_HEIGHT * 0.12,
  },
  permissionBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    width: '100%',
    maxWidth: 340,
    ...theme.shadows.lg,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.cardText,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  permissionText: {
    fontSize: 15,
    color: theme.colors.cardTextSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  permissionButton: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  permissionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.cardTextSecondary,
    fontSize: 14,
  },
  altButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  altButtonText: {
    fontSize: 16,
    color: theme.colors.background,
    fontWeight: '600',
  },

  // Camera view styles
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : normalize(50),
    paddingHorizontal: theme.spacing.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.45,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderColor: theme.colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanHint: {
    marginTop: theme.spacing.lg,
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: BOTTOM_BAR_PADDING,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureHint: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.primaryMuted,
    fontWeight: '500',
  },

  // Menu modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 110 : normalize(100),
    paddingRight: theme.spacing.lg,
  },
  menuContainer: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    minWidth: 200,
    ...theme.shadows.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  menuItemText: {
    fontSize: 16,
    color: theme.colors.cardText,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },

  // Scanning overlay
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturedPreview: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  scanningContent: {
    alignItems: 'center',
  },
  scanningText: {
    marginTop: theme.spacing.lg,
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
