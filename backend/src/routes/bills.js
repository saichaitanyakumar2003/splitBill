const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');

// In-memory storage for temporary bills (before adding to group)
let billsStore = new Map();

// POST /api/bills - Create a temp bill (from OCR or manual)
router.post('/', async (req, res) => {
  try {
    const { name, items, subtotal, tax, tip, total, groupId, createdBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Bill must have at least one item' });
    }

    const bill = {
      id: uuidv4(),
      name: name || `Bill ${new Date().toLocaleDateString()}`,
      items: items.map(item => ({
        id: uuidv4(),
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice || item.price,
        assignedTo: item.assignedTo || []
      })),
      subtotal: subtotal || items.reduce((sum, i) => sum + (i.totalPrice || i.price), 0),
      tax: tax || 0,
      tip: tip || 0,
      total: total || 0,
      groupId: groupId || null,
      createdBy: createdBy || 'anonymous',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    billsStore.set(bill.id, bill);
    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const { groupId } = req.query;
    let bills = Array.from(billsStore.values());
    if (groupId) bills = bills.filter(b => b.groupId === groupId);
    res.json(bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bills/:id
router.get('/:id', async (req, res) => {
  try {
    const bill = billsStore.get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/bills/:id
router.put('/:id', async (req, res) => {
  try {
    const bill = billsStore.get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const updated = { ...bill, ...req.body, updatedAt: new Date().toISOString() };
    billsStore.set(req.params.id, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bills/:id/assign - Assign items to people
router.post('/:id/assign', async (req, res) => {
  try {
    const bill = billsStore.get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { assignments } = req.body;
    bill.items = bill.items.map(item => {
      if (assignments[item.id]) {
        return { ...item, assignedTo: assignments[item.id] };
      }
      return item;
    });

    billsStore.set(req.params.id, bill);
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bills/:id/split - Calculate splits
router.get('/:id/split', async (req, res) => {
  try {
    const bill = billsStore.get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { splitTaxTip } = req.query;
    const splits = calculateSplits(bill, splitTaxTip === 'proportional');

    res.json({ billId: req.params.id, billTotal: bill.total, subtotal: bill.subtotal, tax: bill.tax, tip: bill.tip, splits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bills/:id/toGroup - Convert bill to group expenses
router.post('/:id/toGroup', async (req, res) => {
  try {
    const bill = billsStore.get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { groupId, payer } = req.body;
    if (!groupId || !payer) {
      return res.status(400).json({ error: 'groupId and payer required' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Add each assigned item as an expense
    for (const item of bill.items) {
      if (item.assignedTo && item.assignedTo.length > 0) {
        group.addExpense({
          name: item.name,
          payer: payer,
          payees: item.assignedTo,
          amount: item.totalPrice
        });
      }
    }

    // Add tax and tip as shared expenses
    const allPayees = [...new Set(bill.items.flatMap(i => i.assignedTo || []))];
    if (bill.tax > 0 && allPayees.length > 0) {
      group.addExpense({ name: 'Tax', payer, payees: allPayees, amount: bill.tax });
    }
    if (bill.tip > 0 && allPayees.length > 0) {
      group.addExpense({ name: 'Tip', payer, payees: allPayees, amount: bill.tip });
    }

    await group.save();
    billsStore.delete(req.params.id);

    res.json({ success: true, group: group.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function calculateSplits(bill, proportionalTaxTip = true) {
  const personTotals = {};
  const allPeople = new Set();

  for (const item of bill.items) {
    const assignees = item.assignedTo || [];
    if (assignees.length === 0) continue;
    const share = item.totalPrice / assignees.length;
    for (const personId of assignees) {
      allPeople.add(personId);
      if (!personTotals[personId]) personTotals[personId] = { items: 0, tax: 0, tip: 0, total: 0 };
      personTotals[personId].items += share;
    }
  }

  const people = Array.from(allPeople);
  const { subtotal = 0, tax = 0, tip = 0 } = bill;

  for (const personId of people) {
    const p = personTotals[personId];
    if (proportionalTaxTip && subtotal > 0) {
      const ratio = p.items / subtotal;
      p.tax = tax * ratio;
      p.tip = tip * ratio;
    } else {
      p.tax = tax / people.length;
      p.tip = tip / people.length;
    }
    p.total = p.items + p.tax + p.tip;
    p.items = Math.round(p.items * 100) / 100;
    p.tax = Math.round(p.tax * 100) / 100;
    p.tip = Math.round(p.tip * 100) / 100;
    p.total = Math.round(p.total * 100) / 100;
  }

  return personTotals;
}

module.exports = router;
