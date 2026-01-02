/**
 * Splitwise Algorithm for Minimum Transactions
 * 
 * This algorithm calculates the minimum number of transactions needed
 * to settle all debts between group members.
 */

/**
 * Calculate consolidated expenses with minimum transactions
 * @param {Array} expenses - Array of expenses, each with { payer, totalAmount, payees: [{ mailId, amount }] }
 * @returns {Array} - Array of consolidated transactions { from, to, amount }
 */
function consolidateExpenses(expenses) {
  // Step 1: Calculate net balance for each person
  const balances = {};
  
  for (const expense of expenses) {
    const payer = expense.payer;
    const totalPaid = expense.totalAmount || (expense.payees || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Payer gets credited for total amount paid
    if (!balances[payer]) balances[payer] = 0;
    balances[payer] += totalPaid;
    
    // Each payee gets debited for their share
    for (const payee of (expense.payees || [])) {
      const payeeId = typeof payee === 'object' ? payee.mailId : payee;
      const payeeAmount = typeof payee === 'object' ? payee.amount : (totalPaid / (expense.payees || []).length);
      
      if (!balances[payeeId]) balances[payeeId] = 0;
      balances[payeeId] -= payeeAmount;
    }
  }
  
  // Step 2: Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = []; // People who need to receive money
  const debtors = [];   // People who need to pay money
  
  for (const [person, balance] of Object.entries(balances)) {
    // Round to 2 decimal places to avoid floating point issues
    const roundedBalance = Math.round(balance * 100) / 100;
    
    if (roundedBalance > 0.01) {
      creditors.push({ person, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ person, amount: Math.abs(roundedBalance) });
    }
  }
  
  // Sort by amount (descending) for optimal matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  // Step 3: Match debtors with creditors using greedy algorithm
  const transactions = [];
  
  let i = 0; // creditor index
  let j = 0; // debtor index
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    // The transaction amount is the minimum of what's owed and what's needed
    const transactionAmount = Math.min(creditor.amount, debtor.amount);
    
    if (transactionAmount > 0.01) {
      transactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.round(transactionAmount * 100) / 100,
        resolved: false
      });
    }
    
    // Update remaining amounts
    creditor.amount -= transactionAmount;
    debtor.amount -= transactionAmount;
    
    // Move to next creditor/debtor if their balance is settled
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
  return transactions;
}

/**
 * Merge new expenses with existing ones, accounting for resolved (already paid) amounts
 * @param {Array} existingExpenses - Existing expenses in the group
 * @param {Array} newExpenses - New expenses to add
 * @param {Array} existingConsolidated - Existing consolidated expenses (with resolved flags)
 * @returns {Object} - { allExpenses, consolidatedExpenses }
 */
function mergeAndConsolidate(existingExpenses = [], newExpenses = [], existingConsolidated = []) {
  const allExpenses = [...existingExpenses, ...newExpenses];
  
  // Step 1: Calculate net balance for each person from ALL expenses
  const balances = {};
  
  for (const expense of allExpenses) {
    const payer = expense.payer;
    const totalPaid = expense.totalAmount || (expense.payees || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Payer gets credited for total amount paid
    if (!balances[payer]) balances[payer] = 0;
    balances[payer] += totalPaid;
    
    // Each payee gets debited for their share
    for (const payee of (expense.payees || [])) {
      const payeeId = typeof payee === 'object' ? payee.mailId : payee;
      const payeeAmount = typeof payee === 'object' ? payee.amount : (totalPaid / (expense.payees || []).length);
      
      if (!balances[payeeId]) balances[payeeId] = 0;
      balances[payeeId] -= payeeAmount;
    }
  }
  
  // Step 2: SUBTRACT resolved payments from balances
  // If B paid A ₹50 (resolved), then:
  // - B's balance increases by ₹50 (B paid out, so B owes less)
  // - A's balance decreases by ₹50 (A received, so A is owed less)
  const resolvedEdges = existingConsolidated.filter(e => e.resolved);
  for (const payment of resolvedEdges) {
    if (!balances[payment.from]) balances[payment.from] = 0;
    if (!balances[payment.to]) balances[payment.to] = 0;
    balances[payment.from] += payment.amount;
    balances[payment.to] -= payment.amount;
  }
  
  // Step 3: Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = []; // People who need to receive money
  const debtors = [];   // People who need to pay money
  
  for (const [person, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    
    if (roundedBalance > 0.01) {
      creditors.push({ person, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ person, amount: Math.abs(roundedBalance) });
    }
  }
  
  // Sort by amount (descending) for optimal matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  // Step 4: Match debtors with creditors using greedy algorithm
  const newTransactions = [];
  
  let i = 0; // creditor index
  let j = 0; // debtor index
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const transactionAmount = Math.min(creditor.amount, debtor.amount);
    
    if (transactionAmount > 0.01) {
      newTransactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.round(transactionAmount * 100) / 100,
        resolved: false // New pending payments
      });
    }
    
    creditor.amount -= transactionAmount;
    debtor.amount -= transactionAmount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
  // Step 5: Combine new pending transactions with resolved ones (for history)
  const consolidatedExpenses = [
    ...newTransactions,
    ...resolvedEdges.map(e => ({ ...e, resolved: true }))
  ];
  
  return {
    allExpenses,
    consolidatedExpenses
  };
}

module.exports = {
  consolidateExpenses,
  mergeAndConsolidate
};

