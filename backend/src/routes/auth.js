const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Group = require('../models/Group');
const ConsolidatedEdges = require('../models/ConsolidatedEdges');
const EditHistory = require('../models/EditHistory');
const { authenticate } = require('../middleware/auth');

const GOOGLE_WEB_CLIENT_ID = process.env.SPLITBILL_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key';
const JWT_EXPIRES_IN = '30d';
const SESSION_DAYS = 30;

const getSessionExp = () => new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
const genToken = (mailId, name) => jwt.sign({ mailId, name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) return res.status(400).json({ success: false, message: 'Email, password, name required' });
    
    if (await User.findById(email.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'Account exists' });
    }

    const user = await User.createUser(email, password, { name, phone: phone || '', groupIds: [], friends: [] });
    user.sessionExpiresAt = getSessionExp();
    await user.save();

    res.status(201).json({ success: true, data: { token: genToken(user._id, name), user: user.toJSON() } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findByMailIdWithPassword(email);
    if (!user) return res.status(401).json({ success: false, message: 'Account not found' });
    if (!await user.verifyPassword(password)) return res.status(401).json({ success: false, message: 'Wrong password' });

    user.sessionExpiresAt = getSessionExp();
    await user.save();

    const d = user.getDetails();
    res.json({ success: true, data: { token: genToken(user._id, d.name), user: user.toJSON() } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken, userInfo, mode } = req.body;
    let email, name, googleId;

    if (idToken) {
      const t = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
      const p = t.getPayload();
      email = p.email; name = p.name; googleId = p.sub;
    } else if (userInfo?.email) {
      email = userInfo.email; name = userInfo.name; googleId = userInfo.id;
    } else return res.status(400).json({ success: false, message: 'Token required' });

    let user = await User.findById(email.toLowerCase());

    if (mode === 'login' && !user) return res.status(404).json({ success: false, message: 'Sign up first' });
    if (mode === 'signup' && user) return res.status(409).json({ success: false, message: 'Account exists' });
    
    if (!user) user = await User.createUser(email, googleId, { name, phone: '', groupIds: [], friends: [] });
    user.sessionExpiresAt = getSessionExp();
    await user.save();

    res.json({ success: true, data: { token: genToken(user._id, user.getDetails().name), user: user.toJSON() } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/push-token', authenticate, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'Push token required' });
    }

    const user = await User.findById(req.user.mailId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.setExpoPushToken(pushToken);
    await user.save();

    res.json({ success: true, message: 'Push token saved' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    const d = user.getDetails();
    if (req.body.name) d.name = req.body.name;
    const phoneValue = req.body.phone_number ?? req.body.phone;
    if (phoneValue !== undefined) d.phone = phoneValue;
    if (req.body.upiId !== undefined) d.upiId = req.body.upiId;
    user.setDetails(d);
    await user.save();

    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/password', authenticate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findByMailIdWithPassword(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.pswd = await User.hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error('Password change error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Change email endpoint - creates new user with new email and migrates data
router.put('/change-email', authenticate, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const oldEmail = req.user.mailId;
    
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    
    const normalizedNewEmail = newEmail.toLowerCase().trim();
    
    // Check if new email is same as old
    if (normalizedNewEmail === oldEmail) {
      return res.status(400).json({ success: false, message: 'New email must be different from current email' });
    }
    
    // Check if new email already exists
    const existingUser = await User.findById(normalizedNewEmail);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use by another account' });
    }
    
    // Get current user with password
    const oldUser = await User.findByMailIdWithPassword(oldEmail);
    if (!oldUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get old user details
    const oldDetails = oldUser.getDetails();
    
    // Add old email to previous_mails
    const previousMails = oldDetails.previous_mails || [];
    if (!previousMails.includes(oldEmail)) {
      previousMails.push(oldEmail);
    }
    
    // Create new user with new email
    const newUser = new User({
      _id: normalizedNewEmail,
      name: oldUser.name,
      pswd: oldUser.pswd,
      compressedDetails: oldUser.compressedDetails,
      sessionExpiresAt: oldUser.sessionExpiresAt,
      createdAt: oldUser.createdAt,
      updatedAt: new Date()
    });
    
    // Update previous_mails in new user
    newUser.setDetails({ previous_mails: previousMails });
    
    await newUser.save();
    
    // Update expenses in all groups - payer and payees (expenses are stored compressed)
    const allGroups = await Group.find({});
    
    for (const group of allGroups) {
      let modified = false;
      const expenses = group.getExpenses();
      
      if (expenses && expenses.length > 0) {
        const updatedExpenses = expenses.map(expense => {
          let expenseModified = false;
          
          // Update payer if it matches old email
          if (expense.payer === oldEmail) {
            expense.payer = normalizedNewEmail;
            expenseModified = true;
          }
          
          // Update payees if they match old email
          if (expense.payees) {
            expense.payees = expense.payees.map(payee => {
              if (typeof payee === 'object' && payee.mailId === oldEmail) {
                payee.mailId = normalizedNewEmail;
                expenseModified = true;
              } else if (typeof payee === 'string' && payee === oldEmail) {
                expenseModified = true;
                return normalizedNewEmail;
              }
              return payee;
            });
          }
          
          if (expenseModified) {
            modified = true;
          }
          
          return expense;
        });
        
        if (modified) {
          group.setDetails({ expenses: updatedExpenses });
          await group.save();
        }
      }
    }
    
    // Update ConsolidatedEdges - from and to fields
    await ConsolidatedEdges.updateMany(
      { from: oldEmail },
      { $set: { from: normalizedNewEmail } }
    );
    
    await ConsolidatedEdges.updateMany(
      { to: oldEmail },
      { $set: { to: normalizedNewEmail } }
    );
    
    // Update EditHistory - actionBy field
    await EditHistory.updateMany(
      { actionBy: oldEmail },
      { $set: { actionBy: normalizedNewEmail } }
    );
    
    // Find users who have old email as friend and update
    const allUsers = await User.find({});
    for (const u of allUsers) {
      if (u._id === normalizedNewEmail || u._id === oldEmail) continue;
      const details = u.getDetails();
      let userModified = false;
      
      // Update friends list
      if (details.friends && details.friends.includes(oldEmail)) {
        details.friends = details.friends.map(f => f === oldEmail ? normalizedNewEmail : f);
        userModified = true;
      }
      
      // Update previous_mails if the old email is referenced there
      // (This helps when searching for users by their old emails)
      if (details.previous_mails && details.previous_mails.includes(oldEmail)) {
        details.previous_mails = details.previous_mails.map(pm => pm === oldEmail ? normalizedNewEmail : pm);
        userModified = true;
      }
      
      if (userModified) {
        u.setDetails({ 
          friends: details.friends,
          previous_mails: details.previous_mails 
        });
        await u.save();
      }
    }
    
    // Delete old user
    await User.deleteOne({ _id: oldEmail });
    
    // Generate new token with new email
    const token = genToken(normalizedNewEmail, newUser.name);
    
    res.json({ 
      success: true, 
      message: 'Email changed successfully',
      data: { 
        token, 
        user: newUser.toJSON() 
      }
    });
  } catch (e) {
    console.error('Email change error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/friends/add', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    user.addFriend(req.body.friendEmail);
    await user.save();
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/friends/remove', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    user.removeFriend(req.body.friendEmail);
    await user.save();
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/friends/details', authenticate, async (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ success: false, message: 'Emails array required' });
    }

    const users = await User.find({ _id: { $in: emails.map(e => e.toLowerCase()) } });
    const result = users.map(u => ({ mailId: u._id, name: u.name || u._id.split('@')[0] }));

    const foundEmails = result.map(r => r.mailId);
    emails.forEach(email => {
      if (!foundEmails.includes(email.toLowerCase())) {
        result.push({ mailId: email.toLowerCase(), name: email.split('@')[0] });
      }
    });

    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, forPayer } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success: true, data: [] });
    // forPayer=true will filter out users whose previous_mails match the query
    const filterPreviousMails = forPayer === 'true';
    const results = await User.searchUsers(q.trim(), req.user.mailId, 20, filterPreviousMails);
    res.json({ success: true, data: results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/logout', authenticate, (req, res) => res.json({ success: true }));

// Add a previous mail to user's list
router.post('/previous-mails', authenticate, async (req, res) => {
  try {
    const { mailId } = req.body;
    if (!mailId) return res.status(400).json({ success: false, message: 'mailId is required' });
    
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const added = user.addPreviousMail(mailId);
    await user.save();
    
    res.json({ success: true, added, data: user.getDetails().previous_mails });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Remove a previous mail from user's list
router.delete('/previous-mails/:mailId', authenticate, async (req, res) => {
  try {
    const { mailId } = req.params;
    
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const removed = user.removePreviousMail(decodeURIComponent(mailId));
    await user.save();
    
    res.json({ success: true, removed, data: user.getDetails().previous_mails });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Get user's previous mails
router.get('/previous-mails', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.json({ success: true, data: user.getDetails().previous_mails });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/refresh', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    user.sessionExpiresAt = getSessionExp();
    await user.save();
    res.json({ success: true, data: { token: genToken(user._id, user.name), session_expires_at: user.sessionExpiresAt } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
