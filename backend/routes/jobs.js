const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── GET ALL APPROVED JOBS (public, with filters) ────────────────────────────
// GET /api/jobs?title=&location=&jobType=&experience=&skills=&page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const { title, location, jobType, experience, skills, page = 1, limit = 20 } = req.query;

    const where = { status: 'APPROVED' };

    if (title) where.title = { contains: title, mode: 'insensitive' };
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (jobType) where.jobType = jobType.toUpperCase().replace(' ', '_');
    if (experience) where.experience = { contains: experience, mode: 'insensitive' };
    if (skills) where.skills = { contains: skills, mode: 'insensitive' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { recruiter: { select: { id: true, name: true, email: true } } },
        orderBy: { postedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.job.count({ where })
    ]);

    res.json({ success: true, jobs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching jobs.' });
  }
});

// ─── GET JOBS PENDING APPROVAL (Admin only) ───────────────────────────────────
// GET /api/jobs/admin/pending
router.get('/admin/pending', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'PENDING' },
      include: { recruiter: { select: { id: true, name: true, email: true } } },
      orderBy: { postedAt: 'desc' }
    });
    res.json({ success: true, jobs });
  } catch (err) {
    console.error('Get pending jobs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET RECRUITER'S OWN JOBS ─────────────────────────────────────────────────
// GET /api/jobs/recruiter/mine
router.get('/recruiter/mine', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { recruiterId: req.user.id },
      include: { _count: { select: { applications: true } } },
      orderBy: { postedAt: 'desc' }
    });
    res.json({ success: true, jobs });
  } catch (err) {
    console.error('Get my jobs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET SINGLE JOB ──────────────────────────────────────────────────────────
// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        _count: { select: { applications: true } }
      }
    });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.json({ success: true, job });
  } catch (err) {
    console.error('Get job error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST A JOB (Recruiter only) ─────────────────────────────────────────────
// POST /api/jobs
router.post('/', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const { title, company, location, jobType, experience, skills, description, salary } = req.body;

    if (!title || !company || !location || !description) {
      return res.status(400).json({ success: false, message: 'Title, company, location, and description are required.' });
    }

    // Prevent duplicate active or pending jobs for this recruiter
    const existingJob = await prisma.job.findFirst({
      where: {
        recruiterId: req.user.id,
        title: { equals: title.trim(), mode: 'insensitive' },
        company: { equals: company.trim(), mode: 'insensitive' },
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });
    if (existingJob) {
      return res.status(409).json({
        success: false,
        message: 'A job posting with this title and company is already active or pending approval.'
      });
    }

    const job = await prisma.job.create({
      data: {
        title,
        company,
        location,
        jobType: jobType ? jobType.toUpperCase().replace(' ', '_') : 'FULL_TIME',
        experience: experience || '',
        skills: skills || '',
        description,
        salary: salary || null,
        status: req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        recruiterId: req.user.id
      }
    });

    // Notify admin about new job pending approval
    if (req.user.role === 'RECRUITER') {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      const notifications = admins.map(admin => ({
        title: 'New Job Pending Approval',
        message: `Recruiter ${req.user.name} posted a new job: "${title}" at ${company}. Please review.`,
        type: 'JOB',
        userId: admin.id
      }));
      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }

    res.status(201).json({ success: true, message: 'Job posted successfully. Pending admin approval.', job });
  } catch (err) {
    console.error('Post job error:', err);
    res.status(500).json({ success: false, message: 'Server error posting job.' });
  }
});

// ─── UPDATE JOB (Recruiter who posted it, or Admin) ──────────────────────────
// PUT /api/jobs/:id
router.put('/:id', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    // Recruiters can only edit their own jobs
    if (req.user.role === 'RECRUITER' && job.recruiterId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own job postings.' });
    }

    const { title, company, location, jobType, experience, skills, description, salary, status } = req.body;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...(title && { title }),
        ...(company && { company }),
        ...(location && { location }),
        ...(jobType && { jobType: jobType.toUpperCase().replace(' ', '_') }),
        ...(experience && { experience }),
        ...(skills && { skills }),
        ...(description && { description }),
        ...(salary !== undefined && { salary }),
        ...(status && req.user.role === 'ADMIN' && { status })
      }
    });

    res.json({ success: true, message: 'Job updated.', job: updated });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ success: false, message: 'Server error updating job.' });
  }
});

// ─── APPROVE / REJECT JOB (Admin only) ───────────────────────────────────────
// PATCH /api/jobs/:id/approve
router.patch('/:id/approve', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: { status },
      include: { recruiter: true }
    });

    // Notify recruiter
    await prisma.notification.create({
      data: {
        title: `Job ${status === 'APPROVED' ? 'Approved ✅' : 'Rejected ❌'}`,
        message: `Your job posting "${job.title}" has been ${status.toLowerCase()} by the admin.`,
        type: 'JOB',
        userId: job.recruiterId
      }
    });

    res.json({ success: true, message: `Job ${status.toLowerCase()}.`, job });
  } catch (err) {
    console.error('Approve job error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE JOB (Recruiter or Admin) ─────────────────────────────────────────
// DELETE /api/jobs/:id
router.delete('/:id', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    if (req.user.role === 'RECRUITER' && job.recruiterId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own job postings.' });
    }

    // Cascade-delete related records in a transaction to avoid FK violations
    await prisma.$transaction(async (tx) => {
      await tx.interview.deleteMany({ where: { jobId } });
      await tx.application.deleteMany({ where: { jobId } });
      await tx.savedJob.deleteMany({ where: { jobId } });
      await tx.job.delete({ where: { id: jobId } });
    });

    res.json({ success: true, message: 'Job deleted.' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
