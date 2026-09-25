const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── MULTER STORAGE CONFIG ────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `resume-${req.user.id}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ─── UPLOAD RESUME (Candidate) ────────────────────────────────────────────────
// POST /api/resumes/upload
router.post('/upload', authenticateToken, requireRole('CANDIDATE'), upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const resume = await prisma.resume.create({
      data: {
        userId: req.user.id,
        fileName: req.file.originalname,
        filePath: `/uploads/resumes/${req.file.filename}`,
        fileSize: req.file.size
      }
    });

    await prisma.notification.create({
      data: {
        title: '📎 Resume Uploaded',
        message: `Your resume "${req.file.originalname}" has been uploaded successfully.`,
        type: 'SYSTEM',
        userId: req.user.id
      }
    });

    res.status(201).json({ success: true, message: 'Resume uploaded successfully.', resume });
  } catch (err) {
    console.error('Upload resume error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error uploading resume.' });
  }
});

// ─── GET MY RESUMES (Candidate) ───────────────────────────────────────────────
// GET /api/resumes/mine
router.get('/mine', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.user.id },
      orderBy: { uploadedAt: 'desc' }
    });
    res.json({ success: true, resumes });
  } catch (err) {
    console.error('Get my resumes error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET CANDIDATE'S RESUMES (Recruiter/Admin viewing a candidate) ────────────
// GET /api/resumes/candidate/:candidateId
router.get('/candidate/:candidateId', authenticateToken, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: parseInt(req.params.candidateId) },
      orderBy: { uploadedAt: 'desc' }
    });
    res.json({ success: true, resumes });
  } catch (err) {
    console.error('Get candidate resumes error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE RESUME ────────────────────────────────────────────────────────────
// DELETE /api/resumes/:id
router.delete('/:id', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });
    if (resume.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own resumes.' });
    }

    // Nullify references in applications before deleting the resume (FK safety)
    await prisma.application.updateMany({
      where: { resumeId: resume.id },
      data: { resumeId: null }
    });

    // Delete physical file
    const fullPath = path.join(__dirname, '..', resume.filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await prisma.resume.delete({ where: { id: resume.id } });
    res.json({ success: true, message: 'Resume deleted.' });
  } catch (err) {
    console.error('Delete resume error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
