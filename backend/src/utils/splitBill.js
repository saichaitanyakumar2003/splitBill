function consolidateExpenses(expenses) {
  const balances = {};
  
  for (const expense of expenses) {
    const payer = expense.payer;
    const totalPaid = expense.totalAmount || (expense.payees || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    if (!balances[payer]) balances[payer] = 0;
    balances[payer] += totalPaid;
    
    for (const payee of (expense.payees || [])) {
      const payeeId = typeof payee === 'object' ? payee.mailId : payee;
      const payeeAmount = typeof payee === 'object' ? payee.amount : (totalPaid / (expense.payees || []).length);
      
      if (!balances[payeeId]) balances[payeeId] = 0;
      balances[payeeId] -= payeeAmount;
    }
  }
  
  const creditors = [];
  const debtors = [];
  
  for (const [person, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    
    if (roundedBalance > 0.01) {
      creditors.push({ person, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ person, amount: Math.abs(roundedBalance) });
    }
  }
  
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  const transactions = [];
  
  let i = 0;
  let j = 0;
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const transactionAmount = Math.min(creditor.amount, debtor.amount);
    
    if (transactionAmount > 0.01) {
      transactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.round(transactionAmount * 100) / 100,
        resolved: false
      });
    }
    
    creditor.amount -= transactionAmount;
    debtor.amount -= transactionAmount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
  return transactions;
}

function mergeAndConsolidate(existingExpenses = [], newExpenses = [], existingConsolidated = []) {
  const allExpenses = [...existingExpenses, ...newExpenses];
  
  const balances = {};
  
  for (const expense of allExpenses) {
    const payer = expense.payer;
    const totalPaid = expense.totalAmount || (expense.payees || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    if (!balances[payer]) balances[payer] = 0;
    balances[payer] += totalPaid;
    
    for (const payee of (expense.payees || [])) {
      const payeeId = typeof payee === 'object' ? payee.mailId : payee;
      const payeeAmount = typeof payee === 'object' ? payee.amount : (totalPaid / (expense.payees || []).length);
      
      if (!balances[payeeId]) balances[payeeId] = 0;
      balances[payeeId] -= payeeAmount;
    }
  }
  
  const resolvedEdges = existingConsolidated.filter(e => e.resolved);
  for (const payment of resolvedEdges) {
    if (!balances[payment.from]) balances[payment.from] = 0;
    if (!balances[payment.to]) balances[payment.to] = 0;
    balances[payment.from] += payment.amount;
    balances[payment.to] -= payment.amount;
  }
  
  const creditors = [];
  const debtors = [];
  
  for (const [person, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    
    if (roundedBalance > 0.01) {
      creditors.push({ person, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ person, amount: Math.abs(roundedBalance) });
    }
  }
  
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  const newTransactions = [];
  
  let i = 0;
  let j = 0;
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const transactionAmount = Math.min(creditor.amount, debtor.amount);
    
    if (transactionAmount > 0.01) {
      newTransactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.round(transactionAmount * 100) / 100,
        resolved: false
      });
    }
    
    creditor.amount -= transactionAmount;
    debtor.amount -= transactionAmount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
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

