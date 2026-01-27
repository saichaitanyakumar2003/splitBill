const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const User = require('../models/User');
const ConsolidatedEdges = require('../models/ConsolidatedEdges');
const History = require('../models/History');
const EditHistory = require('../models/EditHistory');
const { consolidateExpenses, mergeAndConsolidate } = require('../utils/splitBill');
const { sendExpenseNotifications, sendPushNotification, sendPushNotifications } = require('../utils/pushNotifications');

// Helper: Calculate consolidated edges from expenses and resolved payments
function calculateConsolidatedEdges(expenses, resolvedPayments = []) {
  const balances = {};

  for (const expense of expenses) {
    const payer = expense.payer;
    const totalAmount = expense.totalAmount || expense.amount;
    
    balances[payer] = (balances[payer] || 0) + totalAmount;
    
    for (const payee of (expense.payees || [])) {
      if (typeof payee === 'object') {
        balances[payee.mailId] = (balances[payee.mailId] || 0) - payee.amount;
      } else {
        const splitAmount = totalAmount / (expense.payees.length || 1);
        balances[payee] = (balances[payee] || 0) - splitAmount;
      }
    }
  }

  // Apply resolved payments
  for (const payment of resolvedPayments) {
    balances[payment.from] = (balances[payment.from] || 0) + payment.amount;
    balances[payment.to] = (balances[payment.to] || 0) - payment.amount;
  }

  const creditors = [];
  const debtors = [];

  for (const [mailId, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance > 0.01) {
      creditors.push({ mailId, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ mailId, amount: Math.abs(roundedBalance) });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const consolidated = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      consolidated.push({
        from: debtor.mailId,
        to: creditor.mailId,
        amount: Math.round(amount * 100) / 100,
        resolved: false
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return consolidated;
}

// Helper: Get email to name mapping
async function getEmailToNameMap(emails) {
  const memberDocs = await User.find({ _id: { $in: emails } }).select('_id name');
  const emailToName = {};
  memberDocs.forEach(doc => {
    const name = (doc.name && doc.name.trim()) || doc._id.split('@')[0];
    emailToName[doc._id.toLowerCase()] = name;
    emailToName[doc._id] = name;
  });
  emails.forEach(email => {
    const lowerEmail = email.toLowerCase();
    if (!emailToName[lowerEmail]) {
      emailToName[lowerEmail] = email.split('@')[0];
      emailToName[email] = email.split('@')[0];
    }
  });
  return emailToName;
}

// Helper: Get all unique members from a group's expenses
function getGroupMemberEmails(group) {
  const expenses = group.getExpenses();
  const members = new Set();
  
  expenses.forEach(expense => {
    if (expense.payer) members.add(expense.payer.toLowerCase());
    if (expense.payees) {
      expense.payees.forEach(p => {
        if (typeof p === 'object' && p.mailId) {
          members.add(p.mailId.toLowerCase());
        } else if (typeof p === 'string') {
          members.add(p.toLowerCase());
        }
      });
    }
  });
  
  return Array.from(members);
}

// Helper: Send notification to all group members (except the actor)
async function sendGroupNotification(group, actorMailId, notificationType, extraData = {}) {
  try {
    const memberEmails = getGroupMemberEmails(group);
    
    // Get all members' push tokens (exclude the actor)
    const membersToNotify = memberEmails.filter(email => email.toLowerCase() !== actorMailId.toLowerCase());
    
    if (membersToNotify.length === 0) return;
    
    // Fetch users with push tokens
    const users = await User.find({ _id: { $in: membersToNotify } });
    
    // Get actor's name
    const actor = await User.findById(actorMailId);
    const actorName = actor?.name || actorMailId.split('@')[0];
    
    // Build notification message based on type
    let title, body;
    switch (notificationType) {
      case 'expense_added':
        title = `💰 ${group.name}`;
        body = `${actorName} added a new expense: ${extraData.expenseName || 'New expense'}`;
        break;
      case 'expense_edited':
        title = `✏️ ${group.name}`;
        body = `${actorName} updated expense: ${extraData.expenseName || 'Expense'}`;
        break;
      case 'expense_deleted':
        title = `🗑️ ${group.name}`;
        body = `${actorName} deleted an expense from the group`;
        break;
      case 'group_deleted':
        title = `⚠️ ${group.name}`;
        body = `${actorName} deleted this group. It will be removed in 7 days.`;
        break;
      default:
        title = `📢 ${group.name}`;
        body = `${actorName} made changes to the group`;
    }
    
    const notifications = users
      .filter(u => {
        const details = u.getDetails();
        return details.expoPushToken;
      })
      .map(u => ({
        pushToken: u.getDetails().expoPushToken,
        message: {
          title,
          body,
          data: {
            type: notificationType,
            groupId: group._id,
            groupName: group.name,
            ...extraData
          }
        }
      }));
    
    if (notifications.length > 0) {
      await sendPushNotifications(notifications);
      console.log(`📤 Sent ${notificationType} notification to ${notifications.length} members`);
    }
  } catch (error) {
    console.error('Error sending group notification:', error);
  }
}

// Helper: Get email to user details mapping (name + upiId)
async function getEmailToUserDetailsMap(emails) {
  const memberDocs = await User.find({ _id: { $in: emails } });
  const emailToDetails = {};
  memberDocs.forEach(doc => {
    const details = doc.getDetails();
    const name = (doc.name && doc.name.trim()) || doc._id.split('@')[0];
    const upiId = details.upiId || '';
    emailToDetails[doc._id.toLowerCase()] = { name, upiId };
    emailToDetails[doc._id] = { name, upiId };
  });
  emails.forEach(email => {
    const lowerEmail = email.toLowerCase();
    if (!emailToDetails[lowerEmail]) {
      emailToDetails[lowerEmail] = { name: email.split('@')[0], upiId: '' };
      emailToDetails[email] = { name: email.split('@')[0], upiId: '' };
    }
  });
  return emailToDetails;
}

// Helper: Clean up deleted groups from user's groupIds
async function cleanupDeletedGroups(user) {
  const details = user.getDetails();
  const groupIds = details.groupIds || [];
  
  if (groupIds.length === 0) return { cleaned: false, validGroupIds: [] };
  
  // Find which groups still exist and are not deleted
  const existingGroups = await Group.find({ 
    _id: { $in: groupIds },
    status: { $ne: 'deleted' } // Exclude deleted groups
  }).select('_id');
  const existingGroupIds = new Set(existingGroups.map(g => g._id));
  
  // Filter to only valid group IDs (exist and not deleted)
  const validGroupIds = groupIds.filter(id => existingGroupIds.has(id));
  
  // If some were removed, update the user
  if (validGroupIds.length !== groupIds.length) {
    user.setDetails({ ...details, groupIds: validGroupIds });
    await user.save();
    return { cleaned: true, validGroupIds };
  }
  
  return { cleaned: false, validGroupIds: groupIds };
}

// Create new group
router.post('/', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });

    const group = new Group({ 
      _id: uuidv4(),
      name: req.body.name, 
      status: 'active' 
    });
    await group.save();
    
    // Create empty consolidated edges document
    await ConsolidatedEdges.findOrCreateByGroupId(group._id);

    const user = await User.findById(req.user.mailId);
    if (user) { user.addGroupId(group._id); await user.save(); }

    res.status(201).json(group.toJSON());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Checkout - create/update group with expenses
router.post('/checkout', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    const { groupId, groupName, expenses, members } = req.body;
    
    if (!expenses || expenses.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one expense required' });
    }
    
    let group;
    let isNewGroup = false;
    
    // Format new expenses
    const formattedNewExpenses = expenses.map(exp => ({
      name: exp.name || exp.title,
      payer: (exp.paidBy || exp.payer).toLowerCase().trim(),
      totalAmount: exp.totalAmount || exp.amount,
      payees: Object.entries(exp.splits || {}).map(([mailId, amount]) => ({
        mailId: mailId.toLowerCase().trim(),
        amount: parseFloat(amount)
      }))
    }));
    
    if (groupId) {
      // Adding to existing group
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      
      const existingExpenses = group.getExpenses();
      
      // Add new expenses with unique names
      for (const exp of formattedNewExpenses) {
        group.addExpense(exp);
      }
      await group.save();
      
    } else {
      // Creating new group or finding existing by name
      if (!groupName) {
        return res.status(400).json({ success: false, message: 'Group name required for new group' });
      }
      
      const existingGroup = await Group.findOne({ name: groupName });
      
      if (existingGroup) {
        group = existingGroup;
        
        // Add new expenses with unique names
        for (const exp of formattedNewExpenses) {
          group.addExpense(exp);
        }
        await group.save();
        
        isNewGroup = false;
      } else {
        isNewGroup = true;
        const { compressData } = require('../utils/compression');
        
        group = new Group({
          _id: uuidv4(),
          name: groupName,
          status: 'active',
          compressedDetails: compressData({ expenses: [] })
        });
        
        // Add expenses with unique names
        for (const exp of formattedNewExpenses) {
          group.addExpense(exp);
        }
        await group.save();
      }
    }
    
    // Get all expenses and calculate consolidated edges
    const allExpenses = group.getExpenses();
    
    // Get existing resolved edges from consolidated edges table
    let consolidatedEdgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (!consolidatedEdgesDoc) {
      consolidatedEdgesDoc = await ConsolidatedEdges.findOrCreateByGroupId(group._id);
    }
    
    const resolvedPayments = consolidatedEdgesDoc.getResolvedEdges();
    
    // Calculate new consolidated edges
    const newEdges = calculateConsolidatedEdges(allExpenses, resolvedPayments);
    
    // Add back resolved edges
    const allEdges = [
      ...newEdges,
      ...resolvedPayments.map(e => ({ ...e, resolved: true }))
    ];
    
    consolidatedEdgesDoc.setEdges(allEdges);
    await consolidatedEdgesDoc.save();
    
    // Add group to all members
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
      } catch (userError) {}
    }
    
    // Get names for response
    const memberEmails = [...allMembers].map(e => (e || '').toLowerCase().trim()).filter(Boolean);
    const emailToName = await getEmailToNameMap(memberEmails);
    
    const pendingEdges = consolidatedEdgesDoc.getPendingEdges();
    
    const consolidatedWithNames = pendingEdges.map(ce => ({
      from: ce.from,
      to: ce.to,
      amount: ce.amount,
      fromName: emailToName[ce.from] || ce.from.split('@')[0],
      toName: emailToName[ce.to] || ce.to.split('@')[0]
    }));
    
    // Send notifications
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
      } catch (tokenError) {}
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
        expenses: allExpenses,
        consolidatedExpenses: consolidatedWithNames
      }
    });
    
  } catch (e) {
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

// Get all groups for user (with cleanup of deleted groups)
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.mailId);
    if (!user) return res.json([]);
    
    // Clean up deleted groups from user's list
    const { validGroupIds } = await cleanupDeletedGroups(user);
    
    if (validGroupIds.length === 0) return res.json([]);
    
    const groups = await Group.find({ _id: { $in: validGroupIds } });
    
    // Get consolidated edges for each group
    const groupsWithEdges = await Promise.all(groups.map(async (g) => {
      const json = g.toJSON();
      const edgesDoc = await ConsolidatedEdges.findOne({ groupId: g._id });
      json.consolidatedExpenses = edgesDoc ? edgesDoc.edges : [];
      return json;
    }));
    
    res.json(groupsWithEdges);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get pending expenses for user
router.get('/pending', async (req, res) => {
  try {
    const userMailId = req.user.mailId.toLowerCase().trim();
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    // Clean up deleted groups
    const { validGroupIds } = await cleanupDeletedGroups(user);
    
    if (validGroupIds.length === 0) return res.json({ success: true, data: [] });
    
    const groups = await Group.find({ _id: { $in: validGroupIds } });
    
    const allMemberEmails = new Set();
    const pendingExpenses = [];
    
    for (const group of groups) {
      const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
      if (!edgesDoc) continue;
      
      // Edges are stored with lowercase emails, so normalize userMailId for comparison
      const userPendingEdges = edgesDoc.edges.filter(
        edge => edge.from.toLowerCase() === userMailId && !edge.resolved
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
          resolvedEdges: edgesDoc.edges.filter(
            edge => edge.from.toLowerCase() === userMailId && edge.resolved
          )
        });
      }
    }
    
    const emailToDetails = await getEmailToUserDetailsMap(Array.from(allMemberEmails));
    
    const pendingWithNames = pendingExpenses.map(item => ({
      ...item,
      pendingEdges: item.pendingEdges.map(edge => ({
        ...edge,
        fromName: emailToDetails[edge.from]?.name || edge.from.split('@')[0],
        toName: emailToDetails[edge.to]?.name || edge.to.split('@')[0],
        toUpiId: emailToDetails[edge.to]?.upiId || ''
      })),
      resolvedEdges: item.resolvedEdges.map(edge => ({
        ...edge,
        fromName: emailToDetails[edge.from]?.name || edge.from.split('@')[0],
        toName: emailToDetails[edge.to]?.name || edge.to.split('@')[0]
      }))
    }));
    
    res.json({ success: true, data: pendingWithNames });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get awaiting payments for user (money owed TO the user)
router.get('/awaiting', async (req, res) => {
  try {
    const userMailId = req.user.mailId.toLowerCase().trim();
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    // Clean up deleted groups
    const { validGroupIds } = await cleanupDeletedGroups(user);
    
    if (validGroupIds.length === 0) return res.json({ success: true, data: [] });
    
    const groups = await Group.find({ _id: { $in: validGroupIds } });
    
    const allMemberEmails = new Set();
    const awaitingPayments = [];
    
    for (const group of groups) {
      const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
      if (!edgesDoc) continue;
      
      // Get edges where user is the recipient (to) and not resolved
      // Edges are stored with lowercase emails, so normalize userMailId for comparison
      const userAwaitingEdges = edgesDoc.edges.filter(
        edge => edge.to.toLowerCase() === userMailId && !edge.resolved
      );
      
      if (userAwaitingEdges.length > 0) {
        userAwaitingEdges.forEach(edge => {
          allMemberEmails.add(edge.from);
          allMemberEmails.add(edge.to);
        });
        
        awaitingPayments.push({
          groupId: group._id,
          groupName: group.name,
          groupStatus: group.status,
          awaitingEdges: userAwaitingEdges
        });
      }
    }
    
    const emailToDetails = await getEmailToUserDetailsMap(Array.from(allMemberEmails));
    
    const awaitingWithNames = awaitingPayments.map(item => ({
      ...item,
      awaitingEdges: item.awaitingEdges.map(edge => ({
        ...edge,
        fromName: emailToDetails[edge.from]?.name || edge.from.split('@')[0],
        toName: emailToDetails[edge.to]?.name || edge.to.split('@')[0]
      }))
    }));
    
    res.json({ success: true, data: awaitingWithNames });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get history for user (from History table)
router.get('/history', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const user = await User.findById(userMailId);
    if (!user) return res.json({ success: true, data: [] });
    
    // Clean up deleted groups
    const { validGroupIds } = await cleanupDeletedGroups(user);
    
    // Get history records for user's groups
    const historyRecords = await History.findByGroupIds(validGroupIds);
    
    // Get group statuses and updatedAt for all history records
    const groupIds = historyRecords.map(r => r.groupId);
    const groups = await Group.find({ _id: { $in: groupIds } }).select('_id status updatedAt');
    const groupStatusMap = {};
    const groupUpdatedAtMap = {};
    groups.forEach(g => {
      groupStatusMap[g._id] = g.status;
      groupUpdatedAtMap[g._id] = g.updatedAt;
    });
    
    // Filter to only include edges where user is involved
    const allMemberEmails = new Set();
    historyRecords.forEach(record => {
      record.settledEdges.forEach(edge => {
        if (edge.from === userMailId || edge.to === userMailId) {
          allMemberEmails.add(edge.from);
          allMemberEmails.add(edge.to);
        }
      });
    });
    
    const emailToName = await getEmailToNameMap(Array.from(allMemberEmails));
    
    const historyWithNames = historyRecords.map(record => {
      const status = groupStatusMap[record.groupId] || 'completed';
      return {
        id: record._id,
        groupId: record.groupId,
        groupName: record.groupName,
        groupStatus: status,
        settledEdges: record.settledEdges
          .filter(edge => edge.from === userMailId || edge.to === userMailId)
          .map(edge => ({
            ...edge,
            fromName: emailToName[edge.from] || edge.from?.split('@')[0] || 'Unknown',
            toName: emailToName[edge.to] || edge.to?.split('@')[0] || 'Unknown',
          })),
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        updatedAt: (status === 'completed' || status === 'deleted') 
          ? groupUpdatedAtMap[record.groupId] || record.updatedAt 
          : record.updatedAt
      };
    }).filter(record => record.settledEdges.length > 0);
    
    res.json({ success: true, data: historyWithNames });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get single group
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    
    const json = group.toJSON();
    const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    json.consolidatedExpenses = edgesDoc ? edgesDoc.edges : [];
    
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add expense to group
router.post('/:id/expenses', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    
    const { name, payer, payees, amount } = req.body;
    if (!name || !payer || !amount) return res.status(400).json({ error: 'name, payer, amount required' });
    
    group.addExpense({ name, payer, payees: payees || [], amount });
    await group.save();
    
    // Recalculate consolidated edges
    const allExpenses = group.getExpenses();
    let edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (!edgesDoc) {
      edgesDoc = await ConsolidatedEdges.findOrCreateByGroupId(group._id);
    }
    
    const resolvedPayments = edgesDoc.getResolvedEdges();
    const newEdges = calculateConsolidatedEdges(allExpenses, resolvedPayments);
    const allEdges = [
      ...newEdges,
      ...resolvedPayments.map(e => ({ ...e, resolved: true }))
    ];
    
    edgesDoc.setEdges(allEdges);
    await edgesDoc.save();
    
    const json = group.toJSON();
    json.consolidatedExpenses = edgesDoc.edges;
    
    // Send personalized "You owe X to Y" notifications to payees
    const actorMailId = req.user?.mailId || payer;
    const payerLower = payer.toLowerCase().trim();
    
    // Get payer's name
    const payerUser = await User.findById(payerLower);
    const payerName = payerUser?.name || payerLower.split('@')[0];
    
    // Build list of payees to notify (those who owe money to the payer)
    const payeesToNotify = [];
    const expensePayees = payees || [];
    
    for (const payee of expensePayees) {
      const payeeMailId = typeof payee === 'object' ? payee.mailId : payee;
      const payeeAmount = typeof payee === 'object' ? payee.amount : (amount / expensePayees.length);
      
      if (!payeeMailId || payeeMailId.toLowerCase() === payerLower) continue;
      
      try {
        const payeeUser = await User.findById(payeeMailId.toLowerCase());
        if (payeeUser) {
          const payeeDetails = payeeUser.getDetails();
          if (payeeDetails.expoPushToken) {
            payeesToNotify.push({
              mailId: payeeMailId,
              pushToken: payeeDetails.expoPushToken,
              amount: payeeAmount,
              payeeName: payerName, // The person they owe money to
            });
          }
        }
      } catch (tokenError) {}
    }
    
    if (payeesToNotify.length > 0) {
      sendExpenseNotifications(payeesToNotify, name, group.name).catch(() => {});
    }
    
    // Record edit history
    const actorUser = await User.findById(actorMailId);
    EditHistory.addEntry({
      groupId: group._id,
      groupName: group.name,
      action: 'add_expense',
      actionBy: actorMailId,
      actionByName: actorUser?.name || actorMailId.split('@')[0],
      details: {
        expenseName: name,
        newAmount: parseFloat(amount),
        changes: `Added expense "${name}" for ₹${parseFloat(amount).toFixed(2)}`
      }
    }).catch(err => console.error('Failed to record edit history:', err));
    
    console.log(`➕ Expense "${name}" added to group "${group.name}"`);
    console.log(`📊 Recalculated ${newEdges.length} pending settlements, ${resolvedPayments.length} resolved`);
    
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete expense from group
router.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
    
    const { expenseId } = req.params;
    
    // Check if expense exists and get its name for notification
    const expenses = group.getExpenses();
    const expenseIndex = expenses.findIndex(e => (e.id === expenseId) || (e._id === expenseId));
    if (expenseIndex === -1) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    const expenseToDelete = expenses[expenseIndex];
    
    const expenseName = expenseToDelete.name;
    
    // Remove the expense
    group.removeExpense(expenseId);
    await group.save();
    
    // Recalculate consolidated edges
    const allExpenses = group.getExpenses();
    let edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (!edgesDoc) {
      edgesDoc = await ConsolidatedEdges.findOrCreateByGroupId(group._id);
    }
    
    const resolvedPayments = edgesDoc.getResolvedEdges();
    const newEdges = calculateConsolidatedEdges(allExpenses, resolvedPayments);
    const allEdges = [
      ...newEdges,
      ...resolvedPayments.map(e => ({ ...e, resolved: true }))
    ];
    
    edgesDoc.setEdges(allEdges);
    await edgesDoc.save();
    
    const json = group.toJSON();
    json.consolidatedExpenses = edgesDoc.edges;
    
    // Send notification to all group members
    const actorMailId = req.user?.mailId;
    if (actorMailId) {
      sendGroupNotification(group, actorMailId, 'expense_deleted', { expenseName }).catch(() => {});
      
      // Record edit history
      const actorUser = await User.findById(actorMailId);
      EditHistory.addEntry({
        groupId: group._id,
        groupName: group.name,
        action: 'delete_expense',
        actionBy: actorMailId,
        actionByName: actorUser?.name || actorMailId.split('@')[0],
        details: {
          expenseName,
          expenseId,
          changes: `Deleted expense "${expenseName}"`
        }
      }).catch(err => console.error('Failed to record edit history:', err));
    }
    
    console.log(`🗑️ Expense "${expenseName}" deleted from group "${group.name}"`);
    console.log(`📊 Recalculated ${newEdges.length} pending settlements, ${resolvedPayments.length} resolved`);
    
    res.json({ success: true, data: json });
  } catch (e) { 
    console.error('Error deleting expense:', e);
    res.status(500).json({ success: false, error: e.message }); 
  }
});

// Update expense in group
router.put('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
    
    const { expenseId } = req.params;
    const { name, payer, payees, amount, totalAmount } = req.body;
    
    // Get current expenses with IDs
    const expenses = group.getExpenses(); // This returns expenses with generated IDs for legacy data
    const expenseIndex = expenses.findIndex(e => (e.id === expenseId) || (e._id === expenseId));
    
    if (expenseIndex === -1) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    // Get raw details for updating
    const details = group.getDetails();
    
    // Store old values for history
    const oldExpense = { ...details.expenses[expenseIndex] };
    const oldAmount = oldExpense.totalAmount || oldExpense.amount;
    const oldName = oldExpense.name;
    
    // Store expense name for notification
    const expenseName = name || details.expenses[expenseIndex].name;
    
    // Update expense fields
    if (name) details.expenses[expenseIndex].name = name;
    if (payer) details.expenses[expenseIndex].payer = payer.toLowerCase().trim();
    if (payees) {
      details.expenses[expenseIndex].payees = payees.map(p => 
        typeof p === 'object' ? p : p.toLowerCase().trim()
      );
    }
    if (amount !== undefined) details.expenses[expenseIndex].amount = parseFloat(amount);
    if (totalAmount !== undefined) details.expenses[expenseIndex].totalAmount = parseFloat(totalAmount);
    
    // Calculate new amount for history
    const newAmount = totalAmount !== undefined ? parseFloat(totalAmount) : (amount !== undefined ? parseFloat(amount) : oldAmount);
    
    // Save updated expenses
    group.setDetails(details);
    await group.save();
    
    // Recalculate consolidated edges
    const allExpenses = group.getExpenses();
    let edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (!edgesDoc) {
      edgesDoc = await ConsolidatedEdges.findOrCreateByGroupId(group._id);
    }
    
    const resolvedPayments = edgesDoc.getResolvedEdges();
    const newEdges = calculateConsolidatedEdges(allExpenses, resolvedPayments);
    const allEdges = [
      ...newEdges,
      ...resolvedPayments.map(e => ({ ...e, resolved: true }))
    ];
    
    edgesDoc.setEdges(allEdges);
    await edgesDoc.save();
    
    const json = group.toJSON();
    json.consolidatedExpenses = edgesDoc.edges;
    
    // Send notification to all group members
    const actorMailId = req.user?.mailId;
    if (actorMailId) {
      sendGroupNotification(group, actorMailId, 'expense_edited', { expenseName }).catch(() => {});
      
      // Record edit history
      const actorUser = await User.findById(actorMailId);
      const changes = [];
      if (name && name !== oldName) changes.push(`renamed to "${name}"`);
      if (newAmount !== oldAmount) changes.push(`amount changed from ₹${oldAmount?.toFixed(2) || '0'} to ₹${newAmount?.toFixed(2) || '0'}`);
      if (payees) changes.push('members updated');
      
      EditHistory.addEntry({
        groupId: group._id,
        groupName: group.name,
        action: 'edit_expense',
        actionBy: actorMailId,
        actionByName: actorUser?.name || actorMailId.split('@')[0],
        details: {
          expenseName,
          expenseId,
          oldAmount,
          newAmount,
          changes: changes.length > 0 ? `Updated "${expenseName}": ${changes.join(', ')}` : `Updated "${expenseName}"`
        }
      }).catch(err => console.error('Failed to record edit history:', err));
    }
    
    console.log(`✏️ Expense "${expenseName}" updated in group "${group.name}"`);
    console.log(`📊 Recalculated ${newEdges.length} pending settlements, ${resolvedPayments.length} resolved`);
    
    res.json({ success: true, data: json });
  } catch (e) { 
    console.error('Error updating expense:', e);
    res.status(500).json({ success: false, error: e.message }); 
  }
});

// Get settlements for group
router.get('/:id/settle', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    
    const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    res.json({ settlements: edgesDoc ? edgesDoc.edges : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Resolve edge (mark as settled)
router.post('/:id/resolve', async (req, res) => {
  try {
    const { from, to, keepActive } = req.body;
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
    
    // Get consolidated edges
    const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (!edgesDoc) {
      return res.status(404).json({ success: false, message: 'No edges found for group' });
    }
    
    // Find the edge to resolve
    const edgeToResolve = edgesDoc.edges.find(e => e.from === from && e.to === to && !e.resolved);
    if (!edgeToResolve) {
      return res.status(404).json({ success: false, message: 'Edge not found or already resolved' });
    }
    
    // Mark edge as resolved
    const found = edgesDoc.markResolved(from, to);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Edge not found' });
    }
    await edgesDoc.save();
    
    // Add to history
    let historyDoc = await History.findOne({ groupId: group._id });
    if (!historyDoc) {
      historyDoc = await History.findOrCreateByGroupId(group._id, group.name);
    }
    historyDoc.addSettledEdge(edgeToResolve);
    await historyDoc.save();
    
    // Send push notification to recipient
    try {
      const recipient = await User.findById(to);
      if (recipient) {
        const recipientDetails = recipient.getDetails();
        if (recipientDetails.expoPushToken) {
          const payer = await User.findById(from);
          const payerName = payer?.name || from;
          
          await sendPushNotification(recipientDetails.expoPushToken, {
            title: '💸 Payment Received',
            body: `${payerName} has paid ₹${edgeToResolve.amount.toFixed(2)} to you`,
            data: {
              type: 'payment_received',
              screen: 'History',
              groupId: group._id,
              groupName: group.name,
              amount: edgeToResolve.amount,
              payerName,
            },
          });
        }
      }
    } catch (notifError) {
      console.error('Failed to send payment notification:', notifError);
      // Don't fail the request if notification fails
    }
    
    // Check if all edges are resolved
    const allResolved = edgesDoc.areAllResolved();
    let shouldComplete = false;
    
    if (allResolved) {
      // If keepActive is explicitly false or not provided (default behavior), complete the group
      // If keepActive is true, keep the group active
      shouldComplete = keepActive !== true;
      
      if (shouldComplete) {
        group.status = 'completed';
        group.setTTL(7); // Set 7-day TTL
        await group.save();
        
        // Set TTL on consolidated edges
        edgesDoc.setTTL(7);
        await edgesDoc.save();
        
        // Set TTL on history as well
        historyDoc.setTTL(7);
        await historyDoc.save();
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        groupId: group._id,
        groupName: group.name,
        groupStatus: group.status,
        allResolved,
        keepActive: keepActive === true,
        willComplete: shouldComplete
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Mark group as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    
    group.status = 'completed';
    group.setTTL(7); // Set 7-day TTL
    await group.save();
    
    // Set TTL on consolidated edges
    const edgesDoc = await ConsolidatedEdges.findOne({ groupId: group._id });
    if (edgesDoc) {
      edgesDoc.setTTL(7);
      await edgesDoc.save();
    }
    
    // Set TTL on history as well
    const historyDoc = await History.findOne({ groupId: group._id });
    if (historyDoc) {
      historyDoc.setTTL(7);
      await historyDoc.save();
    }
    
    const json = group.toJSON();
    json.consolidatedExpenses = edgesDoc ? edgesDoc.edges : [];
    
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete group (soft delete - marks as deleted with 7-day TTL)
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    // Send notification to all group members BEFORE marking as deleted
    const actorMailId = req.user?.mailId;
    if (actorMailId) {
      await sendGroupNotification(group, actorMailId, 'group_deleted', {});
      
      // Record edit history
      const actorUser = await User.findById(actorMailId);
      EditHistory.addEntry({
        groupId: group._id,
        groupName: group.name,
        action: 'delete_group',
        actionBy: actorMailId,
        actionByName: actorUser?.name || actorMailId.split('@')[0],
        details: {
          changes: `Deleted group "${group.name}"`
        }
      }).catch(err => console.error('Failed to record edit history:', err));
    }
    
    // Mark group as deleted with 7-day TTL
    group.markDeleted();
    await group.save();
    
    // Also set TTL on consolidated edges
    const edgesDoc = await ConsolidatedEdges.findOne({ groupId: req.params.id });
    if (edgesDoc) {
      edgesDoc.setTTL(7);
      await edgesDoc.save();
    }
    
    // Also set TTL on history
    const historyDoc = await History.findOne({ groupId: req.params.id });
    if (historyDoc && historyDoc.setTTL) {
      historyDoc.setTTL(7);
      await historyDoc.save();
    }
    
    console.log(`🗑️ Group "${group.name}" marked as deleted, will be removed in 7 days`);
    
    res.json({ success: true, message: 'Group marked for deletion. Will be permanently removed in 7 days.' });
  } catch (e) { 
    console.error('Error deleting group:', e);
    res.status(500).json({ success: false, error: e.message }); 
  }
});

// Notify recipient that their UPI ID is not set
router.post('/notify-upi-missing', async (req, res) => {
  try {
    const { recipientEmail, amount } = req.body;
    const payerMailId = req.user.mailId;
    
    if (!recipientEmail || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Get payer's name
    const payer = await User.findById(payerMailId);
    const payerName = payer?.name || payerMailId.split('@')[0];
    
    // Get recipient's push token
    const recipient = await User.findById(recipientEmail);
    if (!recipient) {
      return res.json({ success: true, notified: false, reason: 'Recipient not found' });
    }
    
    const recipientDetails = recipient.getDetails();
    if (!recipientDetails.expoPushToken) {
      return res.json({ success: true, notified: false, reason: 'No push token' });
    }
    
    // Send notification
    await sendPushNotification(recipientDetails.expoPushToken, {
      title: '💸 Payment Attempt Failed',
      body: `${payerName} tried to send you ₹${parseFloat(amount).toFixed(2)}, but the payment couldn't be completed because your UPI ID is missing. Add your UPI ID in your Profile to receive future payments.`,
      data: {
        type: 'upi_missing',
        screen: 'Profile',
        payerName,
        amount: parseFloat(amount),
      },
    });
    
    res.json({ success: true, notified: true });
  } catch (e) {
    console.error('Error sending UPI missing notification:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Send payment reminder notification
router.post('/send-reminder', async (req, res) => {
  try {
    const { debtorEmail, amount, groupName } = req.body;
    const creditorMailId = req.user.mailId;
    
    if (!debtorEmail || !amount || !groupName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Get creditor's name
    const creditor = await User.findById(creditorMailId);
    const creditorName = creditor?.name || creditorMailId.split('@')[0];
    
    // Get debtor's push token
    const debtor = await User.findById(debtorEmail);
    if (!debtor) {
      return res.json({ success: true, notified: false, reason: 'User not found' });
    }
    
    const debtorDetails = debtor.getDetails();
    if (!debtorDetails.expoPushToken) {
      return res.json({ success: true, notified: false, reason: 'No push token' });
    }
    
    // Send reminder notification
    await sendPushNotification(debtorDetails.expoPushToken, {
      title: '🔔 Payment Reminder',
      body: `${creditorName} is reminding you about ₹${parseFloat(amount).toFixed(2)} you owe in "${groupName}"`,
      data: {
        type: 'payment_reminder',
        screen: 'PendingExpenses',
        creditorName,
        amount: parseFloat(amount),
        groupName,
      },
    });
    
    res.json({ success: true, notified: true });
  } catch (e) {
    console.error('Error sending payment reminder:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get edit history for a specific group
router.get('/:id/edit-history', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await EditHistory.getGroupHistory(id, limit);
    
    res.json({ success: true, data: history });
  } catch (e) {
    console.error('Error fetching edit history:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get edit history for all user's groups
router.get('/edit-history/all', async (req, res) => {
  try {
    const userMailId = req.user.mailId;
    const limit = parseInt(req.query.limit) || 100;
    
    // Get user's groups
    const user = await User.findById(userMailId);
    if (!user) {
      return res.json({ success: true, data: [] });
    }
    
    const groupIds = user.getGroupIds();
    
    // Get history for all user's groups
    const history = await EditHistory.getHistoryForGroups(groupIds, limit);
    
    res.json({ success: true, data: history });
  } catch (e) {
    console.error('Error fetching user edit history:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
