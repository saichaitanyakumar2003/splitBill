const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client(process.env.SPLITBILL_GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key';
const JWT_EXPIRES_IN = '7d';
const SESSION_DAYS = 7;

const getSessionExp = () => new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
const genToken = (mailId, name) => jwt.sign({ mailId, name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// Register
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

// Login
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

// Google OAuth
router.post('/google', async (req, res) => {
  try {
    const { idToken, userInfo, mode } = req.body;
    let email, name, googleId;

    if (idToken) {
      const t = await googleClient.verifyIdToken({ idToken, audience: process.env.SPLITBILL_GOOGLE_CLIENT_ID });
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

// Me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(401).json({ success: false, message: 'Invalid token' }); }
});

// Profile update
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    const d = user.getDetails();
    if (req.body.name) d.name = req.body.name;
    // Accept both phone and phone_number from frontend
    const phoneValue = req.body.phone_number ?? req.body.phone;
    if (phoneValue !== undefined) d.phone = phoneValue;
    user.setDetails(d);
    await user.save();

    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Add friend
router.post('/friends/add', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    user.addFriend(req.body.friendEmail);
    await user.save();
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Remove friend
router.post('/friends/remove', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    user.removeFriend(req.body.friendEmail);
    await user.save();
    res.json({ success: true, data: user.toJSON() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Get friend details by emails
router.post('/friends/details', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    jwt.verify(token, JWT_SECRET);
    
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ success: false, message: 'Emails array required' });
    }

    const users = await User.find({ _id: { $in: emails.map(e => e.toLowerCase()) } });
    
    const result = users.map(u => ({
      mailId: u._id,
      name: u.name || u._id.split('@')[0]
    }));

    // Include emails not found with fallback name
    const foundEmails = result.map(r => r.mailId);
    emails.forEach(email => {
      if (!foundEmails.includes(email.toLowerCase())) {
        result.push({ mailId: email.toLowerCase(), name: email.split('@')[0] });
      }
    });

    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Search users by name or email
router.get('/search', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    const results = await User.searchUsers(q.trim(), mailId, 20);
    res.json({ success: true, data: results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Logout
router.post('/logout', (req, res) => res.json({ success: true }));

// Refresh
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mailId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(mailId);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    user.sessionExpiresAt = getSessionExp();
    await user.save();
    res.json({ success: true, data: { token: genToken(user._id, user.getDetails().name) } });
  } catch (e) { res.status(401).json({ success: false, message: 'Invalid' }); }
});

module.exports = router;
