/**
 * HireHub RMS - Database Seed Script
 * Seeds development/test data into the hirehub PostgreSQL database.
 * Run with: node prisma/seed.js  (from backend/ directory)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting HireHub database seed...\n');

  // ─── CLEAR EXISTING DATA (in correct order to avoid FK constraint errors) ──
  console.log('🗑️  Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.savedJob.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.application.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
  console.log('   ✓ Cleared.\n');

  // ─── USERS ────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@hirehub.com',
      phone: '9876543210',
      passwordHash,
      role: 'ADMIN'
    }
  });

  const recruiter1 = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'priya@techcorp.com',
      phone: '9876501234',
      passwordHash,
      role: 'RECRUITER'
    }
  });

  const recruiter2 = await prisma.user.create({
    data: {
      name: 'Rahul Verma',
      email: 'rahul@startupxyz.com',
      phone: '9876502345',
      passwordHash,
      role: 'RECRUITER'
    }
  });

  const candidate1 = await prisma.user.create({
    data: {
      name: 'Arjun Mehta',
      email: 'arjun@gmail.com',
      phone: '9876511111',
      passwordHash,
      role: 'CANDIDATE'
    }
  });

  const candidate2 = await prisma.user.create({
    data: {
      name: 'Sneha Patel',
      email: 'sneha@gmail.com',
      phone: '9876522222',
      passwordHash,
      role: 'CANDIDATE'
    }
  });

  const candidate3 = await prisma.user.create({
    data: {
      name: 'Vikram Das',
      email: 'vikram@gmail.com',
      phone: '9876533333',
      passwordHash,
      role: 'CANDIDATE'
    }
  });

  console.log('   ✓ Created 6 users (1 admin, 2 recruiters, 3 candidates)\n');

  // ─── JOBS ─────────────────────────────────────────────────────────────────
  console.log('💼 Creating jobs...');

  const jobs = await prisma.job.createMany({
    data: [
      {
        title: 'Software Engineer (Full Stack)',
        company: 'TechCorp India',
        location: 'Bengaluru',
        jobType: 'FULL_TIME',
        experience: '1-3 years',
        skills: 'React, Node.js, MongoDB, REST APIs',
        description: 'We are looking for a talented Full Stack Engineer to join our growing team. You will work on building and scaling our SaaS platform used by 10,000+ businesses.',
        salary: '₹12-18 LPA',
        status: 'APPROVED',
        recruiterId: recruiter1.id
      },
      {
        title: 'Frontend Developer',
        company: 'DigitalEdge',
        location: 'Remote',
        jobType: 'REMOTE',
        experience: '2+ years',
        skills: 'React, JavaScript, Tailwind CSS',
        description: 'Join our remote-first design team to build pixel-perfect UIs for enterprise clients. Strong understanding of performance optimization required.',
        salary: '₹10-15 LPA',
        status: 'APPROVED',
        recruiterId: recruiter1.id
      },
      {
        title: 'Backend Engineer',
        company: 'StartupXYZ',
        location: 'Hyderabad',
        jobType: 'FULL_TIME',
        experience: '3-5 years',
        skills: 'Node.js, Express, PostgreSQL, AWS',
        description: 'We need an experienced backend engineer to design and implement robust APIs. Experience with microservices architecture is a plus.',
        salary: '₹20-28 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      },
      {
        title: 'Mobile App Developer',
        company: 'AppVentures',
        location: 'Chennai',
        jobType: 'FULL_TIME',
        experience: '1-3 years',
        skills: 'Flutter, React Native, Dart',
        description: 'Build cross-platform mobile applications with beautiful UI and smooth performance. You will work closely with product and design teams.',
        salary: '₹8-14 LPA',
        status: 'APPROVED',
        recruiterId: recruiter1.id
      },
      {
        title: 'DevOps Engineer',
        company: 'CloudMatrix',
        location: 'Bengaluru',
        jobType: 'FULL_TIME',
        experience: '3+ years',
        skills: 'Docker, Kubernetes, AWS, CI/CD, Terraform',
        description: 'Own the infrastructure and deployment pipelines. You will be responsible for maintaining 99.9% uptime across our cloud infrastructure.',
        salary: '₹22-32 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      },
      {
        title: 'Machine Learning Engineer',
        company: 'AILabs',
        location: 'Remote',
        jobType: 'REMOTE',
        experience: '2-5 years',
        skills: 'Python, TensorFlow, PyTorch, NLP, MLOps',
        description: 'Work on cutting-edge AI/ML models for our NLP product. Strong background in model training, evaluation, and production deployment required.',
        salary: '₹25-40 LPA',
        status: 'APPROVED',
        recruiterId: recruiter1.id
      },
      {
        title: 'UI/UX Developer',
        company: 'PixelCraft Studio',
        location: 'Delhi',
        jobType: 'FULL_TIME',
        experience: '1-2 years',
        skills: 'Figma, HTML, CSS, User Research, Prototyping',
        description: 'Create stunning, user-centric designs for our product suite. You will conduct user research, create wireframes, and collaborate with developers.',
        salary: '₹8-12 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      },
      {
        title: 'Software Development Engineer (SDE-1)',
        company: 'InnovateTech',
        location: 'Mumbai',
        jobType: 'FULL_TIME',
        experience: '0-2 years',
        skills: 'Java, Python, DSA, OOP, Problem Solving',
        description: 'Freshers and early-career engineers welcome! Join our engineering team and build scalable systems from day one.',
        salary: '₹6-10 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      },
      {
        title: 'Cloud Engineer',
        company: 'SkyNet Solutions',
        location: 'Noida',
        jobType: 'FULL_TIME',
        experience: '2-4 years',
        skills: 'AWS, Azure, Terraform, Cloud Architecture',
        description: 'Design and manage cloud infrastructure across AWS and Azure. Drive cloud migration projects for our enterprise clients.',
        salary: '₹18-25 LPA',
        status: 'APPROVED',
        recruiterId: recruiter1.id
      },
      {
        title: 'Full Stack Developer',
        company: 'Enterprise Solutions Ltd',
        location: 'Pune',
        jobType: 'FULL_TIME',
        experience: '2-4 years',
        skills: 'Angular, Spring Boot, MySQL, REST APIs',
        description: 'Work on enterprise-grade ERP solutions for Fortune 500 clients. Java/Spring Boot backend with Angular frontend.',
        salary: '₹14-20 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      },
      {
        title: 'Data Engineer',
        company: 'DataFlow Analytics',
        location: 'Bengaluru',
        jobType: 'FULL_TIME',
        experience: '2-4 years',
        skills: 'Python, Apache Spark, Kafka, BigQuery, dbt',
        description: 'Build and maintain data pipelines that process millions of events per day. Experience with real-time streaming is preferred.',
        salary: '₹20-30 LPA',
        status: 'PENDING',
        recruiterId: recruiter1.id
      },
      {
        title: 'Security Engineer',
        company: 'CyberShield',
        location: 'Hyderabad',
        jobType: 'FULL_TIME',
        experience: '4+ years',
        skills: 'Penetration Testing, OWASP, SIEM, Network Security',
        description: 'Conduct security assessments, penetration testing, and help build a culture of security-first engineering.',
        salary: '₹28-40 LPA',
        status: 'APPROVED',
        recruiterId: recruiter2.id
      }
    ]
  });

  const allJobs = await prisma.job.findMany({ orderBy: { id: 'asc' } });
  console.log(`   ✓ Created ${allJobs.length} jobs\n`);

  // ─── RESUMES ──────────────────────────────────────────────────────────────
  console.log('📎 Creating resumes...');
  const resume1 = await prisma.resume.create({
    data: {
      userId: candidate1.id,
      fileName: 'Arjun_Mehta_Resume.pdf',
      filePath: '/uploads/resumes/sample-resume-1.pdf',
      fileSize: 245760
    }
  });

  const resume2 = await prisma.resume.create({
    data: {
      userId: candidate2.id,
      fileName: 'Sneha_Patel_Resume.pdf',
      filePath: '/uploads/resumes/sample-resume-2.pdf',
      fileSize: 198656
    }
  });

  const resume3 = await prisma.resume.create({
    data: {
      userId: candidate3.id,
      fileName: 'Vikram_Das_CV.pdf',
      filePath: '/uploads/resumes/sample-resume-3.pdf',
      fileSize: 312320
    }
  });
  console.log('   ✓ Created 3 resumes\n');

  // ─── APPLICATIONS ─────────────────────────────────────────────────────────
  console.log('📤 Creating applications...');
  const approvedJobs = allJobs.filter(j => j.status === 'APPROVED');

  const application1 = await prisma.application.create({
    data: {
      candidateId: candidate1.id,
      jobId: approvedJobs[0].id,
      coverLetter: 'I am very excited about this Full Stack Engineer role at TechCorp India. With 2 years of experience in React and Node.js, I believe I can contribute significantly to your team.',
      status: 'SHORTLISTED',
      resumeId: resume1.id
    }
  });

  const application2 = await prisma.application.create({
    data: {
      candidateId: candidate1.id,
      jobId: approvedJobs[1].id,
      coverLetter: 'As a frontend enthusiast with expertise in React and Tailwind CSS, I am eager to join DigitalEdge.',
      status: 'REVIEWED',
      resumeId: resume1.id
    }
  });

  const application3 = await prisma.application.create({
    data: {
      candidateId: candidate2.id,
      jobId: approvedJobs[0].id,
      coverLetter: 'I have been working with React and Node.js for over 3 years. I would love to bring my skills to TechCorp.',
      status: 'PENDING',
      resumeId: resume2.id
    }
  });

  const application4 = await prisma.application.create({
    data: {
      candidateId: candidate2.id,
      jobId: approvedJobs[4].id,
      coverLetter: 'With extensive experience in Docker, Kubernetes, and AWS, I am confident I can thrive as a DevOps Engineer.',
      status: 'HIRED',
      resumeId: resume2.id
    }
  });

  const application5 = await prisma.application.create({
    data: {
      candidateId: candidate3.id,
      jobId: approvedJobs[2].id,
      coverLetter: 'I have 4 years of backend development experience using Node.js and PostgreSQL. Excited about the StartupXYZ opportunity.',
      status: 'PENDING',
      resumeId: resume3.id
    }
  });

  const application6 = await prisma.application.create({
    data: {
      candidateId: candidate3.id,
      jobId: approvedJobs[7].id,
      coverLetter: 'Fresh out of computer science, I am eager to start my career as an SDE-1. I have strong DSA fundamentals and multiple personal projects.',
      status: 'REJECTED',
      resumeId: resume3.id
    }
  });

  console.log('   ✓ Created 6 applications\n');

  // ─── INTERVIEWS ───────────────────────────────────────────────────────────
  console.log('📅 Creating interviews...');

  await prisma.interview.create({
    data: {
      candidateId: candidate1.id,
      recruiterId: recruiter1.id,
      jobId: approvedJobs[0].id,
      scheduledAt: new Date('2026-10-05T10:00:00+05:30'),
      mode: 'Video Call (Google Meet)',
      location: 'Online',
      notes: 'Please be prepared for a technical coding round covering React hooks, Node.js async patterns, and system design basics.',
      status: 'SCHEDULED'
    }
  });

  await prisma.interview.create({
    data: {
      candidateId: candidate2.id,
      recruiterId: recruiter2.id,
      jobId: approvedJobs[4].id,
      scheduledAt: new Date('2026-10-03T14:00:00+05:30'),
      mode: 'In-Person',
      location: 'CloudMatrix Office, Bengaluru',
      notes: 'Panel interview with the DevOps team. Bring a copy of your resume.',
      status: 'COMPLETED',
      feedback: 'Excellent candidate. Strong understanding of Kubernetes and AWS. Recommend for hire.'
    }
  });

  await prisma.interview.create({
    data: {
      candidateId: candidate1.id,
      recruiterId: recruiter1.id,
      jobId: approvedJobs[1].id,
      scheduledAt: new Date('2026-10-08T11:30:00+05:30'),
      mode: 'Video Call (Zoom)',
      location: 'Online',
      notes: 'Frontend design assessment. Will include a live coding exercise in React.',
      status: 'SCHEDULED'
    }
  });

  console.log('   ✓ Created 3 interviews\n');

  // ─── REVIEWS ──────────────────────────────────────────────────────────────
  console.log('⭐ Creating company reviews...');

  await prisma.review.createMany({
    data: [
      {
        company: 'TechCorp India',
        rating: 4,
        title: 'Great learning environment',
        description: 'TechCorp has an excellent culture for growth. The engineering team is talented and collaborative. Work-life balance is mostly good.',
        pros: 'Smart colleagues, good tech stack, competitive salary, learning budget',
        cons: 'Occasional long hours during product launches',
        recommend: true,
        authorId: candidate1.id
      },
      {
        company: 'StartupXYZ',
        rating: 5,
        title: 'Best startup experience ever!',
        description: 'Working at StartupXYZ was an incredible experience. Fast-paced environment with real ownership and impact from day one.',
        pros: 'High ownership, great product, flat hierarchy, stock options',
        cons: 'No fixed hours, can be stressful during releases',
        recommend: true,
        authorId: candidate2.id
      },
      {
        company: 'DigitalEdge',
        rating: 3,
        title: 'Good company, room for improvement',
        description: 'Remote work setup is great and flexible. However, career growth opportunities could be better structured.',
        pros: 'Fully remote, flexible hours, good pay',
        cons: 'Limited promotions, unclear growth path',
        recommend: true,
        authorId: candidate3.id
      },
      {
        company: 'CloudMatrix',
        rating: 5,
        title: 'Excellent DevOps culture',
        description: 'CloudMatrix has one of the best DevOps cultures I have seen. The team is passionate, the tech is cutting-edge.',
        pros: 'Top-notch tools, great team, high impact work',
        cons: 'High pressure, requires being available on-call occasionally',
        recommend: true,
        authorId: candidate2.id
      }
    ]
  });

  console.log('   ✓ Created 4 company reviews\n');

  // ─── SAVED JOBS ───────────────────────────────────────────────────────────
  console.log('📌 Creating saved jobs...');
  await prisma.savedJob.createMany({
    data: [
      { userId: candidate1.id, jobId: approvedJobs[4].id },
      { userId: candidate1.id, jobId: approvedJobs[5].id },
      { userId: candidate2.id, jobId: approvedJobs[2].id },
      { userId: candidate3.id, jobId: approvedJobs[0].id },
      { userId: candidate3.id, jobId: approvedJobs[8].id }
    ]
  });
  console.log('   ✓ Created 5 saved jobs\n');

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        title: '🎉 Welcome to HireHub!',
        message: 'Your account has been created. Start exploring jobs and apply to your dream role today!',
        type: 'SYSTEM',
        userId: candidate1.id
      },
      {
        title: '✅ Application Submitted',
        message: 'Your application for "Software Engineer (Full Stack)" at TechCorp India has been submitted.',
        type: 'APPLICATION',
        userId: candidate1.id
      },
      {
        title: '🎊 You\'ve been Shortlisted!',
        message: 'Congratulations! You have been shortlisted for the Software Engineer role at TechCorp India.',
        type: 'APPLICATION',
        userId: candidate1.id
      },
      {
        title: '📅 Interview Scheduled',
        message: 'An interview for "Software Engineer (Full Stack)" is scheduled on Oct 5, 2026 at 10:00 AM.',
        type: 'INTERVIEW',
        userId: candidate1.id
      },
      {
        title: '🎉 Welcome to HireHub!',
        message: 'Your account has been created. Start exploring jobs and apply to your dream role today!',
        type: 'SYSTEM',
        userId: candidate2.id
      },
      {
        title: '🎊 You\'ve been Hired!',
        message: 'Congratulations Sneha! You have been selected for the DevOps Engineer role at CloudMatrix.',
        type: 'APPLICATION',
        isRead: false,
        userId: candidate2.id
      },
      {
        title: 'New Application Received',
        message: 'Arjun Mehta applied for your job: "Software Engineer (Full Stack)".',
        type: 'APPLICATION',
        userId: recruiter1.id
      },
      {
        title: 'New Job Pending Approval',
        message: 'Priya Sharma posted "Data Engineer" at DataFlow Analytics. Please review.',
        type: 'JOB',
        userId: admin.id
      },
      {
        title: '⚠️ System Maintenance',
        message: 'Scheduled maintenance on Oct 10, 2026 from 02:00 AM to 04:00 AM IST.',
        type: 'SYSTEM',
        userId: admin.id
      }
    ]
  });
  console.log('   ✓ Created 9 notifications\n');

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ HireHub database seeded successfully!\n');
  console.log('📋 Seed Summary:');
  console.log('   • Users: 6 (1 admin, 2 recruiters, 3 candidates)');
  console.log('   • Jobs: 12 (11 approved, 1 pending)');
  console.log('   • Applications: 6');
  console.log('   • Interviews: 3');
  console.log('   • Resumes: 3');
  console.log('   • Reviews: 4');
  console.log('   • Saved Jobs: 5');
  console.log('   • Notifications: 9\n');
  console.log('🔑 Test Credentials (all use password: password123)');
  console.log('   Admin:      admin@hirehub.com');
  console.log('   Recruiter:  priya@techcorp.com');
  console.log('   Recruiter:  rahul@startupxyz.com');
  console.log('   Candidate:  arjun@gmail.com');
  console.log('   Candidate:  sneha@gmail.com');
  console.log('   Candidate:  vikram@gmail.com');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
