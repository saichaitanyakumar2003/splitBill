const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const User = require('../models/User');
const { consolidateExpenses, mergeAndConsolidate } = require('../utils/splitBill');
const { sendExpenseNotifications } = require('../utils/pushNotifications');

// Note: authenticate middleware is applied at server level for all /api/groups routes
// req.user.mailId is available in all routes

// Create group (legacy)
router.post('/', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });

    const group = new Group({ 
      _id: uuidv4(),
      name: req.body.name, 
      status: 'active' 
    });
    await group.save();

    const user = await User.findById(req.user.mailId);
    if (user) { user.addGroupId(group._id); await user.save(); }

    res.status(201).json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Checkout - Create new group or add expenses to existing group
router.post('/checkout', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
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
      
      // Get existing expenses and consolidated expenses (with resolved flags)
      const existingDetails = group.getDetails();
      const existingExpenses = existingDetails.expenses || [];
      const existingConsolidated = existingDetails.consolidatedExpenses || [];
      
      const formattedNewExpenses = expenses.map(exp => ({
        name: exp.name || exp.title,
        payer: exp.paidBy || exp.payer,
        totalAmount: exp.totalAmount || exp.amount,
        payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
          mailId,
          amount: parseFloat(amount)
        }))
      }));
      
      // Merge and consolidate, accounting for already resolved payments
      const { allExpenses, consolidatedExpenses } = mergeAndConsolidate(
        existingExpenses, 
        formattedNewExpenses,
        existingConsolidated
      );
      
      // Update group using setDetails
      group.setDetails({
        expenses: allExpenses,
        consolidatedExpenses: consolidatedExpenses
      });
      await group.save();
      
    } else {
      // Check if group with same name exists in the entire database
      if (!groupName) {
        return res.status(400).json({ success: false, message: 'Group name required for new group' });
      }
      
      // Find existing group with same name (globally unique)
      const existingGroup = await Group.findOne({ name: groupName });
      
      if (existingGroup) {
        // Group with same name exists - add expense to it
        group = existingGroup;
        
        // Get existing expenses and consolidated expenses (with resolved flags)
        const existingDetails = group.getDetails();
        const existingExpenses = existingDetails.expenses || [];
        const existingConsolidated = existingDetails.consolidatedExpenses || [];
        
        const formattedNewExpenses = expenses.map(exp => ({
          name: exp.name || exp.title,
          payer: exp.paidBy || exp.payer,
          totalAmount: exp.totalAmount || exp.amount,
          payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
            mailId,
            amount: parseFloat(amount)
          }))
        }));
        
        // Merge and consolidate, accounting for already resolved payments
        const { allExpenses, consolidatedExpenses } = mergeAndConsolidate(
          existingExpenses, 
          formattedNewExpenses,
          existingConsolidated
        );
        
        // Update group using setDetails
        group.setDetails({
          expenses: allExpenses,
          consolidatedExpenses: consolidatedExpenses
        });
        await group.save();
        
        // Not a new group
        isNewGroup = false;
      } else {
        // Create new group with UUID as ID
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
    }
    
    // Collect all unique members from expenses (normalize to lowercase)
    const allMembers = new Set();
    const normalizeEmail = (email) => email ? email.toLowerCase().trim() : null;
    
    if (members) {
      members.forEach(m => {
        const normalized = normalizeEmail(m);
        if (normalized) allMembers.add(normalized);
      });
    }
    expenses.forEach(exp => {
      if (exp.paidBy) allMembers.add(normalizeEmail(exp.paidBy));
      if (exp.payer) allMembers.add(normalizeEmail(exp.payer));
      if (exp.splits) {
        Object.keys(exp.splits).forEach(m => {
          const normalized = normalizeEmail(m);
          if (normalized) allMembers.add(normalized);
        });
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
    const memberEmails = [...allMembers].map(e => (e || '').toLowerCase().trim()).filter(Boolean);
    console.log('🔍 Looking up names for emails:', memberEmails);
    
    // Query users - try both exact match and case-insensitive regex
    const memberDocs = await User.find({ 
      _id: { $in: memberEmails } 
    }).select('_id name');
    
    console.log('👤 Found users:', memberDocs.length, memberDocs.map(d => ({ id: d._id, name: d.name })));
    
    const emailToName = {};
    memberDocs.forEach(doc => {
      // Use name if available and not empty, otherwise use email prefix
      const name = (doc.name && doc.name.trim()) || doc._id.split('@')[0];
      // Store with lowercase key for consistent lookup
      emailToName[doc._id.toLowerCase()] = name;
      emailToName[doc._id] = name; // Also store original case
      console.log(`✅ Mapped ${doc._id} -> "${name}"`);
    });
    
    // Also add fallbacks for any members not found in database
    memberEmails.forEach(email => {
      const lowerEmail = email.toLowerCase();
      if (!emailToName[lowerEmail]) {
        emailToName[lowerEmail] = email.split('@')[0];
        emailToName[email] = email.split('@')[0];
        console.log(`⚠️ Fallback for ${email} -> ${emailToName[email]} (user not found in DB)`);
      }
    });
    
    console.log('📋 Final emailToName map:', emailToName);
    
    // Get the group details for response
    const groupDetails = group.getDetails();
    
    // Add names to consolidated expenses for frontend display
    // Only return PENDING (unresolved) edges for the split summary
    const pendingEdges = (groupDetails.consolidatedExpenses || []).filter(ce => !ce.resolved);
    console.log('📊 Processing pendingEdges:', pendingEdges.length);
    
    const consolidatedWithNames = pendingEdges.map(ce => {
      const fromEmail = (ce.from || '').toLowerCase().trim();
      const toEmail = (ce.to || '').toLowerCase().trim();
      
      const fromName = emailToName[fromEmail] || emailToName[ce.from] || fromEmail.split('@')[0] || 'Unknown';
      const toName = emailToName[toEmail] || emailToName[ce.to] || toEmail.split('@')[0] || 'Unknown';
      
      console.log(`💰 Edge: ${fromEmail} (${fromName}) -> ${toEmail} (${toName}): ${ce.amount}`);
      
      return {
        from: fromEmail,
        to: toEmail,
        amount: ce.amount,
        fromName,
        toName
      };
    });
    
    // Send push notifications to payers (people who need to pay)
    // Get the expense title from the first/latest expense
    const latestExpense = expenses[expenses.length - 1];
    const expenseTitle = latestExpense?.name || latestExpense?.title || 'Expense';
    
    // Collect unique payers from pending edges and get their push tokens
    const payersToNotify = [];
    const notifiedPayers = new Set();
    
    for (const edge of pendingEdges) {
      // Don't notify the same person multiple times
      if (notifiedPayers.has(edge.from)) continue;
      // Don't notify the person who created the expense
      if (edge.from === mailId) continue;
      
      notifiedPayers.add(edge.from);
      
      try {
        const payerUser = await User.findById(edge.from);
        if (payerUser) {
          const payerDetails = payerUser.getDetails();
          if (payerDetails.expoPushToken) {
            payersToNotify.push({
              mailId: edge.from,
              pushToken: payerDetails.expoPushToken,
              amount: edge.amount,
              payeeName: emailToName[edge.to] || edge.to.split('@')[0],
            });
          }
        }
      } catch (tokenError) {
        console.error(`Failed to get push token for ${edge.from}:`, tokenError);
      }
    }
    
    // Send notifications asynchronously (don't wait for it)
    if (payersToNotify.length > 0) {
      sendExpenseNotifications(payersToNotify, expenseTitle, group.name)
        .catch(err => console.error('Error sending expense notifications:', err));
    }
    
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

// Check if group name exists
router.get('/check-name', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name required' });
    }
    
    const existingGroup = await Group.findOne({ name: name.trim() });
    res.json({ 
      success: true, 
      exists: !!existingGroup,
      groupId: existingGroup ? existingGroup._id : null
    });
  } catch (e) { 
    res.status(500).json({ success: false, message: e.message }); 
  }
});

// Get user's groups
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.json([]);
    const groups = await Group.find({ _id: { $in: user.getDetails().groupIds } });
    res.json(groups.map(g => g.toJSON()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get user's pending expenses (groups where user owes money with unresolved edges)
router.get('/pending', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    const userDetails = user.getDetails();
    const groupIds = userDetails.groupIds || [];
    
    // Get all groups user is part of
    const groups = await Group.find({ _id: { $in: groupIds } });
    
    // Collect all member emails for name lookup
    const allMemberEmails = new Set();
    
    // Filter to groups where user has pending (unresolved) payments
    const pendingExpenses = [];
    
    for (const group of groups) {
      const details = group.getDetails();
      const consolidatedExpenses = details.consolidatedExpenses || [];
      
      // Find edges where current user is the 'from' (owes money)
      const userPendingEdges = consolidatedExpenses.filter(
        edge => edge.from === userMailId && !edge.resolved
      );
      
      if (userPendingEdges.length > 0) {
        // Collect member emails for name lookup
        userPendingEdges.forEach(edge => {
          allMemberEmails.add(edge.from);
          allMemberEmails.add(edge.to);
        });
        
        pendingExpenses.push({
          groupId: group._id,
          groupName: group.name,
          groupStatus: group.status,
          pendingEdges: userPendingEdges,
          // Also include resolved edges for display (greyed out)
          resolvedEdges: consolidatedExpenses.filter(
            edge => edge.from === userMailId && edge.resolved
          )
        });
      }
    }
    
    // Fetch member names
    const memberDocs = await User.find({ _id: { $in: Array.from(allMemberEmails) } }).select('_id name');
    const emailToName = {};
    memberDocs.forEach(doc => {
      emailToName[doc._id] = doc.name || doc._id.split('@')[0];
    });
    
    // Add names to edges
    const pendingWithNames = pendingExpenses.map(item => ({
      ...item,
      pendingEdges: item.pendingEdges.map(edge => ({
        ...edge,
        fromName: emailToName[edge.from] || edge.from.split('@')[0],
        toName: emailToName[edge.to] || edge.to.split('@')[0]
      })),
      resolvedEdges: item.resolvedEdges.map(edge => ({
        ...edge,
        fromName: emailToName[edge.from] || edge.from.split('@')[0],
        toName: emailToName[edge.to] || edge.to.split('@')[0]
      }))
    }));
    
    res.json({ success: true, data: pendingWithNames });
  } catch (e) {
    console.error('Pending expenses error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get user's history (completed groups)
router.get('/history', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    const userDetails = user.getDetails();
    const groupIds = userDetails.groupIds || [];
    
    // Get only completed groups
    const groups = await Group.find({ 
      _id: { $in: groupIds },
      status: 'completed'
    }).sort({ updatedAt: -1 });
    
    // Collect all member emails for name lookup
    const allMemberEmails = new Set();
    groups.forEach(group => {
      const details = group.getDetails();
      (details.consolidatedExpenses || []).forEach(edge => {
        allMemberEmails.add(edge.from);
        allMemberEmails.add(edge.to);
      });
    });
    
    // Fetch member names
    const memberDocs = await User.find({ _id: { $in: Array.from(allMemberEmails) } }).select('_id name');
    const emailToName = {};
    memberDocs.forEach(doc => {
      emailToName[doc._id] = doc.name || doc._id.split('@')[0];
    });
    
    // Add names to consolidated expenses
    const groupsWithNames = groups.map(group => {
      const json = group.toJSON();
      json.consolidatedExpenses = (json.consolidatedExpenses || []).map(edge => ({
        ...edge,
        fromName: emailToName[edge.from] || edge.from?.split('@')[0] || 'Unknown',
        toName: emailToName[edge.to] || edge.to?.split('@')[0] || 'Unknown',
      }));
      return json;
    });
    
    res.json({ success: true, data: groupsWithNames });
  } catch (e) {
    console.error('History error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
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

// Mark a consolidated edge as resolved (settled)
router.post('/:id/resolve', async (req, res) => {
  try {
    const { from, to } = req.body;
    const userMailId = req.user.mailId;
    
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to required' });
    }
    
    // Only the person who owes (from) can mark it as resolved
    if (from !== userMailId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the payer can mark this expense as resolved' 
      });
    }
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    // Mark the edge as resolved
    const found = group.markEdgeResolved(from, to);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Edge not found' });
    }
    
    await group.save();
    
    // Check if all edges are resolved -> mark group as completed
    if (group.areAllEdgesResolved()) {
      group.status = 'completed';
      await group.save();
    }
    
    res.json({ 
      success: true, 
      data: {
        groupId: group._id,
        groupName: group.name,
        groupStatus: group.status,
        allResolved: group.areAllEdgesResolved()
      }
    });
  } catch (e) {
    console.error('Resolve error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
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
