const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── APPLY FOR A JOB (Candidate) ─────────────────────────────────────────────
// POST /api/applications
router.post('/', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const { jobId, fullName, email, phone, coverLetter, resumeId } = req.body;

    // ── Mandatory field validation ──────────────────────────────────────────
    if (!jobId) return res.status(400).json({ success: false, message: 'Job ID is required.' });

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'A resume is required to apply.' });
    }

    if (!coverLetter || !coverLetter.trim()) {
      return res.status(400).json({ success: false, message: 'Cover letter is required.' });
    }
    // ── End validation ────────────────────────────────────────────────────

    // Check job exists and is approved
    const job = await prisma.job.findUnique({ where: { id: parseInt(jobId) } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    if (job.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'This job is not currently accepting applications.' });
    }

    // Check already applied
    const existing = await prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: req.user.id, jobId: parseInt(jobId) } }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied for this job.' });
    }

    const application = await prisma.application.create({
      data: {
        candidateId: req.user.id,
        jobId: parseInt(jobId),
        coverLetter: coverLetter || null,
        resumeId: resumeId ? parseInt(resumeId) : null
      },
      include: { job: { select: { title: true, company: true } } }
    });

    // Notify candidate
    await prisma.notification.create({
      data: {
        title: 'Application Submitted ✅',
        message: `Your application for "${job.title}" at ${job.company} has been submitted successfully.`,
        type: 'APPLICATION',
        userId: req.user.id
      }
    });

    // Notify recruiter
    await prisma.notification.create({
      data: {
        title: 'New Application Received',
        message: `${req.user.name} applied for your job posting: "${job.title}".`,
        type: 'APPLICATION',
        userId: job.recruiterId
      }
    });

    res.status(201).json({ success: true, message: 'Application submitted!', application });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting application.' });
  }
});

// ─── GET MY APPLICATIONS (Candidate) ─────────────────────────────────────────
// GET /api/applications/mine
router.get('/mine', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { candidateId: req.user.id },
      include: {
        job: { select: { id: true, title: true, company: true, location: true, jobType: true } },
        resume: { select: { id: true, fileName: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });
    res.json({ success: true, applications });
  } catch (err) {
    console.error('Get my applications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET APPLICATIONS FOR A JOB (Recruiter) ──────────────────────────────────
// GET /api/applications/job/:jobId
router.get('/job/:jobId', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);

    // Recruiter can only see applications for their own jobs
    if (req.user.role === 'RECRUITER') {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.recruiterId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const applications = await prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true } },
        resume: { select: { id: true, fileName: true, filePath: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });

    res.json({ success: true, applications });
  } catch (err) {
    console.error('Get job applications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET ALL APPLICATIONS FOR RECRUITER'S OWN JOBS ───────────────────────────
// GET /api/applications/recruiter/mine
router.get('/recruiter/mine', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    // Get all job IDs belonging to this recruiter
    const where = req.user.role === 'RECRUITER'
      ? { job: { recruiterId: req.user.id } }
      : {};

    const applications = await prisma.application.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true } },
        job: { select: { id: true, title: true, company: true, location: true } },
        resume: { select: { id: true, fileName: true, filePath: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });

    res.json({ success: true, applications });
  } catch (err) {
    console.error('Get recruiter applications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET ALL APPLICATIONS (Admin) ────────────────────────────────────────────
// GET /api/applications/all
router.get('/all', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });
    res.json({ success: true, applications });
  } catch (err) {
    console.error('Get all applications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET SINGLE APPLICATION ───────────────────────────────────────────────────
// GET /api/applications/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true } },
        job: { select: { id: true, title: true, company: true, location: true, description: true } },
        resume: { select: { id: true, fileName: true, filePath: true } }
      }
    });

    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    // Only candidate who applied, the recruiter who owns job, or admin can view
    if (
      req.user.role === 'CANDIDATE' && application.candidateId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, application });
  } catch (err) {
    console.error('Get application error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── UPDATE APPLICATION STATUS (Recruiter / Admin) ───────────────────────────
// PATCH /api/applications/:id/status
router.patch('/:id/status', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.` });
    }

    const application = await prisma.application.update({
      where: { id: parseInt(req.params.id) },
      data: { status },
      include: {
        candidate: true,
        job: { select: { title: true, company: true } }
      }
    });

    // Notify candidate of status change
    const statusMessages = {
      REVIEWED: 'Your application is being reviewed.',
      SHORTLISTED: '🎉 Congratulations! You have been shortlisted.',
      REJECTED: 'Unfortunately, your application was not selected at this time.',
      HIRED: '🎊 You have been hired! Please check your email for next steps.'
    };

    if (statusMessages[status]) {
      await prisma.notification.create({
        data: {
          title: `Application Status Updated`,
          message: `For "${application.job.title}" at ${application.job.company}: ${statusMessages[status]}`,
          type: 'APPLICATION',
          userId: application.candidateId
        }
      });
    }

    res.json({ success: true, message: `Application status updated to ${status}.`, application });
  } catch (err) {
    console.error('Update application status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DOWNLOAD APPLICATION INVOICE / RECEIPT (PDF) ───────────────────────────
// GET /api/applications/:id/invoice
router.get('/:id/invoice', authenticateToken, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true } },
        job: { select: { id: true, title: true, company: true, location: true, jobType: true, salary: true, recruiterId: true } },
        resume: { select: { id: true, fileName: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Access control: only candidate who applied, recruiter of the job, or admin
    if (req.user.role === 'CANDIDATE' && application.candidateId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'RECRUITER' && application.job.recruiterId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="HireHub_Invoice_APP_${application.id}.pdf"`);

    doc.pipe(res);

    const brandColor = '#0A66C2';
    const darkGray = '#222222';
    const lightGray = '#666666';

    // Header Banner
    doc.rect(50, 45, 495, 65).fill(brandColor);
    doc.fillColor('#FFFFFF')
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('HireHub RMS', 70, 60);
    doc.fontSize(12)
       .font('Helvetica')
       .text('Official Application Receipt & Confirmation', 70, 88);

    doc.fillColor('#FFFFFF')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`RECEIPT #: HH-APP-${application.id.toString().padStart(6, '0')}`, 350, 62, { align: 'right', width: 175 });
    doc.font('Helvetica')
       .fontSize(9)
       .text(`Issued: ${new Date().toLocaleDateString('en-IN')}`, 350, 78, { align: 'right', width: 175 });
    doc.text(`Status: ${application.status}`, 350, 92, { align: 'right', width: 175 });

    let currentY = 135;

    // Section 1: Candidate Information
    doc.fillColor(brandColor)
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('CANDIDATE DETAILS', 50, currentY);
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, currentY + 18).lineTo(545, currentY + 18).stroke();

    currentY += 28;
    doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('Full Name:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.candidate.name, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Email Address:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.candidate.email, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Phone Number:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.candidate.phone || 'Not provided', 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Candidate ID:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(`USR-${application.candidate.id}`, 170, currentY);

    // Section 2: Job Position Details
    currentY += 32;
    doc.fillColor(brandColor)
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('JOB & POSITION INFORMATION', 50, currentY);
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, currentY + 18).lineTo(545, currentY + 18).stroke();

    currentY += 28;
    doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('Job Title:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica-Bold').text(application.job.title, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Company:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.job.company, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Location:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.job.location, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Employment Type:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text((application.job.jobType || 'FULL_TIME').replace('_', ' '), 170, currentY);

    if (application.job.salary) {
      currentY += 18;
      doc.fillColor(lightGray).font('Helvetica-Bold').text('Salary Offered:', 60, currentY);
      doc.fillColor(darkGray).font('Helvetica').text(application.job.salary, 170, currentY);
    }

    // Section 3: Application Submission Summary
    currentY += 32;
    doc.fillColor(brandColor)
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('APPLICATION SUMMARY', 50, currentY);
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, currentY + 18).lineTo(545, currentY + 18).stroke();

    currentY += 28;
    doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('Submission Date:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(new Date(application.appliedAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }), 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Application Status:', 60, currentY);
    doc.fillColor(brandColor).font('Helvetica-Bold').text(application.status, 170, currentY);

    currentY += 18;
    doc.fillColor(lightGray).font('Helvetica-Bold').text('Attached Resume:', 60, currentY);
    doc.fillColor(darkGray).font('Helvetica').text(application.resume ? application.resume.fileName : 'None attached', 170, currentY);

    if (application.coverLetter) {
      currentY += 22;
      doc.fillColor(lightGray).font('Helvetica-Bold').text('Cover Letter Excerpt:', 60, currentY);
      currentY += 14;
      const excerpt = application.coverLetter.length > 250 ? application.coverLetter.substring(0, 250) + '...' : application.coverLetter;
      doc.fillColor('#444444').font('Helvetica-Oblique').text(`"${excerpt}"`, 60, currentY, { width: 460 });
    }

    // Footer & Certification Box
    doc.rect(50, 680, 495, 60).fill('#F5F7FA');
    doc.fillColor(brandColor).fontSize(10).font('Helvetica-Bold').text('HireHub Recruitment Management Platform Certification', 65, 692);
    doc.fillColor(lightGray).fontSize(8.5).font('Helvetica').text(
      'This document confirms official receipt of your employment application into the HireHub recruitment database.\nFor inquiries regarding this application, contact your recruitment coordinator or email support@hirehub.com.',
      65, 708, { width: 465 }
    );

    // Bottom border branding
    doc.strokeColor(brandColor).lineWidth(2).moveTo(50, 755).lineTo(545, 755).stroke();
    doc.fillColor('#888888').fontSize(8).text('HireHub RMS • www.hirehub.com • Powered by PostgreSQL & Express Engine', 50, 762, { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('Generate invoice error:', err);
    res.status(500).json({ success: false, message: 'Server error generating application receipt.' });
  }
});

module.exports = router;
