const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── GET ALL USERS (Admin) ────────────────────────────────────────────────────
// GET /api/users?role=&page=1
router.get('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const where = role ? { role: role.toUpperCase() } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true,
          _count: { select: { applications: true, jobs: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ success: true, users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── UPDATE OWN PROFILE ───────────────────────────────────────────────────────
// PUT /api/users/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone })
      },
      select: { id: true, name: true, email: true, phone: true, role: true }
    });

    res.json({ success: true, message: 'Profile updated.', user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── SAVED JOBS ───────────────────────────────────────────────────────────────
// GET /api/users/saved-jobs
router.get('/saved-jobs', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const savedJobs = await prisma.savedJob.findMany({
      where: { userId: req.user.id },
      include: {
        job: {
          select: { id: true, title: true, company: true, location: true, jobType: true, experience: true, skills: true }
        }
      },
      orderBy: { savedAt: 'desc' }
    });
    res.json({ success: true, savedJobs });
  } catch (err) {
    console.error('Get saved jobs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users/saved-jobs/:jobId
router.post('/saved-jobs/:jobId', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const existing = await prisma.savedJob.findUnique({
      where: { userId_jobId: { userId: req.user.id, jobId } }
    });

    if (existing) {
      // Toggle: unsave if already saved
      await prisma.savedJob.delete({ where: { id: existing.id } });
      return res.json({ success: true, message: 'Job removed from saved list.', saved: false });
    }

    await prisma.savedJob.create({ data: { userId: req.user.id, jobId } });
    res.json({ success: true, message: 'Job saved!', saved: true });
  } catch (err) {
    console.error('Save job error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET SINGLE USER (Admin or self) ─────────────────────────────────────────
// GET /api/users/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true
      }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── TOGGLE USER ACTIVE STATUS (Admin) ───────────────────────────────────────
// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, isActive: true, role: true }
    });

    res.json({
      success: true,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'}.`,
      user: updated
    });
  } catch (err) {
    console.error('Toggle active error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE USER (Admin) ──────────────────────────────────────────────────────
// DELETE /api/users/:id
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    // Check user exists first
    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cascade delete all related records in the correct order to avoid FK constraint violations.
    // Order matters: delete child records before parent records.
    await prisma.$transaction(async (tx) => {
      // 1. Delete notifications belonging to this user
      await tx.notification.deleteMany({ where: { userId } });

      // 2. Delete saved jobs
      await tx.savedJob.deleteMany({ where: { userId } });

      // 3. Delete reviews written by this user
      await tx.review.deleteMany({ where: { authorId: userId } });

      // 4. Delete interviews where user is the candidate or recruiter
      await tx.interview.deleteMany({
        where: { OR: [{ candidateId: userId }, { recruiterId: userId }] }
      });

      // 5. Delete applications submitted by this user
      await tx.application.deleteMany({ where: { candidateId: userId } });

      // 6. Delete reports generated by this user
      await tx.report.deleteMany({ where: { generatedById: userId } });

      // 7. Resumes: Safely unlink from any applications first before deleting resumes
      const userResumes = await tx.resume.findMany({ where: { userId }, select: { id: true } });
      const resumeIds = userResumes.map(r => r.id);
      if (resumeIds.length > 0) {
        await tx.application.updateMany({
          where: { resumeId: { in: resumeIds } },
          data: { resumeId: null }
        });
        await tx.resume.deleteMany({ where: { id: { in: resumeIds } } });
      }

      // 8. Handle jobs posted by this user (recruiter):
      //    Delete all applications + interviews + savedJobs tied to their job postings, then delete the jobs
      const userJobs = await tx.job.findMany({ where: { recruiterId: userId }, select: { id: true } });
      const jobIds = userJobs.map(j => j.id);
      if (jobIds.length > 0) {
        await tx.interview.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.application.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.savedJob.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.job.deleteMany({ where: { id: { in: jobIds } } });
      }

      // 9. Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ success: true, message: 'User and all related records deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error deleting user.' });
  }
});

module.exports = router;
