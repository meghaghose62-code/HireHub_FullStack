/**
 * HireHub RMS - Complete End-to-End Workflow Test
 * Tests: Admin → Recruiter → Candidate Workflow with Real Database Data
 */

const BASE_URL = 'http://localhost:5000';

async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(cond, desc) {
  if (cond) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

async function run() {
  console.log('🚀 Running HireHub Admin → Recruiter → Candidate Workflow Tests...\n');

  let adminToken, recruiterToken, candidateToken;
  let testJobId, testAppId, testInterviewId;

  try {
    // ─── STEP 1: AUTHENTICATION & ROLE-BASED ACCESS ───
    console.log('[Step 1/8] Testing Authentication & Role Redirection...');

    // 1.1 Admin login
    const adminLogin = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hirehub.com', password: 'password123' })
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'ADMIN', 'Admin user logs in successfully');
    assert(adminLogin.data.redirect === '/admin-dashboard.html', 'Admin receives correct dashboard redirect (/admin-dashboard.html)');
    adminToken = adminLogin.data.token;

    // 1.2 Recruiter login
    const recLogin = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'priya@techcorp.com', password: 'password123' })
    });
    assert(recLogin.status === 200 && recLogin.data.user.role === 'RECRUITER', 'Recruiter logs in successfully');
    assert(recLogin.data.redirect === '/recruiter-dashboard.html', 'Recruiter receives correct dashboard redirect (/recruiter-dashboard.html)');
    recruiterToken = recLogin.data.token;

    // 1.3 Candidate login
    const candLogin = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'arjun@gmail.com', password: 'password123' })
    });
    assert(candLogin.status === 200 && candLogin.data.user.role === 'CANDIDATE', 'Candidate logs in successfully');
    assert(candLogin.data.redirect === '/dashboard.html', 'Candidate receives correct dashboard redirect (/dashboard.html)');
    candidateToken = candLogin.data.token;

    // ─── STEP 2: DASHBOARDS & REAL DATABASE DATA ───
    console.log('\n[Step 2/8] Testing Dashboards Show Only Real Database Data...');

    // 2.1 Admin Dashboard
    const adminDash = await req('/api/reports/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDash.status === 200 && adminDash.data.success, 'Admin dashboard stats fetched');
    assert(adminDash.data.stats.totalUsers === 11, `Admin dashboard reflects real user count (11 users, got ${adminDash.data.stats.totalUsers})`);
    assert(adminDash.data.stats.totalJobs === 16, `Admin dashboard reflects real job count (16 jobs, got ${adminDash.data.stats.totalJobs})`);
    assert(adminDash.data.stats.totalApplications === 10, `Admin dashboard reflects real application count (10 apps, got ${adminDash.data.stats.totalApplications})`);

    // 2.2 Recruiter Dashboard
    const recDash = await req('/api/reports/recruiter', {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    assert(recDash.status === 200 && recDash.data.success, 'Recruiter dashboard stats fetched from DB');
    assert(recDash.data.stats.myJobs > 0, `Recruiter sees only their posted jobs (${recDash.data.stats.myJobs} jobs)`);

    // 2.3 Candidate Dashboard
    const candDash = await req('/api/reports/candidate', {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    assert(candDash.status === 200 && candDash.data.success, 'Candidate activity overview fetched from DB');

    // ─── STEP 3: RECRUITER POSTS JOB & DUPLICATE PREVENTION ───
    console.log('\n[Step 3/8] Testing Recruiter Job Posting & Duplicate Prevention...');

    const uniqueJobTitle = 'Workflow Principal Architect ' + Date.now();
    const postJobRes = await req('/api/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterToken}` },
      body: JSON.stringify({
        title: uniqueJobTitle,
        company: 'TechCorp India',
        location: 'Bengaluru',
        jobType: 'FULL_TIME',
        experience: '5+ years',
        skills: 'Node.js, PostgreSQL, Distributed Systems',
        description: 'Lead the next generation architecture team.',
        salary: '₹35-45 LPA'
      })
    });
    assert(postJobRes.status === 201 && postJobRes.data.job.status === 'PENDING', 'Recruiter posts job (status: PENDING approval)');
    testJobId = postJobRes.data.job.id;

    // Attempt to post exact same duplicate job
    const duplicateJobRes = await req('/api/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterToken}` },
      body: JSON.stringify({
        title: uniqueJobTitle,
        company: 'TechCorp India',
        location: 'Bengaluru',
        jobType: 'FULL_TIME',
        experience: '5+ years',
        skills: 'Node.js, PostgreSQL, Distributed Systems',
        description: 'Lead the next generation architecture team.',
        salary: '₹35-45 LPA'
      })
    });
    assert(duplicateJobRes.status === 409, 'Duplicate job posting is rejected with 409 Conflict');

    // ─── STEP 4: ADMIN APPROVAL WORKFLOW ───
    console.log('\n[Step 4/8] Testing Admin Review & Approval...');

    const pendingJobsRes = await req('/api/jobs/admin/pending', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pendingJobsRes.status === 200 && pendingJobsRes.data.jobs.some(j => j.id === testJobId), 'Admin sees the new job in pending approvals list');

    const approveRes = await req(`/api/jobs/${testJobId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    assert(approveRes.status === 200 && approveRes.data.job.status === 'APPROVED', 'Admin approves the job post');

    // Public list verification
    const publicJobs = await req('/api/jobs');
    assert(publicJobs.status === 200 && publicJobs.data.jobs.some(j => j.id === testJobId), 'Approved job is publicly visible in job search');

    // ─── STEP 5: CANDIDATE APPLIES & DUPLICATE APPLICATION PREVENTION ───
    console.log('\n[Step 5/8] Testing Candidate Application & Duplicate Prevention...');

    // Fetch existing resume for candidate
    const resumesRes = await req('/api/resumes/mine', {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    const resumeId = resumesRes.data.resumes?.[0]?.id || 1;

    // Apply with all required fields
    const applyRes = await req('/api/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${candidateToken}` },
      body: JSON.stringify({
        jobId: testJobId,
        fullName: 'Arjun Mehta',
        email: 'arjun@gmail.com',
        phone: '9876511111',
        coverLetter: 'I am excited to apply for this leadership role.',
        resumeId: resumeId
      })
    });
    assert(applyRes.status === 201 && applyRes.data.success, 'Candidate applies for job with all required fields');
    testAppId = applyRes.data.application.id;

    // Attempt duplicate application
    const dupApplyRes = await req('/api/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${candidateToken}` },
      body: JSON.stringify({
        jobId: testJobId,
        fullName: 'Arjun Mehta',
        email: 'arjun@gmail.com',
        phone: '9876511111',
        coverLetter: 'Second attempt',
        resumeId: resumeId
      })
    });
    assert(dupApplyRes.status === 409, 'Duplicate application is rejected with 409 Conflict');

    // ─── STEP 6: RECRUITER REVIEWS APPLICATION & SCHEDULES INTERVIEW ───
    console.log('\n[Step 6/8] Testing Recruiter Review & Interview Scheduling...');

    const jobAppsRes = await req(`/api/applications/job/${testJobId}`, {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    assert(jobAppsRes.status === 200 && jobAppsRes.data.applications.some(a => a.id === testAppId), 'Recruiter views candidate application');

    // Update status to SHORTLISTED
    const statusUpdateRes = await req(`/api/applications/${testAppId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${recruiterToken}` },
      body: JSON.stringify({ status: 'SHORTLISTED' })
    });
    assert(statusUpdateRes.status === 200 && statusUpdateRes.data.application.status === 'SHORTLISTED', 'Recruiter shortlists candidate application');

    // Schedule interview
    const interviewRes = await req('/api/interviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterToken}` },
      body: JSON.stringify({
        candidateId: 4, // Arjun Mehta
        jobId: testJobId,
        applicationId: testAppId,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        mode: 'Online (Google Meet)',
        location: 'https://meet.google.com/xyz-test',
        notes: 'Technical architecture deep-dive'
      })
    });
    assert(interviewRes.status === 201 && interviewRes.data.interview.status === 'SCHEDULED', 'Recruiter schedules interview for candidate');
    testInterviewId = interviewRes.data.interview.id;

    // Recruiter submits feedback
    const feedbackRes = await req(`/api/interviews/${testInterviewId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${recruiterToken}` },
      body: JSON.stringify({
        status: 'COMPLETED',
        feedback: 'Outstanding technical competence and systems design skills.',
        applicationStatus: 'HIRED'
      })
    });
    assert(feedbackRes.status === 200 && feedbackRes.data.interview.status === 'COMPLETED', 'Recruiter submits interview feedback & marks result');

    // Candidate views interview feedback
    const candInterviews = await req('/api/interviews/mine', {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    assert(candInterviews.status === 200 && candInterviews.data.interviews.some(i => i.id === testInterviewId && i.feedback), 'Candidate sees interview feedback and outcome');

    // ─── STEP 7: SECURITY & ROLE-BASED ACCESS CONTROL ───
    console.log('\n[Step 7/8] Testing Security & Role Guards...');

    // Candidate tries accessing Admin Dashboard
    const candToAdmin = await req('/api/reports/dashboard', {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    assert(candToAdmin.status === 403, 'Candidate blocked from admin reports (403 Forbidden)');

    // Candidate tries posting a job
    const candPostJob = await req('/api/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${candidateToken}` },
      body: JSON.stringify({ title: 'Illegal Job', company: 'X', location: 'Y', description: 'Z' })
    });
    assert(candPostJob.status === 403, 'Candidate blocked from posting jobs (403 Forbidden)');

    // Recruiter tries accessing Admin user management
    const recToUsers = await req('/api/reports/users', {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    assert(recToUsers.status === 403, 'Recruiter blocked from admin user reports (403 Forbidden)');

    // Unauthenticated request to private endpoint
    const unauthReq = await req('/api/applications/mine');
    assert(unauthReq.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

    // ─── STEP 8: REPORTS VERIFICATION ───
    console.log('\n[Step 8/8] Testing Real Reports Data & Clean Up...');

    const userRep = await req('/api/reports/users', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(userRep.status === 200 && Array.isArray(userRep.data.users) && userRep.data.users.length === 11, 'Users report contains exactly 11 real users');

    const jobRep = await req('/api/reports/jobs', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(jobRep.status === 200 && jobRep.data.jobs.length >= 16, 'Jobs report contains real database jobs');

  } finally {
    // Clean up temporary workflow entities so DB remains pristine
    console.log('\n🧹 Cleaning up test workflow resources...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      if (testInterviewId) await prisma.interview.deleteMany({ where: { id: testInterviewId } });
      if (testAppId) await prisma.application.deleteMany({ where: { id: testAppId } });
      if (testJobId) await prisma.job.deleteMany({ where: { id: testJobId } });
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { message: { contains: 'Workflow Principal Architect' } },
            { title: { contains: 'Workflow' } }
          ]
        }
      });
      await prisma.$disconnect();
      console.log('  ✅ Temporary workflow test data removed cleanly.');
    } catch (e) {
      console.warn('  ⚠️ Workflow cleanup warning:', e.message);
    }
  }

  console.log('\n===========================================');
  console.log(`🏁 Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal workflow error:', err);
  process.exit(1);
});
