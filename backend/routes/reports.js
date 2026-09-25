const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── GET ADMIN DASHBOARD STATS ────────────────────────────────────────────────
// GET /api/reports/dashboard
router.get('/dashboard', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const [
      totalUsers, totalJobs, totalApplications, totalInterviews,
      pendingJobs, activeUsers, recentApplications, jobsByStatus,
      applicationsByStatus
    ] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.interview.count(),
      prisma.job.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.application.findMany({
        take: 5,
        orderBy: { appliedAt: 'desc' },
        include: {
          candidate: { select: { name: true } },
          job: { select: { title: true, company: true } }
        }
      }),
      prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.application.groupBy({ by: ['status'], _count: { _all: true } })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers, totalJobs, totalApplications, totalInterviews,
        pendingJobs, activeUsers
      },
      recentApplications,
      jobsByStatus,
      applicationsByStatus
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET RECRUITER DASHBOARD STATS ───────────────────────────────────────────
// GET /api/reports/recruiter
router.get('/recruiter', authenticateToken, requireRole('RECRUITER'), async (req, res) => {
  try {
    const recruiterId = req.user.id;

    const [
      myJobs, totalApplications, totalInterviews,
      applicationsByStatus, recentApplicants
    ] = await Promise.all([
      prisma.job.count({ where: { recruiterId } }),
      prisma.application.count({ where: { job: { recruiterId } } }),
      prisma.interview.count({ where: { recruiterId } }),
      prisma.application.groupBy({
        by: ['status'],
        where: { job: { recruiterId } },
        _count: { _all: true }
      }),
      prisma.application.findMany({
        where: { job: { recruiterId } },
        take: 5,
        orderBy: { appliedAt: 'desc' },
        include: {
          candidate: { select: { name: true, email: true } },
          job: { select: { title: true } }
        }
      })
    ]);

    res.json({
      success: true,
      stats: { myJobs, totalApplications, totalInterviews },
      applicationsByStatus,
      recentApplicants
    });
  } catch (err) {
    console.error('Recruiter report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET CANDIDATE DASHBOARD STATS ───────────────────────────────────────────
// GET /api/reports/candidate
router.get('/candidate', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const candidateId = req.user.id;

    const [
      totalApplications, totalInterviews, savedJobs,
      applicationsByStatus, upcomingInterviews
    ] = await Promise.all([
      prisma.application.count({ where: { candidateId } }),
      prisma.interview.count({ where: { candidateId } }),
      prisma.savedJob.count({ where: { userId: candidateId } }),
      prisma.application.groupBy({
        by: ['status'],
        where: { candidateId },
        _count: { _all: true }
      }),
      prisma.interview.findMany({
        where: { candidateId, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
        take: 3,
        orderBy: { scheduledAt: 'asc' },
        include: { job: { select: { title: true, company: true } } }
      })
    ]);

    res.json({
      success: true,
      stats: { totalApplications, totalInterviews, savedJobs },
      applicationsByStatus,
      upcomingInterviews
    });
  } catch (err) {
    console.error('Candidate report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── APPLICATION REPORT (Admin) ───────────────────────────────────────────────
// GET /api/reports/applications?from=&to=
router.get('/applications', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.appliedAt = {};
      if (from) where.appliedAt.gte = new Date(from);
      if (to) where.appliedAt.lte = new Date(to);
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true, location: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });

    res.json({ success: true, count: applications.length, applications });
  } catch (err) {
    console.error('Applications report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── USER REPORT (Admin) ──────────────────────────────────────────────────────
// GET /api/reports/users
router.get('/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true,
        _count: { select: { applications: true, jobs: true, interviews: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const byRole = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });

    res.json({ success: true, users, byRole });
  } catch (err) {
    console.error('Users report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── JOB REPORT (Admin) ───────────────────────────────────────────────────────
// GET /api/reports/jobs
router.get('/jobs', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        recruiter: { select: { name: true, email: true } },
        _count: { select: { applications: true, interviews: true } }
      },
      orderBy: { postedAt: 'desc' }
    });

    const byStatus = await prisma.job.groupBy({ by: ['status'], _count: { _all: true } });
    const byType = await prisma.job.groupBy({ by: ['jobType'], _count: { _all: true } });

    res.json({ success: true, jobs, byStatus, byType });
  } catch (err) {
    console.error('Jobs report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
