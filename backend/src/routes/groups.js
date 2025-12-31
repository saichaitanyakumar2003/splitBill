const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Group = require('../models/Group');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key';

const getMailId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    return jwt.verify(token, JWT_SECRET).mailId;
  } catch { return null; }
};

// Create group
router.post('/', async (req, res) => {
  try {
    const mailId = getMailId(req);
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });

    const group = new Group({ name: req.body.name, createdBy: mailId || 'anonymous', status: 'active' });
    await group.save();

    if (mailId) {
      const user = await User.findById(mailId);
      if (user) { user.addGroupId(group._id); await user.save(); }
    }

    res.status(201).json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get user's groups
router.get('/', async (req, res) => {
  try {
    const mailId = getMailId(req);
    if (!mailId) return res.json([]);
    const user = await User.findById(mailId);
    if (!user) return res.json([]);
    const groups = await Group.find({ _id: { $in: user.getDetails().groupIds } });
    res.json(groups.map(g => g.toJSON()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get group by ID
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add expense
router.post('/:id/expenses', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    const { name, payer, payees, amount } = req.body;
    if (!name || !payer || !amount) return res.status(400).json({ error: 'name, payer, amount required' });
    group.addExpense({ name, payer, payees: payees || [], amount });
    await group.save();
    res.json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get settlements
router.get('/:id/settle', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json({ settlements: group.getSettlements() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Complete group
router.post('/:id/complete', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    group.status = 'completed';
    await group.save();
    res.json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
