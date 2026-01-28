const SibApiV3Sdk = require('sib-api-v3-sdk');

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const transactionalEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Send a password reset email with temporary password
 * @param {string} toEmail - Recipient email address
 * @param {string} temporaryPassword - The temporary password to send
 * @param {string} userName - Optional user name for personalization
 * @returns {Promise<object>} - API response
 */
async function sendPasswordResetEmail(toEmail, temporaryPassword, userName = '') {
  const displayName = userName || toEmail.split('@')[0];
  
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  
  sendSmtpEmail.sender = {
    name: 'SplitBill',
    email: process.env.EMAIL_FROM
  };
  
  sendSmtpEmail.to = [{ email: toEmail, name: displayName }];
  
  sendSmtpEmail.subject = 'Your SplitBill Temporary Password';
  
  sendSmtpEmail.htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF8C5A 0%, #FF6B35 50%, #E64A19 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 15px;">
                <tr>
                  <td style="width: 70px; height: 70px; background-color: #fff; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; font-weight: 800; color: #FF6B35;">S</span><span style="font-size: 28px; font-weight: 800; color: #E64A19;">B</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">SplitBill</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">Split smart. Pay fair.</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px; font-weight: 600;">Password Reset Request</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Hi <strong>${displayName}</strong>,
              </p>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                We received a request to reset your password. Here's your temporary password:
              </p>
              
              <!-- Temporary Password Box -->
              <div style="background-color: #FFF5F0; border: 2px dashed #FF6B35; border-radius: 12px; padding: 25px; text-align: center; margin: 0 0 25px;">
                <p style="color: #666; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                <p style="color: #FF6B35; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: 3px; font-family: monospace;">${temporaryPassword}</p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                <strong>What to do next:</strong>
              </p>
              
              <ol style="color: #555; font-size: 15px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                <li>Open the SplitBill app</li>
                <li>Login with your email and the temporary password above</li>
                <li>Go to View Profile to change your password</li>
              </ol>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 0 8px 8px 0; margin: 0 0 25px;">
                <p style="color: #92400E; font-size: 14px; margin: 0;">
                  <strong>Important:</strong> This temporary password is valid for <strong>30 minutes</strong>. Your original password still works - if you remember it, you can use that instead.
                </p>
              </div>
              
              <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 0;">
                Need help? Reply to this email or contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 13px; margin: 0 0 10px;">
                © ${new Date().getFullYear()} SplitBill. All rights reserved.
              </p>
              <p style="color: #bbb; font-size: 12px; margin: 0;">
                Split bills effortlessly with friends and family.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  // Plain text version for email clients that don't support HTML
  sendSmtpEmail.textContent = `
SplitBill - Password Reset

Hi ${displayName},

We received a request to reset your password. Here's your temporary password:

${temporaryPassword}

What to do next:
1. Open the SplitBill app
2. Login with your email and the temporary password above
3. Go to View Profile to change your password

Important: This temporary password is valid for 30 minutes. Your original password still works - if you remember it, you can use that instead.

Need help? Reply to this email or contact our support team.

© ${new Date().getFullYear()} SplitBill. All rights reserved.
  `;
  
  try {
    const response = await transactionalEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log('Password reset email sent successfully:', response);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

/**
 * Generate a random temporary password
 * @param {number} length - Length of the password (default: 8)
 * @returns {string} - Random password
 */
function generateTemporaryPassword(length = 8) {
  // Use a mix of uppercase, lowercase, and numbers for readability
  // Avoid confusing characters like 0/O, 1/l/I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = {
  sendPasswordResetEmail,
  generateTemporaryPassword
};
