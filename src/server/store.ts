import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AuditLogEntry,
  AuthorizedSource,
  InstitutionalEvent,
  Institution,
  NewsArticle,
  NotificationItem,
  SubscriptionPlan,
  UserAccount,
} from '../types.ts';

export interface StoredUserRecord extends UserAccount {
  passwordHash: string;
}

export interface DilectDatabase {
  institutions: Institution[];
  articles: NewsArticle[];
  events: InstitutionalEvent[];
  sources: AuthorizedSource[];
  users: StoredUserRecord[];
  auditLogs: AuditLogEntry[];
  notifications: NotificationItem[];
  plans: SubscriptionPlan[];
  adminClaimed: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'dilect-store.json');

const IMAGE_HERO = '/src/assets/images/hero_campus_library_1795482356471.jpg';
const IMAGE_RESEARCH = '/src/assets/images/story_research_lab_1795482357348.jpg';
const IMAGE_CONVOCATION = '/src/assets/images/story_convocation_hall_1795482356396.jpg';
const IMAGE_INNOVATION = '/src/assets/images/story_innovation_hub_1795482357371.jpg';
const IMAGE_ATHLETICS = '/src/assets/images/story_athletics_stadium_1795482357543.jpg';

function createInitialDatabase(): DilectDatabase {
  const now = new Date('2026-11-23T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const daysAhead = (d: number, hour = 9) => {
    const dt = new Date(now.getTime() + d * 86400 * 1000);
    dt.setUTCHours(hour, 0, 0, 0);
    return dt.toISOString();
  };

  const institutions: Institution[] = [
    {
      id: 'inst-mak',
      slug: 'makerere',
      name: 'Makerere University',
      shortName: 'Makerere',
      country: 'Uganda',
      city: 'Kampala',
      tagline: 'We Build for the Future',
      websiteUrl: 'https://www.mak.ac.ug',
      primaryColor: '#1E3A8A',
      planId: 'multi_campus_enterprise',
      campuses: ['Main Campus (Makerere Hill)', 'Jinja Campus', 'Fort Portal Campus'],
      faculties: [
        'College of Computing and Information Sciences',
        'College of Engineering, Design, Art and Technology',
        'College of Health Sciences',
        'School of Law',
        'College of Business and Management Sciences',
      ],
      departments: [
        'Computer Science',
        'Software Engineering',
        'Electrical & Computer Engineering',
        'Public Health',
        'Commercial Law',
        'Economics',
      ],
      programmes: ['BSc Software Engineering', 'BSc Computer Science', 'MBChB Medicine', 'LLB Law', 'MSc Data Science'],
      verifiedSourcesCount: 4,
      createdAt: hoursAgo(720),
    },
    {
      id: 'inst-kyu',
      slug: 'kyambogo',
      name: 'Kyambogo University',
      shortName: 'Kyambogo',
      country: 'Uganda',
      city: 'Kampala',
      tagline: 'Knowledge and Skills for Service',
      websiteUrl: 'https://kyu.ac.ug',
      primaryColor: '#9A3412',
      planId: 'institutional_standard',
      campuses: ['Kyambogo Main Campus', 'Soroti Learning Centre', 'Bushenyi Study Centre'],
      faculties: [
        'Faculty of Engineering',
        'Faculty of Science',
        'Faculty of Special Needs & Rehabilitation',
        'School of Management and Entrepreneurship',
      ],
      departments: ['Civil & Building Engineering', 'Information Technology', 'Vocational Studies', 'Accounting & Finance'],
      programmes: ['BEng Civil Engineering', 'BSc Information Technology', 'BBA Management'],
      verifiedSourcesCount: 2,
      createdAt: hoursAgo(650),
    },
    {
      id: 'inst-must',
      slug: 'must',
      name: 'Mbarara University of Science & Technology',
      shortName: 'MUST',
      country: 'Uganda',
      city: 'Mbarara',
      tagline: 'Succeed We Must',
      websiteUrl: 'https://www.must.ac.ug',
      primaryColor: '#14532D',
      planId: 'institutional_standard',
      campuses: ['Mbarara Town Campus', 'Kihumuro Main Campus'],
      faculties: [
        'Faculty of Medicine',
        'Faculty of Applied Sciences & Technology',
        'Faculty of Interdisciplinary Studies',
      ],
      departments: ['Biomedical Engineering', 'Pharmacy', 'Computer Science', 'Development Studies'],
      programmes: ['BEng Biomedical Engineering', 'BPharm Pharmacy', 'BSc Computer Science'],
      verifiedSourcesCount: 2,
      createdAt: hoursAgo(500),
    },
  ];

  const articles: NewsArticle[] = [
    {
      id: 'art-001',
      institutionId: 'inst-mak',
      title: 'Senate Approves Revised Academic Calendar and Digital Examination Registration Portal for Semester II',
      deck: 'All undergraduate and graduate candidates across Main, Jinja, and Fort Portal campuses must confirm module enrolments by December 4.',
      body:
        'Following a full sitting of the University Senate, the Office of the Academic Registrar has published the harmonized Semester II academic timetable and opened the unified examination permit portal.\n\nStudents enrolled in the College of Computing and Information Sciences, the College of Engineering, Design, Art and Technology, and affiliated regional study centres are advised to verify their course unit registrations before the December 4 deadline. Faculty registrars will hold extended verification clinics at each college courtyard from 08:30 to 17:00 EAT.\n\nThe Academic Registrar emphasized that automated tuition reconciliation now updates examination eligibility within fifteen minutes of bank settlement, eliminating physical clearance queues that previously delayed first-week lecture attendance.',
      category: 'Academic Notices',
      verificationTier: 'verified_official',
      status: 'published',
      isUrgent: true,
      isFeatured: true,
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'College of Computing and Information Sciences',
      department: 'Computer Science',
      programme: 'BSc Software Engineering',
      imageUrl: IMAGE_HERO,
      imageCaption: 'Students crossing the central quadrangle outside the Main Library ahead of Semester II registration.',
      sourceName: 'Office of the Academic Registrar',
      sourceUrl: 'https://www.mak.ac.ug/registrar/notices',
      authorId: 'system-registrar',
      authorName: 'Office of the Academic Registrar',
      authorRole: 'Verified Institutional Office',
      attachmentLabel: 'Semester II Harmonized Calendar (PDF)',
      attachmentUrl: 'https://www.mak.ac.ug/registrar/notices',
      readTimeMinutes: 4,
      viewsCount: 4820,
      sharesCount: 312,
      publishedAt: hoursAgo(2),
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'art-002',
      institutionId: 'inst-must',
      title: 'East African Biomedical Optics Consortium Awards UGX 2.4B Grant to Kihumuro Photonics Lab',
      deck: 'Three-year clinical instrumentation programme expands graduate fellowships for biomedical engineering and public health researchers.',
      body:
        'Researchers at Mbarara University of Science & Technology have secured a landmark UGX 2.4 billion regional research grant to develop low-cost portable diagnostic microscopy units tailored for rural district health centres.\n\nHosted at the Kihumuro Applied Sciences Precinct, the initiative pairs senior optical physicists with twelve doctoral and master’s fellows drawn from East African partner institutions. Clinical validation trials are scheduled to commence in partnership with Mbarara Regional Referral Hospital in early 2027.\n\nApplications for the inaugural cohort of graduate research fellowships open on November 28 through the Directorate of Research and Graduate Training.',
      category: 'Research & Innovation',
      verificationTier: 'verified_official',
      status: 'published',
      isUrgent: false,
      isFeatured: false,
      campus: 'Kihumuro Main Campus',
      faculty: 'Faculty of Applied Sciences & Technology',
      department: 'Biomedical Engineering',
      programme: 'BEng Biomedical Engineering',
      imageUrl: IMAGE_RESEARCH,
      imageCaption: 'Postgraduate fellows calibrating optical bench assemblies at the Kihumuro Photonics Lab.',
      sourceName: 'MUST Directorate of Research',
      sourceUrl: 'https://www.must.ac.ug/research',
      authorId: 'system-must',
      authorName: 'Dr. Grace Tumusiime',
      authorRole: 'Directorate of Research',
      readTimeMinutes: 5,
      viewsCount: 2390,
      sharesCount: 168,
      publishedAt: hoursAgo(6),
      createdAt: hoursAgo(7),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'art-003',
      institutionId: 'inst-mak',
      title: '76th Graduation Convocation Schedule and Gown Collection Guidelines Released',
      deck: 'Ceremonies will run across five college clusters from January 19 to January 23 at Freedom Square.',
      body:
        'The Ceremonials Committee has confirmed the official order of colleges for the 76th Graduation Ceremony. Graduands who cleared all academic and financial requirements by November 15 can now download their provisional clearance slips and book convocation photography slots.\n\nGown distribution begins December 10 at the Senate Building basement annex. Each graduand is entitled to two guest invitation cards verifiable via QR code at the Freedom Square perimeter gates.',
      category: 'Campus Announcements',
      verificationTier: 'verified_official',
      status: 'published',
      isUrgent: false,
      isFeatured: false,
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'School of Law',
      department: 'Commercial Law',
      programme: 'LLB Law',
      imageUrl: IMAGE_CONVOCATION,
      imageCaption: 'Academic leadership addressing graduating cohorts inside the main convocation auditorium.',
      sourceName: 'University Ceremonials Committee',
      sourceUrl: 'https://www.mak.ac.ug/convocation',
      authorId: 'system-mak',
      authorName: 'Makerere Public Relations',
      authorRole: 'Content Editor',
      readTimeMinutes: 3,
      viewsCount: 6140,
      sharesCount: 524,
      publishedAt: hoursAgo(11),
      createdAt: hoursAgo(12),
      updatedAt: hoursAgo(11),
    },
    {
      id: 'art-004',
      institutionId: 'inst-kyu',
      title: 'Regional Robotics & Embedded Systems Challenge Opens Applications for Student Teams',
      deck: 'Inter-university engineering showcase invites multidisciplinary teams to pitch agricultural automation prototypes.',
      body:
        'Kyambogo University’s Faculty of Engineering, in collaboration with East African manufacturing partners, has opened registration for the 2026–2027 Regional Robotics and Embedded Systems Challenge.\n\nShortlisted teams from accredited universities will receive hardware fabrication stipends, mentorship from industrial control engineers, and access to the Kyambogo Prototyping Studio across an eight-week build sprint culminating in March.',
      category: 'Scholarships & Opportunities',
      verificationTier: 'imported_official',
      status: 'published',
      isUrgent: false,
      isFeatured: false,
      campus: 'Kyambogo Main Campus',
      faculty: 'Faculty of Engineering',
      department: 'Civil & Building Engineering',
      programme: 'BEng Civil Engineering',
      imageUrl: IMAGE_INNOVATION,
      imageCaption: 'Student engineering teams testing autonomous sensor rigs at the innovation studio.',
      sourceName: 'Kyambogo Engineering Official Feed',
      sourceUrl: 'https://kyu.ac.ug/engineering-news',
      authorId: 'feed-kyu',
      authorName: 'Kyambogo News Wire',
      authorRole: 'Imported Official Source',
      readTimeMinutes: 4,
      viewsCount: 1845,
      sharesCount: 142,
      publishedAt: hoursAgo(18),
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(18),
    },
    {
      id: 'art-005',
      institutionId: 'inst-mak',
      title: 'Inter-University Athletics Championships Return to Kampala Under Upgraded Floodlit Track',
      deck: 'Twelve East African universities confirm squads for track, rugby sevens, and basketball qualifiers next weekend.',
      body:
        'Preparation is complete at the newly resurfaced university athletics stadium ahead of the East African Inter-University Championships.\n\nEvening track finals will run under newly commissioned LED floodlighting, enabling student spectators to attend after afternoon lectures. Accreditation passes for student journalists and campus sports clubs are available at the Sports Deanery.',
      category: 'Sports & Student Life',
      verificationTier: 'imported_official',
      status: 'published',
      isUrgent: false,
      isFeatured: false,
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'College of Business and Management Sciences',
      department: 'Economics',
      programme: 'BSc Computer Science',
      imageUrl: IMAGE_ATHLETICS,
      imageCaption: 'Athletes completing dusk warm-up laps at the renovated floodlit university stadium.',
      sourceName: 'Sports & Recreation Directorate RSS',
      sourceUrl: 'https://www.mak.ac.ug/sports',
      authorId: 'feed-sports',
      authorName: 'University Sports Desk',
      authorRole: 'Imported Official Source',
      readTimeMinutes: 3,
      viewsCount: 1530,
      sharesCount: 95,
      publishedAt: hoursAgo(26),
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(26),
    },
    {
      id: 'art-006',
      institutionId: 'inst-kyu',
      title: 'Commonwealth Master’s Scholarship Nomination Window Closes December 9 for STEM Graduates',
      deck: 'Eligible final-year students and teaching assistants should submit transcripts and referee endorsements to the International Office.',
      body:
        'The Directorate of International Relations has issued a reminder regarding institutional nominations for the 2027 Commonwealth Shared and Split-Site Scholarships.\n\nApplicants from Science, Engineering, Special Needs Education, and Management are advised to submit certified academic transcripts and two academic reference letters through the Kyambogo International Desk before 16:00 EAT on December 9.',
      category: 'Scholarships & Opportunities',
      verificationTier: 'verified_official',
      status: 'published',
      isUrgent: true,
      isFeatured: false,
      campus: 'Kyambogo Main Campus',
      faculty: 'Faculty of Science',
      department: 'Information Technology',
      programme: 'BSc Information Technology',
      imageUrl: IMAGE_HERO,
      imageCaption: 'Kyambogo University Academic Complex and International Relations Secretariat.',
      sourceName: 'Kyambogo International Relations Office',
      sourceUrl: 'https://kyu.ac.ug/scholarships',
      authorId: 'system-kyu',
      authorName: 'International Relations Desk',
      authorRole: 'Institution Administrator',
      readTimeMinutes: 3,
      viewsCount: 3290,
      sharesCount: 410,
      publishedAt: hoursAgo(4),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'art-007',
      institutionId: 'inst-mak',
      title: 'Student Guild Tech Collective Launches Peer Mentorship Clinic for First-Year Coding Labs',
      deck: 'Weekly open office hours at Block B aim to bridge foundational programming gaps ahead of mid-semester practicals.',
      body:
        'Senior undergraduate mentors from the Computing Student Society have organized twice-weekly peer clinics covering data structures, Linux tooling, and version control workflows.\n\nSessions run every Wednesday and Friday from 16:00 to 18:30 EAT in Lab 204 and require no prior registration.',
      category: 'Sports & Student Life',
      verificationTier: 'community_submission',
      status: 'pending_review',
      isUrgent: false,
      isFeatured: false,
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'College of Computing and Information Sciences',
      department: 'Software Engineering',
      programme: 'BSc Software Engineering',
      imageUrl: IMAGE_INNOVATION,
      imageCaption: 'Student mentors collaborating on software engineering lab exercises.',
      sourceName: 'CoCIS Student Society Submission',
      sourceUrl: '',
      authorId: 'contrib-sample',
      authorName: 'Sarah Namukasa',
      authorRole: 'Content Contributor',
      readTimeMinutes: 2,
      viewsCount: 0,
      sharesCount: 0,
      publishedAt: hoursAgo(1),
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
    },
  ];

  const events: InstitutionalEvent[] = [
    {
      id: 'evt-001',
      institutionId: 'inst-mak',
      title: 'Semester II Examination Permit Verification Deadline',
      description: 'Final day for undergraduate and postgraduate students to confirm course unit enrolments and print digital examination permits.',
      category: 'Deadline',
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'College of Computing and Information Sciences',
      venue: 'Academic Registrar Portal & College Desks',
      startsAt: daysAhead(11, 8),
      endsAt: daysAhead(11, 17),
      registrationDeadline: daysAhead(11, 17),
      registrationUrl: 'https://www.mak.ac.ug/registrar',
      isVerified: true,
      createdAt: hoursAgo(48),
    },
    {
      id: 'evt-002',
      institutionId: 'inst-must',
      title: 'Annual East African Digital Health & Biomedical Symposium',
      description: 'Keynote addresses, live device demonstrations, and poster sessions on low-resource clinical diagnostics and AI-assisted triage.',
      category: 'Conference',
      campus: 'Kihumuro Main Campus',
      faculty: 'Faculty of Applied Sciences & Technology',
      venue: 'Kihumuro Auditorium Hall A',
      startsAt: daysAhead(5, 9),
      endsAt: daysAhead(6, 17),
      registrationDeadline: daysAhead(3, 18),
      registrationUrl: 'https://www.must.ac.ug/symposium',
      isVerified: true,
      createdAt: hoursAgo(72),
    },
    {
      id: 'evt-003',
      institutionId: 'inst-kyu',
      title: 'Commonwealth Scholarship Application Clinic & Transcript Review',
      description: 'Hands-on advisory workshop hosted by the International Relations Office for graduating STEM and Education candidates.',
      category: 'Workshop',
      campus: 'Kyambogo Main Campus',
      faculty: 'Faculty of Science',
      venue: 'Senate Conference Room 2',
      startsAt: daysAhead(3, 14),
      endsAt: daysAhead(3, 16),
      registrationDeadline: daysAhead(2, 17),
      registrationUrl: 'https://kyu.ac.ug/scholarships',
      isVerified: true,
      createdAt: hoursAgo(36),
    },
    {
      id: 'evt-004',
      institutionId: 'inst-mak',
      title: 'Inter-University Track & Rugby Sevens Finals',
      description: 'Championship evening finals featuring twelve regional university delegations under the floodlit main track.',
      category: 'Sports',
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'College of Business and Management Sciences',
      venue: 'Main University Stadium',
      startsAt: daysAhead(7, 15),
      endsAt: daysAhead(7, 20),
      isVerified: true,
      createdAt: hoursAgo(30),
    },
    {
      id: 'evt-005',
      institutionId: 'inst-mak',
      title: '76th Graduation Convocation Week Opening',
      description: 'First cluster of the 76th Graduation Ceremony conferring degrees across Health Sciences, Natural Sciences, and Computing.',
      category: 'Ceremony',
      campus: 'Main Campus (Makerere Hill)',
      faculty: 'School of Law',
      venue: 'Freedom Square',
      startsAt: daysAhead(57, 8),
      endsAt: daysAhead(61, 16),
      isVerified: true,
      createdAt: hoursAgo(24),
    },
  ];

  const sources: AuthorizedSource[] = [
    {
      id: 'src-001',
      institutionId: 'inst-mak',
      name: 'Makerere Official News & Notices RSS',
      sourceType: 'rss',
      feedUrl: 'https://news.mak.ac.ug/feed/',
      categoryDefault: 'Academic Notices',
      campusDefault: 'Main Campus (Makerere Hill)',
      publishingRule: 'editorial_queue',
      isActive: true,
      lastSyncedAt: hoursAgo(2),
      lastSyncStatus: 'Healthy · 2 articles verified, 1 duplicate skipped',
      itemsImportedCount: 18,
      duplicatesSkippedCount: 7,
      createdAt: hoursAgo(400),
    },
    {
      id: 'src-002',
      institutionId: 'inst-kyu',
      name: 'Kyambogo Engineering & Innovation Atom Feed',
      sourceType: 'atom',
      feedUrl: 'https://kyu.ac.ug/engineering/atom.xml',
      categoryDefault: 'Scholarships & Opportunities',
      campusDefault: 'Kyambogo Main Campus',
      publishingRule: 'auto_publish',
      isActive: true,
      lastSyncedAt: hoursAgo(5),
      lastSyncStatus: 'Healthy · 1 article auto-published',
      itemsImportedCount: 9,
      duplicatesSkippedCount: 3,
      createdAt: hoursAgo(300),
    },
    {
      id: 'src-003',
      institutionId: 'inst-must',
      name: 'MUST Directorate of Research JSON Feed',
      sourceType: 'json_feed',
      feedUrl: 'https://www.must.ac.ug/research/feed.json',
      categoryDefault: 'Research & Innovation',
      campusDefault: 'Kihumuro Main Campus',
      publishingRule: 'editorial_queue',
      isActive: true,
      lastSyncedAt: hoursAgo(6),
      lastSyncStatus: 'Healthy · Awaiting editor sign-off on 0 drafts',
      itemsImportedCount: 11,
      duplicatesSkippedCount: 4,
      createdAt: hoursAgo(280),
    },
  ];

  const plans: SubscriptionPlan[] = [
    {
      id: 'student_public',
      name: 'Student & Public Access',
      audience: 'For students, staff, alumni, and public readers',
      monthlyUsd: 0,
      annualUsd: 0,
      maxSources: 0,
      maxEditors: 0,
      maxCampuses: 1,
      features: [
        'Unlimited verified news & academic notices',
        'Campus, faculty & programme personalization',
        'Saved bookmarks & event deadline calendar',
        'Web push & email digest preferences',
      ],
    },
    {
      id: 'institutional_standard',
      name: 'Institution Standard',
      audience: 'For single-campus universities, colleges, and institutes',
      monthlyUsd: 180,
      annualUsd: 1800,
      maxSources: 15,
      maxEditors: 20,
      maxCampuses: 3,
      features: [
        'Branded institutional channel & editorial queue',
        'Up to 15 automated RSS / Atom / JSON Feed sources',
        'Role-based access (Admins, Editors, Contributors)',
        'Urgent campus alerts & engagement analytics',
      ],
    },
    {
      id: 'multi_campus_enterprise',
      name: 'Multi-Campus Enterprise',
      audience: 'For flagship national universities & regional consortia',
      monthlyUsd: 490,
      annualUsd: 4900,
      maxSources: 100,
      maxEditors: 150,
      maxCampuses: 25,
      features: [
        'Unlimited faculties, departments & programme targeting',
        'Institutional SSO, custom communication APIs & audit export',
        'SMS / WhatsApp gateway & LMS notification hooks',
        'Dedicated onboarding & SLA uptime governance',
      ],
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-001',
      institutionId: 'inst-mak',
      title: 'Urgent Academic Notice · Makerere University',
      summary: 'Semester II Examination Permit Verification closes December 4 across all three campuses.',
      kind: 'urgent',
      articleId: 'art-001',
      createdAt: hoursAgo(2),
    },
    {
      id: 'notif-002',
      institutionId: 'inst-kyu',
      title: 'Scholarship Deadline · Kyambogo University',
      summary: 'Commonwealth Master’s Scholarship nomination window closes December 9 at 16:00 EAT.',
      kind: 'deadline',
      articleId: 'art-006',
      createdAt: hoursAgo(4),
    },
    {
      id: 'notif-003',
      institutionId: 'inst-must',
      title: 'Upcoming Symposium · MUST Kihumuro',
      summary: 'East African Digital Health & Biomedical Symposium registration closes in 3 days.',
      kind: 'deadline',
      eventId: 'evt-002',
      createdAt: hoursAgo(8),
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-001',
      actorId: 'system-registrar',
      actorName: 'Office of the Academic Registrar',
      actorRole: 'institution_admin',
      institutionId: 'inst-mak',
      action: 'PUBLISH_URGENT_NOTICE',
      targetType: 'article',
      targetId: 'art-001',
      summary: 'Published urgent Semester II academic notice across 3 campuses.',
      timestamp: hoursAgo(2),
    },
    {
      id: 'aud-002',
      actorId: 'system-kyu',
      actorName: 'International Relations Desk',
      actorRole: 'institution_admin',
      institutionId: 'inst-kyu',
      action: 'PUBLISH_URGENT_NOTICE',
      targetType: 'article',
      targetId: 'art-006',
      summary: 'Published Commonwealth Scholarship nomination deadline alert.',
      timestamp: hoursAgo(4),
    },
    {
      id: 'aud-003',
      actorId: 'system-aggregator',
      actorName: 'DILECT Aggregation Scheduler',
      actorRole: 'super_admin',
      institutionId: 'inst-kyu',
      action: 'SOURCE_SYNC_COMPLETED',
      targetType: 'source',
      targetId: 'src-002',
      summary: 'Synced Kyambogo Engineering Atom Feed (1 imported, 3 duplicates skipped).',
      timestamp: hoursAgo(5),
    },
  ];

  return {
    institutions,
    articles,
    events,
    sources,
    users: [],
    auditLogs,
    notifications,
    plans,
    adminClaimed: false,
  };
}

let cachedDb: DilectDatabase | null = null;

export function loadDatabase(): DilectDatabase {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      cachedDb = JSON.parse(raw) as DilectDatabase;
      return cachedDb;
    }
  } catch (err) {
    console.error('Failed to read store file, initializing clean store:', err);
  }
  cachedDb = createInitialDatabase();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: DilectDatabase): void {
  cachedDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, STORE_PATH);
  } catch (err) {
    console.error('Failed to persist store to disk:', err);
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}
