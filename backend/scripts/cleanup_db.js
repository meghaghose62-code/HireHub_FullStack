/**
 * HireHub RMS - Database Cleanup Script
 * Cleans up automated test users, fake jobs, duplicate job postings, and orphaned test data.
 * Keeps all 11 real users and all real jobs/applications/interviews/reviews intact.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Starting HireHub Database Cleanup...\n');

  // 1. Identify test users
  const allUsers = await prisma.user.findMany();
  const testUsers = allUsers.filter(u => 
    u.email.includes('example.com') || 
    u.email.includes('@test.com') || 
    u.email.startsWith('cand_') || 
    u.email.startsWith('rec_') || 
    u.email.startsWith('admin_') ||
    u.name.includes('1790') ||
    u.name.includes('Test ') ||
    u.name.includes('Candidate Updated Name')
  );
  const testUserIds = testUsers.map(u => u.id);
  console.log(`Found ${testUsers.length} test/fake users to remove.`);

  // 2. Identify fake jobs (Acme Corp and Apex Cloud Labs timestamped jobs)
  const fakeJobs = await prisma.job.findMany({
    where: {
      OR: [
        { company: { contains: '1790' } },
        { title: { contains: '1790' } },
        { company: 'Acme Corp' },
        { recruiterId: { in: testUserIds } }
      ]
    }
  });
  const fakeJobIds = fakeJobs.map(j => j.id);

  // 3. Identify duplicate jobs for Senior Node.js Backend Architect (keep Job 19, remove duplicates)
  const duplicateJobs = await prisma.job.findMany({
    where: {
      title: 'Senior Node.js Backend Architect',
      company: 'TechCorp India',
      id: { not: 19 }
    }
  });
  const duplicateJobIds = duplicateJobs.map(j => j.id);
  const allJobIdsToRemove = [...fakeJobIds, ...duplicateJobIds];
  console.log(`Found ${allJobIdsToRemove.length} fake & duplicate jobs to remove (${fakeJobs.length} fake + ${duplicateJobs.length} duplicates).`);

  // 4. Delete saved jobs for test users or removed jobs
  const delSavedJobs = await prisma.savedJob.deleteMany({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { jobId: { in: allJobIdsToRemove } }
      ]
    }
  });
  console.log(`✓ Deleted ${delSavedJobs.count} test saved jobs.`);

  // 5. Delete reviews from test users or for Acme Corp
  const delReviews = await prisma.review.deleteMany({
    where: {
      OR: [
        { authorId: { in: testUserIds } },
        { company: 'Acme Corp' }
      ]
    }
  });
  console.log(`✓ Deleted ${delReviews.count} test reviews.`);

  // 6. Delete interviews for test users or removed jobs
  const delInterviews = await prisma.interview.deleteMany({
    where: {
      OR: [
        { candidateId: { in: testUserIds } },
        { recruiterId: { in: testUserIds } },
        { jobId: { in: allJobIdsToRemove } }
      ]
    }
  });
  console.log(`✓ Deleted ${delInterviews.count} test/duplicate interviews.`);

  // 7. Delete applications for test users or removed jobs
  const delApps = await prisma.application.deleteMany({
    where: {
      OR: [
        { candidateId: { in: testUserIds } },
        { jobId: { in: allJobIdsToRemove } }
      ]
    }
  });
  console.log(`✓ Deleted ${delApps.count} test/duplicate applications.`);

  // 8. Delete test resumes
  const delResumes = await prisma.resume.deleteMany({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { fileName: { contains: 'test-resume' } }
      ]
    }
  });
  console.log(`✓ Deleted ${delResumes.count} test resumes.`);

  // 9. Delete jobs
  const delJobs = await prisma.job.deleteMany({
    where: { id: { in: allJobIdsToRemove } }
  });
  console.log(`✓ Deleted ${delJobs.count} fake & duplicate jobs.`);

  // 10. Delete notifications for test users or mentioning test entities
  const delNotifs = await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { message: { contains: '1790' } },
        { message: { contains: 'Acme Corp' } }
      ]
    }
  });
  console.log(`✓ Deleted ${delNotifs.count} test notifications.`);

  // 11. Delete test users
  const delUsers = await prisma.user.deleteMany({
    where: { id: { in: testUserIds } }
  });
  console.log(`✓ Deleted ${delUsers.count} test users.`);

  // Final summary
  const [usersCount, jobsCount, appsCount, interviewsCount, reviewsCount] = await Promise.all([
    prisma.user.count(),
    prisma.job.count(),
    prisma.application.count(),
    prisma.interview.count(),
    prisma.review.count()
  ]);

  console.log('\n===========================================');
  console.log('🎉 Cleanup successfully completed!');
  console.log(`Remaining Real Users:        ${usersCount}`);
  console.log(`Remaining Real Jobs:         ${jobsCount}`);
  console.log(`Remaining Real Applications: ${appsCount}`);
  console.log(`Remaining Real Interviews:   ${interviewsCount}`);
  console.log(`Remaining Real Reviews:      ${reviewsCount}`);
  console.log('===========================================\n');

  await prisma.$disconnect();
}

cleanDatabase().catch(err => {
  console.error('Cleanup failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
