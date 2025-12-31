const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const User = require('../models/User');
const { consolidateExpenses, mergeAndConsolidate } = require('../utils/splitwise');

const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key';

const getMailId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    return jwt.verify(token, JWT_SECRET).mailId;
  } catch { return null; }
};

// Create group (legacy)
router.post('/', async (req, res) => {
  try {
    const mailId = getMailId(req);
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });

    const group = new Group({ 
      _id: uuidv4(),
      name: req.body.name, 
      status: 'active' 
    });
    await group.save();

    if (mailId) {
      const user = await User.findById(mailId);
      if (user) { user.addGroupId(group._id); await user.save(); }
    }

    res.status(201).json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Checkout - Create new group or add expenses to existing group
router.post('/checkout', async (req, res) => {
  try {
    const mailId = getMailId(req);
    if (!mailId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { groupId, groupName, expenses, members } = req.body;
    
    if (!expenses || expenses.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one expense required' });
    }
    
    let group;
    let isNewGroup = false;
    
    // Check if adding to existing group or creating new
    if (groupId) {
      // Add to existing group
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      
      // Get existing expenses and merge with new ones
      const existingExpenses = group.getDetails().expenses || [];
      const formattedNewExpenses = expenses.map(exp => ({
        name: exp.name || exp.title,
        payer: exp.paidBy || exp.payer,
        totalAmount: exp.totalAmount || exp.amount,
        payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
          mailId,
          amount: parseFloat(amount)
        }))
      }));
      
      // Merge and consolidate
      const { allExpenses, consolidatedExpenses } = mergeAndConsolidate(existingExpenses, formattedNewExpenses);
      
      // Update group using setDetails
      group.setDetails({
        expenses: allExpenses,
        consolidatedExpenses: consolidatedExpenses
      });
      await group.save();
      
    } else {
      // Create new group with UUID as ID
      if (!groupName) {
        return res.status(400).json({ success: false, message: 'Group name required for new group' });
      }
      
      isNewGroup = true;
      const newGroupId = uuidv4();
      
      // Format expenses for storage
      const formattedExpenses = expenses.map(exp => ({
        name: exp.name || exp.title,
        payer: exp.paidBy || exp.payer,
        totalAmount: exp.totalAmount || exp.amount,
        payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
          mailId,
          amount: parseFloat(amount)
        }))
      }));
      
      // Calculate consolidated expenses using Splitwise algorithm
      const consolidatedExpensesResult = consolidateExpenses(formattedExpenses);
      
      // Create group with compressed data
      const { compressData } = require('../utils/compression');
      group = new Group({
        _id: newGroupId,
        name: groupName,
        status: 'active',
        compressedDetails: compressData({
          expenses: formattedExpenses,
          consolidatedExpenses: consolidatedExpensesResult
        })
      });
      
      await group.save();
    }
    
    // Collect all unique members from expenses
    const allMembers = new Set();
    if (members) {
      members.forEach(m => allMembers.add(m));
    }
    expenses.forEach(exp => {
      if (exp.paidBy) allMembers.add(exp.paidBy);
      if (exp.payer) allMembers.add(exp.payer);
      if (exp.splits) {
        Object.keys(exp.splits).forEach(m => allMembers.add(m));
      }
    });
    
    // Add group ID to all involved members (addGroupId handles uniqueness)
    for (const memberMailId of allMembers) {
      try {
        const memberUser = await User.findById(memberMailId);
        if (memberUser) {
          const wasAdded = memberUser.addGroupId(group._id);
          if (wasAdded) {
            await memberUser.save();
          }
        }
      } catch (userError) {
        console.error(`Failed to update user ${memberMailId}:`, userError);
      }
    }
    
    // Fetch member names for consolidated expenses response
    const memberEmails = [...allMembers];
    const memberDocs = await User.find({ _id: { $in: memberEmails } }).select('_id name');
    const emailToName = {};
    memberDocs.forEach(doc => {
      emailToName[doc._id] = doc.name;
    });
    
    // Get the group details for response
    const groupDetails = group.getDetails();
    
    // Add names to consolidated expenses for frontend display
    const consolidatedWithNames = (groupDetails.consolidatedExpenses || []).map(ce => ({
      from: ce.from,
      to: ce.to,
      amount: ce.amount,
      fromName: emailToName[ce.from] || ce.from.split('@')[0],
      toName: emailToName[ce.to] || ce.to.split('@')[0]
    }));
    
    res.json({
      success: true,
      data: {
        groupId: group._id,
        groupName: group.name,
        isNewGroup,
        expenses: groupDetails.expenses,
        consolidatedExpenses: consolidatedWithNames
      }
    });
    
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
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
