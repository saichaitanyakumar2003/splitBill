const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../utils/supabase');

// In-memory storage fallback (when Supabase is not configured)
let billsStore = new Map();

// POST /api/bills - Create a new bill
router.post('/', async (req, res, next) => {
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

    // Try to save to Supabase, fallback to in-memory
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .insert(bill)
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    // In-memory fallback
    billsStore.set(bill.id, bill);
    res.status(201).json(bill);

  } catch (error) {
    next(error);
  }
});

// GET /api/bills - Get all bills
router.get('/', async (req, res, next) => {
  try {
    const { groupId } = req.query;
    
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase.from('bills').select('*');
      if (groupId) {
        query = query.eq('groupId', groupId);
      }
      const { data, error } = await query.order('createdAt', { ascending: false });
      if (error) throw error;
      return res.json(data);
    }

    // In-memory fallback
    let bills = Array.from(billsStore.values());
    if (groupId) {
      bills = bills.filter(b => b.groupId === groupId);
    }
    res.json(bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

  } catch (error) {
    next(error);
  }
});

// GET /api/bills/:id - Get a specific bill
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Bill not found' });
      return res.json(data);
    }

    // In-memory fallback
    const bill = billsStore.get(id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);

  } catch (error) {
    next(error);
  }
});

// PUT /api/bills/:id - Update a bill
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .update({ ...updates, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return res.json(data);
    }

    // In-memory fallback
    const bill = billsStore.get(id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    const updatedBill = { ...bill, ...updates, updatedAt: new Date().toISOString() };
    billsStore.set(id, updatedBill);
    res.json(updatedBill);

  } catch (error) {
    next(error);
  }
});

// POST /api/bills/:id/assign - Assign items to people
router.post('/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body; // { itemId: [personId1, personId2], ... }

    const supabase = getSupabase();
    let bill;

    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      bill = data;
    } else {
      bill = billsStore.get(id);
    }

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Update item assignments
    bill.items = bill.items.map(item => {
      if (assignments[item.id]) {
        return { ...item, assignedTo: assignments[item.id] };
      }
      return item;
    });

    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .update({ items: bill.items, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json(data);
    }

    billsStore.set(id, bill);
    res.json(bill);

  } catch (error) {
    next(error);
  }
});

// GET /api/bills/:id/split - Calculate split amounts per person
router.get('/:id/split', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { splitTaxTip } = req.query; // 'equal' or 'proportional'

    const supabase = getSupabase();
    let bill;

    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      bill = data;
    } else {
      bill = billsStore.get(id);
    }

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const splits = calculateSplits(bill, splitTaxTip === 'proportional');

    res.json({
      billId: id,
      billTotal: bill.total,
      subtotal: bill.subtotal,
      tax: bill.tax,
      tip: bill.tip,
      splits
    });

  } catch (error) {
    next(error);
  }
});

function calculateSplits(bill, proportionalTaxTip = true) {
  const personTotals = {};
  const allPeople = new Set();

  // Calculate item totals per person
  for (const item of bill.items) {
    const assignees = item.assignedTo || [];
    if (assignees.length === 0) continue;

    const sharePerPerson = item.totalPrice / assignees.length;
    
    for (const personId of assignees) {
      allPeople.add(personId);
      if (!personTotals[personId]) {
        personTotals[personId] = { items: 0, tax: 0, tip: 0, total: 0 };
      }
      personTotals[personId].items += sharePerPerson;
    }
  }

  const peopleArray = Array.from(allPeople);
  const subtotal = bill.subtotal || 0;
  const tax = bill.tax || 0;
  const tip = bill.tip || 0;

  // Distribute tax and tip
  for (const personId of peopleArray) {
    const person = personTotals[personId];
    
    if (proportionalTaxTip && subtotal > 0) {
      // Proportional: based on their share of subtotal
      const proportion = person.items / subtotal;
      person.tax = tax * proportion;
      person.tip = tip * proportion;
    } else {
      // Equal split
      person.tax = tax / peopleArray.length;
      person.tip = tip / peopleArray.length;
    }

    person.total = person.items + person.tax + person.tip;
    
    // Round all values
    person.items = Math.round(person.items * 100) / 100;
    person.tax = Math.round(person.tax * 100) / 100;
    person.tip = Math.round(person.tip * 100) / 100;
    person.total = Math.round(person.total * 100) / 100;
  }

  return personTotals;
}

module.exports = router;

