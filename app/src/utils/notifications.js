import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authPost } from './apiHelper';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token = null;

  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.log('No EAS project ID found');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }

  return token;
}

export async function savePushTokenToServer(pushToken) {
  if (!pushToken) return false;

  try {
    const response = await authPost('/auth/push-token', { pushToken });
    const data = await response.json();
    
    if (data.success) {
      console.log('Push token saved to server');
      return true;
    } else {
      console.error('Failed to save push token:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Error saving push token to server:', error);
    return false;
  }
}

export async function initializePushNotifications() {
  const token = await registerForPushNotificationsAsync();
  
  if (token) {
    await savePushTokenToServer(token);
  }
  
  return token;
}

export async function getInitialNotification() {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    return response.notification.request.content.data;
  }
  return null;
}

export function addNotificationListeners(onNotificationReceived, onNotificationResponse) {
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}
