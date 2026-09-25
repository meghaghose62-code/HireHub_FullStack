const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── GET ALL REVIEWS (public) ─────────────────────────────────────────────────
// GET /api/reviews?company=&minRating=&page=1
router.get('/', async (req, res) => {
  try {
    const { company, minRating, page = 1, limit = 10 } = req.query;
    const where = {};

    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (minRating) where.rating = { gte: parseInt(minRating) };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.review.count({ where })
    ]);

    res.json({ success: true, reviews, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST A REVIEW (Candidate) ────────────────────────────────────────────────
// POST /api/reviews
router.post('/', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const { company, rating, title, description, pros, cons, recommend } = req.body;

    if (!company || !rating || !title || !description) {
      return res.status(400).json({ success: false, message: 'Company, rating, title, and description are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const review = await prisma.review.create({
      data: {
        company,
        rating: parseInt(rating),
        title,
        description,
        pros: pros || null,
        cons: cons || null,
        recommend: recommend !== undefined ? recommend : true,
        authorId: req.user.id
      }
    });

    res.status(201).json({ success: true, message: 'Review submitted successfully.', review });
  } catch (err) {
    console.error('Post review error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET REVIEWS BY COMPANY (must be before /:id to avoid param conflicts) ────
// GET /api/reviews/company/:name
router.get('/company/:name', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { company: { contains: req.params.name, mode: 'insensitive' } },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({ success: true, company: req.params.name, averageRating: avg.toFixed(1), reviews });
  } catch (err) {
    console.error('Get company reviews error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET REVIEW BY ID ─────────────────────────────────────────────────────────
// GET /api/reviews/:id
router.get('/:id', async (req, res) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { author: { select: { name: true } } }
    });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, review });
  } catch (err) {
    console.error('Get review error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── UPDATE REVIEW (Author only) ─────────────────────────────────────────────
// PUT /api/reviews/:id
router.put('/:id', authenticateToken, requireRole('CANDIDATE'), async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    if (review.authorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own reviews.' });
    }

    const { rating, title, description, pros, cons, recommend } = req.body;
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: {
        ...(rating && { rating: parseInt(rating) }),
        ...(title && { title }),
        ...(description && { description }),
        ...(pros !== undefined && { pros }),
        ...(cons !== undefined && { cons }),
        ...(recommend !== undefined && { recommend })
      }
    });

    res.json({ success: true, message: 'Review updated.', review: updated });
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE REVIEW (Author or Admin) ─────────────────────────────────────────
// DELETE /api/reviews/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    if (req.user.role !== 'ADMIN' && review.authorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await prisma.review.delete({ where: { id: review.id } });
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
