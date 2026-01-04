const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const User = require('../models/User');
const { consolidateExpenses, mergeAndConsolidate } = require('../utils/splitBill');
const { sendExpenseNotifications } = require('../utils/pushNotifications');

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

router.post('/checkout', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    const { groupId, groupName, expenses, members } = req.body;
    
    if (!expenses || expenses.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one expense required' });
    }
    
    let group;
    let isNewGroup = false;
    
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      
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
      
      const { allExpenses, consolidatedExpenses } = mergeAndConsolidate(
        existingExpenses, 
        formattedNewExpenses,
        existingConsolidated
      );
      
      group.setDetails({
        expenses: allExpenses,
        consolidatedExpenses: consolidatedExpenses
      });
      await group.save();
      
    } else {
      if (!groupName) {
        return res.status(400).json({ success: false, message: 'Group name required for new group' });
      }
      
      const existingGroup = await Group.findOne({ name: groupName });
      
      if (existingGroup) {
        group = existingGroup;
        
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
        
        const { allExpenses, consolidatedExpenses } = mergeAndConsolidate(
          existingExpenses, 
          formattedNewExpenses,
          existingConsolidated
        );
        
        group.setDetails({
          expenses: allExpenses,
          consolidatedExpenses: consolidatedExpenses
        });
        await group.save();
        
        isNewGroup = false;
      } else {
        isNewGroup = true;
        const newGroupId = uuidv4();
        
        const formattedExpenses = expenses.map(exp => ({
          name: exp.name || exp.title,
          payer: exp.paidBy || exp.payer,
          totalAmount: exp.totalAmount || exp.amount,
          payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
            mailId,
            amount: parseFloat(amount)
          }))
        }));
        
        const consolidatedExpensesResult = consolidateExpenses(formattedExpenses);
        
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
      }
    }
    
    const memberEmails = [...allMembers].map(e => (e || '').toLowerCase().trim()).filter(Boolean);
    
    const memberDocs = await User.find({ 
      _id: { $in: memberEmails } 
    }).select('_id name');
    
    const emailToName = {};
    memberDocs.forEach(doc => {
      const name = (doc.name && doc.name.trim()) || doc._id.split('@')[0];
      emailToName[doc._id.toLowerCase()] = name;
      emailToName[doc._id] = name;
    });
    
    memberEmails.forEach(email => {
      const lowerEmail = email.toLowerCase();
      if (!emailToName[lowerEmail]) {
        emailToName[lowerEmail] = email.split('@')[0];
        emailToName[email] = email.split('@')[0];
      }
    });
    
    const groupDetails = group.getDetails();
    
    const pendingEdges = (groupDetails.consolidatedExpenses || []).filter(ce => !ce.resolved);
    
    const consolidatedWithNames = pendingEdges.map(ce => {
      const fromEmail = (ce.from || '').toLowerCase().trim();
      const toEmail = (ce.to || '').toLowerCase().trim();
      
      const fromName = emailToName[fromEmail] || emailToName[ce.from] || fromEmail.split('@')[0] || 'Unknown';
      const toName = emailToName[toEmail] || emailToName[ce.to] || toEmail.split('@')[0] || 'Unknown';
      
      return {
        from: fromEmail,
        to: toEmail,
        amount: ce.amount,
        fromName,
        toName
      };
    });
    
    const latestExpense = expenses[expenses.length - 1];
    const expenseTitle = latestExpense?.name || latestExpense?.title || 'Expense';
    
    const payersToNotify = [];
    const notifiedPayers = new Set();
    
    for (const edge of pendingEdges) {
      if (notifiedPayers.has(edge.from)) continue;
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
      }
    }
    
    if (payersToNotify.length > 0) {
      sendExpenseNotifications(payersToNotify, expenseTitle, group.name).catch(() => {});
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
    res.status(500).json({ success: false, message: e.message });
  }
});

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

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.json([]);
    const groups = await Group.find({ _id: { $in: user.getDetails().groupIds } });
    res.json(groups.map(g => g.toJSON()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    const userDetails = user.getDetails();
    const groupIds = userDetails.groupIds || [];
    
    const groups = await Group.find({ _id: { $in: groupIds } });
    
    const allMemberEmails = new Set();
    
    const pendingExpenses = [];
    
    for (const group of groups) {
      const details = group.getDetails();
      const consolidatedExpenses = details.consolidatedExpenses || [];
      
      const userPendingEdges = consolidatedExpenses.filter(
        edge => edge.from === userMailId && !edge.resolved
      );
      
      if (userPendingEdges.length > 0) {
        userPendingEdges.forEach(edge => {
          allMemberEmails.add(edge.from);
          allMemberEmails.add(edge.to);
        });
        
        pendingExpenses.push({
          groupId: group._id,
          groupName: group.name,
          groupStatus: group.status,
          pendingEdges: userPendingEdges,
          resolvedEdges: consolidatedExpenses.filter(
            edge => edge.from === userMailId && edge.resolved
          )
        });
      }
    }
    
    const memberDocs = await User.find({ _id: { $in: Array.from(allMemberEmails) } }).select('_id name');
    const emailToName = {};
    memberDocs.forEach(doc => {
      emailToName[doc._id] = doc.name || doc._id.split('@')[0];
    });
    
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
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    const userDetails = user.getDetails();
    const groupIds = userDetails.groupIds || [];
    
    const groups = await Group.find({ 
      _id: { $in: groupIds },
      status: 'completed'
    }).sort({ updatedAt: -1 });
    
    const allMemberEmails = new Set();
    groups.forEach(group => {
      const details = group.getDetails();
      (details.consolidatedExpenses || []).forEach(edge => {
        allMemberEmails.add(edge.from);
        allMemberEmails.add(edge.to);
      });
    });
    
    const memberDocs = await User.find({ _id: { $in: Array.from(allMemberEmails) } }).select('_id name');
    const emailToName = {};
    memberDocs.forEach(doc => {
      emailToName[doc._id] = doc.name || doc._id.split('@')[0];
    });
    
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
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

router.get('/:id/settle', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json({ settlements: group.getSettlements() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { from, to } = req.body;
    const userMailId = req.user.mailId;
    
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to required' });
    }
    
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
    
    const found = group.markEdgeResolved(from, to);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Edge not found' });
    }
    
    await group.save();
    
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
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    group.status = 'completed';
    await group.save();
    res.json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
