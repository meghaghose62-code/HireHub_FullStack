/**
 * HireHub RMS - Main Express Server
 * Serves the existing frontend from the same server on http://localhost:5000
 * All API routes are under /api/*
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// ─── INIT ─────────────────────────────────────────────────────────────────────
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5000', 'http://127.0.0.1:5000'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── SERVE UPLOADED FILES ─────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── SERVE FRONTEND (from frontend/ subdirectory) ───────────────────────────
// The frontend HTML/CSS/JS/images are in the frontend/ folder (sibling of backend/)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ─── DATABASE CONNECTION CHECK ────────────────────────────────────────────────
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully via Prisma.');
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Please check your DATABASE_URL in backend/.env');
    return false;
  }
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ─── CATCH-ALL: Serve index.html for non-API routes ──────────────────────────
app.get('*', (req, res) => {
  // Only for non-API routes — serve the frontend
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
async function startServer() {
  const dbConnected = await checkDatabaseConnection();

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║         HireHub RMS - Server Running             ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Frontend:  http://localhost:${PORT}                  ║`);
    console.log(`║  API Base:  http://localhost:${PORT}/api              ║`);
    console.log(`║  Health:    http://localhost:${PORT}/api/health        ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Database:  ${dbConnected ? '✅ Connected' : '❌ Not Connected'}                    ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    if (!dbConnected) {
      console.log('⚠️  IMPORTANT: Edit backend/.env and set your DATABASE_URL');
      console.log('   Then run: npm run db:push && npm run db:seed');
    }
  });
}

startServer().catch(console.error);

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
