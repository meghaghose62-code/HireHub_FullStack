const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── GET MY NOTIFICATIONS ─────────────────────────────────────────────────────
// GET /api/notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── MARK ALL AS READ (must be before /:id routes to avoid param conflicts) ────
// PATCH /api/notifications/read-all
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── MARK NOTIFICATION AS READ ────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE NOTIFICATION ──────────────────────────────────────────────────────
// DELETE /api/notifications/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (notification.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await prisma.notification.delete({ where: { id: notification.id } });
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── SEND SYSTEM NOTIFICATION (Admin only) ───────────────────────────────────
// POST /api/notifications/broadcast
router.post('/broadcast', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { title, message, targetRole, userId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    if (userId) {
      const targetUserId = parseInt(userId);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID.' });
      }
      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          type: 'SYSTEM',
          userId: targetUserId
        }
      });
      return res.json({ success: true, message: 'Notification sent to user.', notification });
    }

    const where = targetRole ? { role: targetRole.toUpperCase() } : {};
    const users = await prisma.user.findMany({ where, select: { id: true } });

    const notifications = users.map(user => ({
      title,
      message,
      type: 'SYSTEM',
      userId: user.id
    }));

    await prisma.notification.createMany({ data: notifications });
    res.json({ success: true, message: `Broadcast sent to ${notifications.length} users.` });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
