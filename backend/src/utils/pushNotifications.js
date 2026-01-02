/**
 * Expo Push Notifications Utility
 * 
 * Sends push notifications via Expo's push notification service
 */

const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Check if a push token is valid Expo push token
 * @param {string} token - Push token to validate
 * @returns {boolean}
 */
function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

/**
 * Send a single push notification
 * @param {string} pushToken - Expo push token
 * @param {object} message - Message object { title, body, data }
 * @returns {Promise<object>}
 */
async function sendPushNotification(pushToken, message) {
  if (!isExpoPushToken(pushToken)) {
    console.log('Invalid push token:', pushToken);
    return { success: false, error: 'Invalid push token' };
  }

  const notificationMessage = {
    to: pushToken,
    sound: 'default',
    title: message.title || 'SplitBill',
    body: message.body || '',
    data: message.data || {},
    priority: 'high',
    channelId: 'default',
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationMessage),
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple users
 * @param {Array} notifications - Array of { pushToken, message: { title, body, data } }
 * @returns {Promise<Array>}
 */
async function sendPushNotifications(notifications) {
  // Filter valid tokens
  const validNotifications = notifications.filter(n => isExpoPushToken(n.pushToken));
  
  if (validNotifications.length === 0) {
    console.log('No valid push tokens to send notifications to');
    return [];
  }

  // Prepare messages for batch sending
  const messages = validNotifications.map(n => ({
    to: n.pushToken,
    sound: 'default',
    title: n.message.title || 'SplitBill',
    body: n.message.body || '',
    data: n.message.data || {},
    priority: 'high',
    channelId: 'default',
  }));

  try {
    // Expo allows sending up to 100 notifications per request
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    const results = [];
    for (const chunk of chunks) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      results.push(result);
    }

    console.log(`Sent ${messages.length} push notifications`);
    return results;
  } catch (error) {
    console.error('Error sending batch push notifications:', error);
    return [];
  }
}

/**
 * Send expense notification to payers
 * @param {Array} payers - Array of { mailId, pushToken, amount, payeeName }
 * @param {string} expenseTitle - Title of the expense
 * @param {string} groupName - Name of the group
 */
async function sendExpenseNotifications(payers, expenseTitle, groupName) {
  const notifications = payers
    .filter(p => p.pushToken && isExpoPushToken(p.pushToken))
    .map(payer => ({
      pushToken: payer.pushToken,
      message: {
        title: `💰 New Expense in ${groupName}`,
        body: `You owe ₹${payer.amount.toFixed(2)} to ${payer.payeeName} for "${expenseTitle}"`,
        data: {
          type: 'expense',
          groupName,
          expenseTitle,
          amount: payer.amount,
          payeeName: payer.payeeName,
        },
      },
    }));

  if (notifications.length > 0) {
    await sendPushNotifications(notifications);
  }
}

module.exports = {
  isExpoPushToken,
  sendPushNotification,
  sendPushNotifications,
  sendExpenseNotifications,
};

