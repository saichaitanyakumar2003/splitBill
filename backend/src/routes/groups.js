const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage (will be replaced with MongoDB Group model later)
let groupsStore = new Map();

// POST /api/groups - Create a new group
router.post('/', async (req, res, next) => {
  try {
    const { name, members, createdBy } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = {
      id: uuidv4(),
      name,
      members: (members || []).map(member => ({
        id: member.id || uuidv4(),
        name: member.name,
        email: member.email || null,
        phone: member.phone || null,
        avatar: member.avatar || null
      })),
      createdBy: createdBy || 'anonymous',
      createdAt: new Date().toISOString(),
      inviteCode: generateInviteCode()
    };

    groupsStore.set(group.id, group);
    res.status(201).json(group);

  } catch (error) {
    next(error);
  }
});

// GET /api/groups - Get all groups for a user
router.get('/', async (req, res, next) => {
  try {
    res.json(Array.from(groupsStore.values()));
  } catch (error) {
    next(error);
  }
});

// GET /api/groups/:id - Get a specific group
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = groupsStore.get(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);

  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:id/members - Add members to a group
router.post('/:id/members', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Members array is required' });
    }

    const group = groupsStore.get(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const newMembers = members.map(member => ({
      id: member.id || uuidv4(),
      name: member.name,
      email: member.email || null,
      phone: member.phone || null,
      avatar: member.avatar || null
    }));

    group.members = [...(group.members || []), ...newMembers];
    groupsStore.set(id, group);
    res.json(group);

  } catch (error) {
    next(error);
  }
});

// DELETE /api/groups/:id/members/:memberId - Remove a member from a group
router.delete('/:id/members/:memberId', async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    const group = groupsStore.get(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    group.members = (group.members || []).filter(m => m.id !== memberId);
    groupsStore.set(id, group);
    res.json(group);

  } catch (error) {
    next(error);
  }
});

// POST /api/groups/join - Join a group via invite code
router.post('/join', async (req, res, next) => {
  try {
    const { inviteCode, member } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    if (!member || !member.name) {
      return res.status(400).json({ error: 'Member name is required' });
    }

    const group = Array.from(groupsStore.values()).find(g => g.inviteCode === inviteCode);
    if (!group) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const newMember = {
      id: member.id || uuidv4(),
      name: member.name,
      email: member.email || null,
      phone: member.phone || null,
      avatar: member.avatar || null
    };

    group.members = [...(group.members || []), newMember];
    groupsStore.set(group.id, group);
    res.json({ group, member: newMember });

  } catch (error) {
    next(error);
  }
});

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = router;
