/**
 * Analysis Helper
 * Utility functions to update user analysis when expenses are added, edited, or deleted
 */

const Analysis = require('../models/Analysis');
const { categorizeExpense } = require('./expenseCategories');

/**
 * Get month string from a date or createdAt timestamp
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Month in "YYYY-MM" format
 */
function getMonthFromDate(date) {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Extract member emails from an expense
 * @param {Object} expense - Expense object with payer and payees
 * @returns {Set<string>} Set of normalized email addresses
 */
function getExpenseMembers(expense) {
  const members = new Set();
  
  // Add payer
  if (expense.payer) {
    members.add(expense.payer.toLowerCase().trim());
  }
  
  // Add payees
  if (expense.payees && Array.isArray(expense.payees)) {
    expense.payees.forEach(payee => {
      if (typeof payee === 'object' && payee.mailId) {
        members.add(payee.mailId.toLowerCase().trim());
      } else if (typeof payee === 'string') {
        members.add(payee.toLowerCase().trim());
      }
    });
  }
  
  return members;
}

/**
 * Get amount for a specific member from an expense
 * For payer: the total amount they paid
 * For payee: the amount they owe (their split)
 * 
 * @param {Object} expense - Expense object
 * @param {string} mailId - Member's email
 * @returns {number} Amount for this member
 */
function getMemberAmount(expense, mailId) {
  const normalizedMailId = mailId.toLowerCase().trim();
  const totalAmount = expense.totalAmount || expense.amount;
  
  // Check if member is a payee
  if (expense.payees && Array.isArray(expense.payees)) {
    for (const payee of expense.payees) {
      if (typeof payee === 'object' && payee.mailId) {
        if (payee.mailId.toLowerCase().trim() === normalizedMailId) {
          return payee.amount || (totalAmount / expense.payees.length);
        }
      } else if (typeof payee === 'string' && payee.toLowerCase().trim() === normalizedMailId) {
        return totalAmount / expense.payees.length;
      }
    }
  }
  
  // If member is payer but not payee, they don't have a personal expense amount
  // Return 0 since the analysis tracks what people spent, not what they paid for others
  return 0;
}

/**
 * Update analysis when an expense is ADDED
 * @param {Object} expense - The new expense object { name, payer, payees, amount, totalAmount, createdAt }
 */
async function onExpenseAdded(expense) {
  try {
    const expenseTitle = expense.name || 'Expense';
    const category = await categorizeExpense(expenseTitle);
    const month = getMonthFromDate(expense.createdAt);
    const members = getExpenseMembers(expense);
    
    console.log(`📊 Analysis: Adding expense "${expenseTitle}" (${category}) for ${members.size} members`);
    
    // Build update list for each member
    const updates = [];
    for (const mailId of members) {
      const amount = getMemberAmount(expense, mailId);
      if (amount > 0) {
        updates.push({
          mailId,
          category,
          month,
          amountDelta: amount
        });
      }
    }
    
    if (updates.length > 0) {
      await Analysis.bulkUpdateAnalysis(updates);
      console.log(`📊 Analysis: Updated ${updates.length} user(s) for category "${category}"`);
    }
    
    return { category, month, membersUpdated: updates.length };
  } catch (error) {
    console.error('Error updating analysis on expense add:', error);
    return null;
  }
}

/**
 * Update analysis when an expense is DELETED
 * @param {Object} expense - The deleted expense object
 */
async function onExpenseDeleted(expense) {
  try {
    const expenseTitle = expense.name || 'Expense';
    const category = await categorizeExpense(expenseTitle);
    const month = getMonthFromDate(expense.createdAt);
    const members = getExpenseMembers(expense);
    
    console.log(`📊 Analysis: Removing expense "${expenseTitle}" (${category}) for ${members.size} members`);
    
    // Build update list for each member (negative amounts)
    const updates = [];
    for (const mailId of members) {
      const amount = getMemberAmount(expense, mailId);
      if (amount > 0) {
        updates.push({
          mailId,
          category,
          month,
          amountDelta: -amount // Negative to subtract
        });
      }
    }
    
    if (updates.length > 0) {
      await Analysis.bulkUpdateAnalysis(updates);
      console.log(`📊 Analysis: Removed amounts for ${updates.length} user(s)`);
    }
    
    return { category, month, membersUpdated: updates.length };
  } catch (error) {
    console.error('Error updating analysis on expense delete:', error);
    return null;
  }
}

/**
 * Update analysis when an expense is EDITED
 * @param {Object} oldExpense - The expense before editing
 * @param {Object} newExpense - The expense after editing
 */
async function onExpenseEdited(oldExpense, newExpense) {
  try {
    // First, remove the old expense amounts
    await onExpenseDeleted(oldExpense);
    
    // Then, add the new expense amounts
    await onExpenseAdded(newExpense);
    
    console.log(`📊 Analysis: Updated expense from "${oldExpense.name}" to "${newExpense.name}"`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating analysis on expense edit:', error);
    return null;
  }
}

/**
 * Process checkout with multiple expenses
 * @param {Array} expenses - Array of expense objects
 */
async function onCheckout(expenses) {
  try {
    console.log(`📊 Analysis: Processing checkout with ${expenses.length} expenses`);
    
    let totalUpdated = 0;
    
    for (const expense of expenses) {
      const result = await onExpenseAdded(expense);
      if (result) {
        totalUpdated += result.membersUpdated;
      }
    }
    
    console.log(`📊 Analysis: Checkout complete, ${totalUpdated} total updates`);
    
    return { success: true, totalUpdated };
  } catch (error) {
    console.error('Error processing checkout for analysis:', error);
    return null;
  }
}

module.exports = {
  onExpenseAdded,
  onExpenseDeleted,
  onExpenseEdited,
  onCheckout,
  getMonthFromDate,
  getExpenseMembers,
  getMemberAmount
};
