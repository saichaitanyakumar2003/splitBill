/**
 * Push Notifications Utility
 * 
 * Handles Expo push notification registration and permissions
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { authPost } from './apiHelper';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 * @returns {Promise<string|null>} Expo push token or null
 */
export async function registerForPushNotificationsAsync() {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Only for Android and iOS
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    const token = tokenData.data;
    console.log('Expo push token:', token);

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Save push token to backend
 * @param {string} pushToken - Expo push token
 * @returns {Promise<boolean>} Success status
 */
export async function savePushTokenToBackend(pushToken) {
  if (!pushToken) return false;

  try {
    const response = await authPost('/auth/push-token', { pushToken });
    const data = await response.json();
    
    if (data.success) {
      console.log('Push token saved to backend');
      return true;
    } else {
      console.error('Failed to save push token:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Error saving push token to backend:', error);
    return false;
  }
}

/**
 * Initialize push notifications - call this after user logs in
 * @returns {Promise<string|null>} Push token or null
 */
export async function initializePushNotifications() {
  const token = await registerForPushNotificationsAsync();
  
  if (token) {
    await savePushTokenToBackend(token);
  }
  
  return token;
}

/**
 * Add notification listeners
 * @param {Function} onNotificationReceived - Called when notification is received while app is open
 * @param {Function} onNotificationResponse - Called when user taps on notification
 * @returns {Function} Cleanup function to remove listeners
 */
export function addNotificationListeners(onNotificationReceived, onNotificationResponse) {
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

