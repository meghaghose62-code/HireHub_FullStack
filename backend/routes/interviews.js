const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── SCHEDULE INTERVIEW (Recruiter) ──────────────────────────────────────────
// POST /api/interviews
router.post('/', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const { candidateId, jobId, applicationId, scheduledAt, location, mode, notes } = req.body;

    if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
      return res.status(400).json({ success: false, message: 'A valid scheduled date and time is required.' });
    }

    let appRecord = null;
    if (applicationId) {
      const parsedAppId = parseInt(applicationId);
      if (isNaN(parsedAppId)) {
        return res.status(400).json({ success: false, message: 'Invalid application ID format.' });
      }
      appRecord = await prisma.application.findUnique({
        where: { id: parsedAppId },
        include: { candidate: true, job: true }
      });
      if (!appRecord) {
        return res.status(404).json({ success: false, message: `Application #${applicationId} not found.` });
      }
    }

    // If applicationId is provided, verify candidateId and jobId match if they are also sent
    if (appRecord) {
      if (candidateId && parseInt(candidateId) !== appRecord.candidateId) {
        return res.status(400).json({ success: false, message: 'Provided candidate ID does not match the application record.' });
      }
      if (jobId && parseInt(jobId) !== appRecord.jobId) {
        return res.status(400).json({ success: false, message: 'Provided job ID does not match the application record.' });
      }
    } else {
      // If no applicationId provided, lookup by candidateId and jobId
      const parsedCandId = parseInt(candidateId);
      const parsedJobId = parseInt(jobId);
      if (isNaN(parsedCandId) || isNaN(parsedJobId)) {
        return res.status(400).json({ success: false, message: 'Valid Candidate ID and Job ID are required.' });
      }

      appRecord = await prisma.application.findUnique({
        where: { candidateId_jobId: { candidateId: parsedCandId, jobId: parsedJobId } },
        include: { candidate: true, job: true }
      });

      if (!appRecord) {
        return res.status(404).json({
          success: false,
          message: 'No existing job application found for this candidate and job. Interviews can only be scheduled for candidates with a valid application.'
        });
      }
    }

    const finalCandidateId = appRecord.candidateId;
    const finalJobId = appRecord.jobId;

    // Verify candidate exists and is active
    const candidate = await prisma.user.findUnique({ where: { id: finalCandidateId } });
    if (!candidate || candidate.role !== 'CANDIDATE') {
      return res.status(404).json({ success: false, message: 'Candidate user not found.' });
    }

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: finalJobId } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    // Recruiter can only schedule interviews for their own jobs (unless Admin)
    if (req.user.role === 'RECRUITER' && job.recruiterId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only schedule interviews for your own job postings.' });
    }

    const interview = await prisma.interview.create({
      data: {
        candidateId: finalCandidateId,
        recruiterId: req.user.id,
        jobId: finalJobId,
        scheduledAt: new Date(scheduledAt),
        location: location || null,
        mode: mode || 'Online',
        notes: notes || null
      },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true } }
      }
    });

    // Update application status to SHORTLISTED if currently PENDING or REVIEWED
    if (appRecord.status === 'PENDING' || appRecord.status === 'REVIEWED') {
      await prisma.application.update({
        where: { id: appRecord.id },
        data: { status: 'SHORTLISTED' }
      });
    }

    // Notify candidate
    const formattedDate = new Date(scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    });

    await prisma.notification.create({
      data: {
        title: '📅 Interview Scheduled',
        message: `An interview has been scheduled for "${job.title}" at ${job.company} on ${formattedDate}. Mode: ${mode || 'Online'}. (Application #${appRecord.id})`,
        type: 'INTERVIEW',
        userId: finalCandidateId
      }
    });

    res.status(201).json({ success: true, message: 'Interview scheduled successfully.', interview });
  } catch (err) {
    console.error('Schedule interview error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error scheduling interview.' });
  }
});

// ─── GET MY INTERVIEWS (Candidate) ───────────────────────────────────────────
// GET /api/interviews/mine
router.get('/mine', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { candidateId: req.user.id },
      include: {
        job: { select: { id: true, title: true, company: true, location: true } },
        recruiter: { select: { name: true, email: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });
    res.json({ success: true, interviews });
  } catch (err) {
    console.error('Get my interviews error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET ALL INTERVIEWS SCHEDULED BY RECRUITER ───────────────────────────────
// GET /api/interviews/recruiter/mine
router.get('/recruiter/mine', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const where = req.user.role === 'RECRUITER' ? { recruiterId: req.user.id } : {};
    const interviews = await prisma.interview.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });
    res.json({ success: true, interviews });
  } catch (err) {
    console.error('Get recruiter interviews error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET SINGLE INTERVIEW ─────────────────────────────────────────────────────
// GET /api/interviews/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        recruiter: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true, location: true } }
      }
    });

    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found.' });
    res.json({ success: true, interview });
  } catch (err) {
    console.error('Get interview error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── UPDATE INTERVIEW (status, feedback) ─────────────────────────────────────
// PATCH /api/interviews/:id
router.patch('/:id', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    if (isNaN(interviewId)) {
      return res.status(400).json({ success: false, message: 'Invalid interview ID.' });
    }

    const { status, feedback, notes, scheduledAt, location, mode, applicationStatus } = req.body;

    // Verify interview exists
    const existing = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        job: true,
        candidate: true
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Interview not found.' });
    }

    // Verify job exists
    if (!existing.job) {
      return res.status(404).json({ success: false, message: 'Associated job not found.' });
    }

    // Verify candidate exists
    if (!existing.candidate) {
      return res.status(404).json({ success: false, message: 'Associated candidate not found.' });
    }

    // Verify recruiter owns the job / interview
    if (req.user.role === 'RECRUITER' && existing.recruiterId !== req.user.id && existing.job.recruiterId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only update interviews for your own job postings.' });
    }

    // Update interview record
    const interview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        ...(status && { status }),
        ...(feedback !== undefined && { feedback }),
        ...(notes !== undefined && { notes }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(location !== undefined && { location }),
        ...(mode && { mode })
      },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true } }
      }
    });

    // If application status update requested or feedback provided
    if (applicationStatus) {
      await prisma.application.updateMany({
        where: { candidateId: existing.candidateId, jobId: existing.jobId },
        data: { status: applicationStatus }
      });
    }

    // Notify candidate
    if (feedback && feedback.trim()) {
      await prisma.notification.create({
        data: {
          title: '📝 Interview Feedback Received',
          message: `Recruiter provided feedback for your "${interview.job.title}" interview: "${feedback.length > 80 ? feedback.substring(0, 77) + '...' : feedback}"`,
          type: 'INTERVIEW',
          userId: existing.candidateId
        }
      });
    } else if (status === 'COMPLETED') {
      await prisma.notification.create({
        data: {
          title: '✅ Interview Completed',
          message: `Your interview for "${interview.job.title}" has been marked as completed.`,
          type: 'INTERVIEW',
          userId: existing.candidateId
        }
      });
    } else if (status === 'CANCELLED') {
      await prisma.notification.create({
        data: {
          title: '❌ Interview Cancelled',
          message: `Your interview for "${interview.job.title}" has been cancelled. Please contact the recruiter for more information.`,
          type: 'INTERVIEW',
          userId: existing.candidateId
        }
      });
    }

    res.json({ success: true, message: 'Interview updated successfully.', interview });
  } catch (err) {
    console.error('Update interview error:', err);
    res.status(500).json({ success: false, message: 'Server error updating interview.' });
  }
});

// ─── DELETE INTERVIEW (Recruiter or Admin) ────────────────────────────────────
// DELETE /api/interviews/:id
router.delete('/:id', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.interview.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Interview deleted.' });
  } catch (err) {
    console.error('Delete interview error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
