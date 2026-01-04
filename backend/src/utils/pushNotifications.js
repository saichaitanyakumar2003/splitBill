const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

async function sendPushNotification(pushToken, message) {
  if (!isExpoPushToken(pushToken)) {
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
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendPushNotifications(notifications) {
  const validNotifications = notifications.filter(n => isExpoPushToken(n.pushToken));
  
  if (validNotifications.length === 0) {
    return [];
  }

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

    return results;
  } catch (error) {
    return [];
  }
}

async function sendExpenseNotifications(payers, expenseTitle, groupName) {
  const notifications = payers
    .filter(p => p.pushToken && isExpoPushToken(p.pushToken))
    .map(payer => ({
      pushToken: payer.pushToken,
      message: {
        title: `💰 ${groupName}`,
        body: `You owe ₹${payer.amount.toFixed(2)} to ${payer.payeeName}`,
        data: {
          type: 'expense',
          screen: 'PendingExpenses',
          groupName,
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
