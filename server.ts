import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  hashPassword,
  optionalAuth,
  requireAuth,
  requireRole,
  signSessionToken,
  verifyPassword,
  type AuthedRequest,
} from './src/server/auth.ts';
import {
  fetchAuthorizedFeed,
  parseFeedPayload,
  sanitizePublicLink,
  validateSafeExternalUrl,
} from './src/server/aggregator.ts';
import { createId, loadDatabase, saveDatabase, type StoredUserRecord } from './src/server/store.ts';
import type {
  ArticleStatus,
  AuditLogEntry,
  AuthorizedSource,
  InstitutionalEvent,
  Institution,
  NewsArticle,
  SubscriptionPlanId,
  UserAccount,
  UserRole,
  VerificationTier,
} from './src/types.ts';

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

// Lightweight in-memory sliding-window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}

function toPublicUser(user: StoredUserRecord): UserAccount {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

function recordAudit(
  actor: { id: string; fullName: string; role: string },
  institutionId: string,
  action: string,
  targetType: AuditLogEntry['targetType'],
  targetId: string,
  summary: string
): void {
  const db = loadDatabase();
  db.auditLogs.unshift({
    id: createId('aud'),
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    institutionId,
    action,
    targetType,
    targetId,
    summary,
    timestamp: new Date().toISOString(),
  });
  if (db.auditLogs.length > 250) {
    db.auditLogs.length = 250;
  }
  saveDatabase(db);
}

function canManageInstitution(auth: NonNullable<AuthedRequest['auth']>, institutionId: string): boolean {
  if (auth.role === 'super_admin') return true;
  return auth.institutionId === institutionId;
}

// ---------- AUTHENTICATION & BOOTSTRAP ROUTES ----------

app.get('/api/auth/bootstrap-status', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  res.json({
    adminClaimed: db.adminClaimed,
    envPasscodeConfigured: envPasscode.length > 0,
  });
});

app.post('/api/auth/claim-admin', rateLimit(10, 60_000), (req: Request, res: Response) => {
  const db = loadDatabase();
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const { email, fullName, password, passcode } = req.body as {
    email?: string;
    fullName?: string;
    password?: string;
    passcode?: string;
  };

  if (envPasscode) {
    if (!passcode || passcode !== envPasscode) {
      res.status(403).json({ error: 'Invalid server admin passcode.' });
      return;
    }
  } else if (db.adminClaimed) {
    res.status(403).json({ error: 'Super Admin setup has already been claimed. Please sign in.' });
    return;
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (fullName || 'Platform Administrator').trim();
  if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 8) {
    res.status(400).json({ error: 'Provide a valid email and a password of at least 8 characters.' });
    return;
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const defaultInst = db.institutions[0];
  const newAdmin: StoredUserRecord = {
    id: createId('usr'),
    email: cleanEmail,
    fullName: cleanName,
    role: 'super_admin',
    institutionId: defaultInst?.id || 'inst-mak',
    department: 'Platform Governance',
    bookmarks: [],
    eventReminders: [],
    preferences: {
      institutionId: defaultInst?.id || 'inst-mak',
      campus: defaultInst?.campuses[0] || '',
      faculty: defaultInst?.faculties[0] || '',
      department: defaultInst?.departments[0] || '',
      programme: defaultInst?.programmes[0] || '',
      interests: ['Academic Notices', 'Research & Innovation'],
      webPushEnabled: true,
      emailDigestEnabled: true,
      urgentAlertsOnly: false,
      deadlineReminders: true,
    },
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  db.users.push(newAdmin);
  db.adminClaimed = true;
  saveDatabase(db);

  recordAudit(
    newAdmin,
    newAdmin.institutionId,
    'CLAIM_SUPER_ADMIN',
    'user',
    newAdmin.id,
    `Claimed initial Super Administrator governance account (${cleanEmail}).`
  );

  const token = signSessionToken({
    userId: newAdmin.id,
    email: newAdmin.email,
    role: newAdmin.role,
    institutionId: newAdmin.institutionId,
  });

  res.status(201).json({ token, user: toPublicUser(newAdmin) });
});

app.post('/api/auth/register', rateLimit(15, 60_000), (req: Request, res: Response) => {
  const db = loadDatabase();
  const { email, fullName, password, institutionId, roleRequested } = req.body as {
    email?: string;
    fullName?: string;
    password?: string;
    institutionId?: string;
    roleRequested?: 'registered_user' | 'content_contributor';
  };

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@') || cleanName.length < 2) {
    res.status(400).json({ error: 'Valid full name and institutional or personal email are required.' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const inst = db.institutions.find((i) => i.id === institutionId) || db.institutions[0];
  const assignedRole: UserRole =
    roleRequested === 'content_contributor' ? 'content_contributor' : 'registered_user';

  const newUser: StoredUserRecord = {
    id: createId('usr'),
    email: cleanEmail,
    fullName: cleanName,
    role: assignedRole,
    institutionId: inst.id,
    bookmarks: [],
    eventReminders: [],
    preferences: {
      institutionId: inst.id,
      campus: inst.campuses[0] || '',
      faculty: inst.faculties[0] || '',
      department: inst.departments[0] || '',
      programme: inst.programmes[0] || '',
      interests: ['Academic Notices', 'Scholarships & Opportunities'],
      webPushEnabled: true,
      emailDigestEnabled: true,
      urgentAlertsOnly: false,
      deadlineReminders: true,
    },
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  saveDatabase(db);

  const token = signSessionToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    institutionId: newUser.institutionId,
  });

  res.status(201).json({ token, user: toPublicUser(newUser) });
});

app.post('/api/auth/login', rateLimit(20, 60_000), (req: Request, res: Response) => {
  const db = loadDatabase();
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId,
  });

  res.json({ token, user: toPublicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === req.auth?.userId);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

// ---------- BOOTSTRAP & PUBLIC / AUTHED DATA ROUTES ----------

app.get('/api/bootstrap', optionalAuth, (req: AuthedRequest, res: Response) => {
  const db = loadDatabase();
  const auth = req.auth;
  const userRecord = auth ? db.users.find((u) => u.id === auth.userId) : undefined;

  const isEditorial =
    auth && ['super_admin', 'institution_admin', 'content_editor', 'content_contributor'].includes(auth.role);

  const visibleArticles = db.articles.filter((a) => {
    if (a.status === 'published') return true;
    if (!isEditorial || !auth) return false;
    if (auth.role === 'super_admin') return true;
    return a.institutionId === auth.institutionId;
  });

  const visibleSources =
    auth && ['super_admin', 'institution_admin', 'content_editor'].includes(auth.role)
      ? db.sources.filter((s) => auth.role === 'super_admin' || s.institutionId === auth.institutionId)
      : [];

  const visibleAuditLogs =
    auth && ['super_admin', 'institution_admin', 'content_editor'].includes(auth.role)
      ? db.auditLogs.filter((l) => auth.role === 'super_admin' || l.institutionId === auth.institutionId)
      : [];

  res.json({
    institutions: db.institutions,
    articles: visibleArticles,
    events: db.events,
    sources: visibleSources,
    auditLogs: visibleAuditLogs,
    notifications: db.notifications,
    plans: db.plans,
    currentUser: userRecord ? toPublicUser(userRecord) : null,
  });
});

// ---------- USER PERSONALIZATION & BOOKMARKS ----------

app.patch('/api/users/preferences', requireAuth, (req: AuthedRequest, res: Response) => {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === req.auth?.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const incoming = req.body as Partial<UserAccount['preferences']>;
  user.preferences = {
    ...user.preferences,
    institutionId: typeof incoming.institutionId === 'string' ? incoming.institutionId : user.preferences.institutionId,
    campus: typeof incoming.campus === 'string' ? incoming.campus : user.preferences.campus,
    faculty: typeof incoming.faculty === 'string' ? incoming.faculty : user.preferences.faculty,
    department: typeof incoming.department === 'string' ? incoming.department : user.preferences.department,
    programme: typeof incoming.programme === 'string' ? incoming.programme : user.preferences.programme,
    interests: Array.isArray(incoming.interests) ? incoming.interests.slice(0, 12) : user.preferences.interests,
    webPushEnabled: typeof incoming.webPushEnabled === 'boolean' ? incoming.webPushEnabled : user.preferences.webPushEnabled,
    emailDigestEnabled:
      typeof incoming.emailDigestEnabled === 'boolean' ? incoming.emailDigestEnabled : user.preferences.emailDigestEnabled,
    urgentAlertsOnly:
      typeof incoming.urgentAlertsOnly === 'boolean' ? incoming.urgentAlertsOnly : user.preferences.urgentAlertsOnly,
    deadlineReminders:
      typeof incoming.deadlineReminders === 'boolean' ? incoming.deadlineReminders : user.preferences.deadlineReminders,
  };
  saveDatabase(db);
  res.json({ user: toPublicUser(user) });
});

app.post('/api/users/bookmarks/:articleId', requireAuth, (req: AuthedRequest, res: Response) => {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === req.auth?.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const { articleId } = req.params;
  if (user.bookmarks.includes(articleId)) {
    user.bookmarks = user.bookmarks.filter((id) => id !== articleId);
  } else {
    user.bookmarks.push(articleId);
  }
  saveDatabase(db);
  res.json({ bookmarks: user.bookmarks });
});

app.post('/api/users/reminders/:eventId', requireAuth, (req: AuthedRequest, res: Response) => {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === req.auth?.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const { eventId } = req.params;
  if (user.eventReminders.includes(eventId)) {
    user.eventReminders = user.eventReminders.filter((id) => id !== eventId);
  } else {
    user.eventReminders.push(eventId);
  }
  saveDatabase(db);
  res.json({ eventReminders: user.eventReminders });
});

// ---------- TEAM & STAFF MANAGEMENT (RBAC + TENANT ISOLATION) ----------

app.get(
  '/api/users',
  requireAuth,
  requireRole(['super_admin', 'institution_admin']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const filtered = db.users
      .filter((u) => auth.role === 'super_admin' || u.institutionId === auth.institutionId)
      .map(toPublicUser);
    res.json({ users: filtered });
  }
);

app.post(
  '/api/users/staff',
  requireAuth,
  requireRole(['super_admin', 'institution_admin']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    if (!actor) {
      res.status(401).json({ error: 'Actor account not found.' });
      return;
    }

    const { email, fullName, password, role, institutionId, department } = req.body as {
      email?: string;
      fullName?: string;
      password?: string;
      role?: UserRole;
      institutionId?: string;
      department?: string;
    };

    const targetInstId = auth.role === 'super_admin' && institutionId ? institutionId : auth.institutionId;
    const allowedStaffRoles: UserRole[] =
      auth.role === 'super_admin'
        ? ['super_admin', 'institution_admin', 'content_editor', 'content_contributor', 'registered_user']
        : ['institution_admin', 'content_editor', 'content_contributor', 'registered_user'];

    if (!role || !allowedStaffRoles.includes(role)) {
      res.status(403).json({ error: 'Role assignment not permitted for your account tier.' });
      return;
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanName.length < 2 || !password || password.length < 8) {
      res.status(400).json({ error: 'Valid name, email, and initial password (8+ chars) are required.' });
      return;
    }
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }

    const inst = db.institutions.find((i) => i.id === targetInstId) || db.institutions[0];
    const staffUser: StoredUserRecord = {
      id: createId('usr'),
      email: cleanEmail,
      fullName: cleanName,
      role,
      institutionId: inst.id,
      department: (department || '').trim() || undefined,
      bookmarks: [],
      eventReminders: [],
      preferences: {
        institutionId: inst.id,
        campus: inst.campuses[0] || '',
        faculty: inst.faculties[0] || '',
        department: inst.departments[0] || '',
        programme: inst.programmes[0] || '',
        interests: ['Academic Notices'],
        webPushEnabled: true,
        emailDigestEnabled: true,
        urgentAlertsOnly: false,
        deadlineReminders: true,
      },
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    db.users.push(staffUser);
    saveDatabase(db);

    recordAudit(
      actor,
      inst.id,
      'PROVISION_STAFF_ACCOUNT',
      'user',
      staffUser.id,
      `Provisioned ${role} account for ${cleanName} (${cleanEmail}).`
    );

    res.status(201).json({ user: toPublicUser(staffUser) });
  }
);

app.patch(
  '/api/users/:id/role',
  requireAuth,
  requireRole(['super_admin', 'institution_admin']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    const target = db.users.find((u) => u.id === req.params.id);
    if (!actor || !target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (!canManageInstitution(auth, target.institutionId)) {
      res.status(403).json({ error: 'Cross-institution user modification is forbidden.' });
      return;
    }

    const { role } = req.body as { role?: UserRole };
    const allowed: UserRole[] =
      auth.role === 'super_admin'
        ? ['super_admin', 'institution_admin', 'content_editor', 'content_contributor', 'registered_user']
        : ['institution_admin', 'content_editor', 'content_contributor', 'registered_user'];

    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: 'Invalid or unauthorized role assignment.' });
      return;
    }

    target.role = role;
    saveDatabase(db);
    recordAudit(actor, target.institutionId, 'UPDATE_USER_ROLE', 'user', target.id, `Updated ${target.fullName} role to ${role}.`);
    res.json({ user: toPublicUser(target) });
  }
);

// ---------- ARTICLES, EDITORIAL WORKFLOW & AI BRIEF ----------

app.post('/api/articles/:id/view', (req: Request, res: Response) => {
  const db = loadDatabase();
  const article = db.articles.find((a) => a.id === req.params.id);
  if (!article) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  article.viewsCount += 1;
  saveDatabase(db);
  res.json({ viewsCount: article.viewsCount });
});

app.post('/api/articles/:id/share', (req: Request, res: Response) => {
  const db = loadDatabase();
  const article = db.articles.find((a) => a.id === req.params.id);
  if (!article) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  article.sharesCount += 1;
  saveDatabase(db);
  res.json({ sharesCount: article.sharesCount });
});

app.post('/api/articles/:id/summary', rateLimit(15, 60_000), async (req: Request, res: Response) => {
  const db = loadDatabase();
  const article = db.articles.find((a) => a.id === req.params.id);
  if (!article) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Summarize this institutional announcement into 3 concise, factual bullet points for busy university students and staff. Preserve deadlines and action items accurately.\n\nTitle: ${article.title}\nDeck: ${article.deck}\nBody: ${article.body}`,
      });
      const text = response.text?.trim();
      if (text) {
        res.json({ summary: text, mode: 'gemini' });
        return;
      }
    } catch (err) {
      console.error('Gemini summary fallback triggered:', err);
    }
  }

  // Deterministic extractive brief fallback
  const sentences = article.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const brief = [article.deck, ...sentences.slice(0, 2)].filter(Boolean).map((s) => `• ${s}`).join('\n');
  res.json({ summary: brief, mode: 'extractive' });
});

app.post(
  '/api/articles',
  requireAuth,
  requireRole(['super_admin', 'institution_admin', 'content_editor', 'content_contributor']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    if (!actor) {
      res.status(401).json({ error: 'Actor account not found.' });
      return;
    }

    const body = req.body as Partial<NewsArticle>;
    const targetInstId = auth.role === 'super_admin' && body.institutionId ? body.institutionId : auth.institutionId;
    const inst = db.institutions.find((i) => i.id === targetInstId);
    if (!inst) {
      res.status(400).json({ error: 'Target institution not found.' });
      return;
    }

    const title = (body.title || '').trim();
    const deck = (body.deck || '').trim();
    const articleBody = (body.body || '').trim();
    if (title.length < 6 || articleBody.length < 20) {
      res.status(400).json({ error: 'Title (min 6 chars) and article body (min 20 chars) are required.' });
      return;
    }

    const isContributor = auth.role === 'content_contributor';
    const requestedStatus: ArticleStatus = isContributor
      ? 'pending_review'
      : body.status === 'scheduled' || body.status === 'draft' || body.status === 'pending_review'
        ? body.status
        : 'published';

    const verificationTier: VerificationTier = isContributor ? 'community_submission' : 'verified_official';
    const nowIso = new Date().toISOString();
    const words = articleBody.split(/\s+/).length;

    const newArticle: NewsArticle = {
      id: createId('art'),
      institutionId: inst.id,
      title,
      deck: deck || articleBody.slice(0, 150),
      body: articleBody,
      category: (body.category || 'Academic Notices').trim(),
      verificationTier,
      status: requestedStatus,
      isUrgent: !isContributor && Boolean(body.isUrgent),
      isFeatured: !isContributor && Boolean(body.isFeatured),
      campus: (body.campus || inst.campuses[0] || 'All Campuses').trim(),
      faculty: (body.faculty || 'All Faculties').trim(),
      department: (body.department || 'All Departments').trim(),
      programme: (body.programme || 'All Programmes').trim(),
      imageUrl: sanitizePublicLink(body.imageUrl) || '/src/assets/images/hero_campus_library_1795482356471.jpg',
      imageCaption: (body.imageCaption || `${inst.shortName} institutional bulletin`).trim(),
      sourceName: isContributor ? `${actor.fullName} (Community Submission)` : `${inst.shortName} Official Desk`,
      sourceUrl: sanitizePublicLink(body.sourceUrl) || inst.websiteUrl,
      authorId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.role,
      attachmentLabel: body.attachmentLabel ? body.attachmentLabel.trim() : undefined,
      attachmentUrl: sanitizePublicLink(body.attachmentUrl) || undefined,
      readTimeMinutes: Math.max(1, Math.round(words / 180)),
      viewsCount: 0,
      sharesCount: 0,
      publishedAt: requestedStatus === 'scheduled' && body.scheduledFor ? body.scheduledFor : nowIso,
      scheduledFor: body.scheduledFor,
      expiresAt: body.expiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.articles.unshift(newArticle);
    if (newArticle.status === 'published' && newArticle.isUrgent) {
      db.notifications.unshift({
        id: createId('notif'),
        institutionId: inst.id,
        title: `Urgent Notice · ${inst.shortName}`,
        summary: newArticle.title,
        kind: 'urgent',
        articleId: newArticle.id,
        createdAt: nowIso,
      });
    }
    saveDatabase(db);

    recordAudit(
      actor,
      inst.id,
      isContributor ? 'SUBMIT_FOR_REVIEW' : `ARTICLE_${requestedStatus.toUpperCase()}`,
      'article',
      newArticle.id,
      `${isContributor ? 'Submitted' : 'Created'} "${newArticle.title}" (${newArticle.status}).`
    );

    res.status(201).json({ article: newArticle });
  }
);

app.patch(
  '/api/articles/:id',
  requireAuth,
  requireRole(['super_admin', 'institution_admin', 'content_editor']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    const article = db.articles.find((a) => a.id === req.params.id);
    if (!actor || !article) {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }
    if (!canManageInstitution(auth, article.institutionId)) {
      res.status(403).json({ error: 'Cross-institution editorial actions are forbidden.' });
      return;
    }

    const patch = req.body as Partial<NewsArticle>;
    const previousStatus = article.status;

    if (typeof patch.title === 'string' && patch.title.trim().length >= 6) article.title = patch.title.trim();
    if (typeof patch.deck === 'string') article.deck = patch.deck.trim();
    if (typeof patch.body === 'string' && patch.body.trim().length >= 20) article.body = patch.body.trim();
    if (typeof patch.category === 'string') article.category = patch.category.trim();
    if (typeof patch.isUrgent === 'boolean') article.isUrgent = patch.isUrgent;
    if (typeof patch.isFeatured === 'boolean') article.isFeatured = patch.isFeatured;
    if (typeof patch.verificationTier === 'string') article.verificationTier = patch.verificationTier;
    if (typeof patch.status === 'string') {
      article.status = patch.status;
      if (patch.status === 'published' && previousStatus !== 'published') {
        article.publishedAt = new Date().toISOString();
      }
    }
    article.updatedAt = new Date().toISOString();

    if (article.status === 'published' && article.isUrgent && previousStatus !== 'published') {
      const inst = db.institutions.find((i) => i.id === article.institutionId);
      db.notifications.unshift({
        id: createId('notif'),
        institutionId: article.institutionId,
        title: `Urgent Notice · ${inst?.shortName || 'Institution'}`,
        summary: article.title,
        kind: 'urgent',
        articleId: article.id,
        createdAt: new Date().toISOString(),
      });
    }

    saveDatabase(db);
    recordAudit(
      actor,
      article.institutionId,
      'UPDATE_ARTICLE',
      'article',
      article.id,
      `Updated "${article.title}" (${previousStatus} -> ${article.status}).`
    );

    res.json({ article });
  }
);

// ---------- AUTOMATED OFFICIAL SOURCE AGGREGATION ----------

app.post(
  '/api/sources',
  requireAuth,
  requireRole(['super_admin', 'institution_admin']),
  async (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    if (!actor) {
      res.status(401).json({ error: 'Actor not found.' });
      return;
    }

    const { institutionId, name, sourceType, feedUrl, categoryDefault, campusDefault, publishingRule } = req.body as {
      institutionId?: string;
      name?: string;
      sourceType?: AuthorizedSource['sourceType'];
      feedUrl?: string;
      categoryDefault?: string;
      campusDefault?: string;
      publishingRule?: AuthorizedSource['publishingRule'];
    };

    const targetInstId = auth.role === 'super_admin' && institutionId ? institutionId : auth.institutionId;
    const inst = db.institutions.find((i) => i.id === targetInstId);
    if (!inst) {
      res.status(400).json({ error: 'Institution not found.' });
      return;
    }
    if (!name || !feedUrl) {
      res.status(400).json({ error: 'Source name and official feed URL are required.' });
      return;
    }

    try {
      await validateSafeExternalUrl(feedUrl.trim());
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid source URL.' });
      return;
    }

    const newSource: AuthorizedSource = {
      id: createId('src'),
      institutionId: inst.id,
      name: name.trim(),
      sourceType: sourceType || 'rss',
      feedUrl: feedUrl.trim(),
      categoryDefault: (categoryDefault || 'Academic Notices').trim(),
      campusDefault: (campusDefault || inst.campuses[0] || 'Main Campus').trim(),
      publishingRule: publishingRule === 'auto_publish' ? 'auto_publish' : 'editorial_queue',
      isActive: true,
      itemsImportedCount: 0,
      duplicatesSkippedCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.sources.unshift(newSource);
    inst.verifiedSourcesCount = db.sources.filter((s) => s.institutionId === inst.id && s.isActive).length;
    saveDatabase(db);

    recordAudit(
      actor,
      inst.id,
      'REGISTER_OFFICIAL_SOURCE',
      'source',
      newSource.id,
      `Registered authorized ${newSource.sourceType.toUpperCase()} source "${newSource.name}".`
    );

    res.status(201).json({ source: newSource });
  }
);

app.post(
  '/api/sources/:id/sync',
  requireAuth,
  requireRole(['super_admin', 'institution_admin', 'content_editor']),
  async (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    const source = db.sources.find((s) => s.id === req.params.id);
    if (!actor || !source) {
      res.status(404).json({ error: 'Authorized source not found.' });
      return;
    }
    if (!canManageInstitution(auth, source.institutionId)) {
      res.status(403).json({ error: 'Cross-institution source synchronization is forbidden.' });
      return;
    }

    const { rawPayload } = req.body as { rawPayload?: string };
    let feedItems;
    try {
      feedItems =
        rawPayload && rawPayload.trim().length > 0
          ? parseFeedPayload(rawPayload, source.feedUrl)
          : await fetchAuthorizedFeed(source.feedUrl);
    } catch (err) {
      source.lastSyncedAt = new Date().toISOString();
      source.lastSyncStatus = `Sync error · ${err instanceof Error ? err.message : 'Unable to reach feed'}`;
      saveDatabase(db);
      res.status(422).json({ error: source.lastSyncStatus, source });
      return;
    }

    let importedCount = 0;
    let duplicatesSkipped = 0;
    const nowIso = new Date().toISOString();
    const newArticles: NewsArticle[] = [];

    for (const item of feedItems) {
      const duplicate = db.articles.some(
        (a) =>
          a.institutionId === source.institutionId &&
          ((a.sourceGuid && a.sourceGuid === item.guid) ||
            (a.contentHash && a.contentHash === item.contentHash) ||
            a.title.toLowerCase() === item.title.toLowerCase())
      );
      if (duplicate) {
        duplicatesSkipped += 1;
        continue;
      }

      const inst = db.institutions.find((i) => i.id === source.institutionId);
      const artStatus: ArticleStatus = source.publishingRule === 'auto_publish' ? 'published' : 'pending_review';
      const createdArticle: NewsArticle = {
        id: createId('art'),
        institutionId: source.institutionId,
        title: item.title,
        deck: item.summary,
        body: item.body,
        category: item.category || source.categoryDefault,
        verificationTier: 'imported_official',
        status: artStatus,
        isUrgent: false,
        isFeatured: false,
        campus: source.campusDefault,
        faculty: inst?.faculties[0] || 'All Faculties',
        department: inst?.departments[0] || 'All Departments',
        programme: inst?.programmes[0] || 'All Programmes',
        imageUrl: '/src/assets/images/story_research_lab_1795482357348.jpg',
        imageCaption: `Imported from ${source.name}`,
        sourceName: source.name,
        sourceUrl: item.link,
        sourceGuid: item.guid,
        contentHash: item.contentHash,
        authorId: source.id,
        authorName: item.author || source.name,
        authorRole: 'Imported Official Source',
        readTimeMinutes: Math.max(1, Math.round(item.body.split(/\s+/).length / 180)),
        viewsCount: 0,
        sharesCount: 0,
        publishedAt: item.publishedAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.articles.unshift(createdArticle);
      newArticles.push(createdArticle);
      importedCount += 1;
    }

    source.lastSyncedAt = nowIso;
    source.itemsImportedCount += importedCount;
    source.duplicatesSkippedCount += duplicatesSkipped;
    source.lastSyncStatus = `Healthy · ${importedCount} imported, ${duplicatesSkipped} duplicate(s) skipped`;
    saveDatabase(db);

    recordAudit(
      actor,
      source.institutionId,
      'SYNC_OFFICIAL_SOURCE',
      'source',
      source.id,
      `Synced "${source.name}": ${importedCount} imported (${source.publishingRule}), ${duplicatesSkipped} duplicates skipped.`
    );

    res.json({ source, importedCount, duplicatesSkipped, articles: newArticles });
  }
);

// ---------- EVENTS CALENDAR ----------

app.post(
  '/api/events',
  requireAuth,
  requireRole(['super_admin', 'institution_admin', 'content_editor']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    if (!actor) {
      res.status(401).json({ error: 'Actor not found.' });
      return;
    }

    const body = req.body as Partial<InstitutionalEvent>;
    const targetInstId = auth.role === 'super_admin' && body.institutionId ? body.institutionId : auth.institutionId;
    const inst = db.institutions.find((i) => i.id === targetInstId);
    if (!inst) {
      res.status(400).json({ error: 'Institution not found.' });
      return;
    }
    if (!body.title || !body.startsAt || !body.venue) {
      res.status(400).json({ error: 'Event title, start date/time, and venue are required.' });
      return;
    }

    const newEvent: InstitutionalEvent = {
      id: createId('evt'),
      institutionId: inst.id,
      title: body.title.trim(),
      description: (body.description || '').trim() || 'Official institutional calendar entry.',
      category: body.category || 'Academic',
      campus: (body.campus || inst.campuses[0] || 'Main Campus').trim(),
      faculty: (body.faculty || inst.faculties[0] || 'All Faculties').trim(),
      venue: body.venue.trim(),
      startsAt: new Date(body.startsAt).toISOString(),
      endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : new Date(body.startsAt).toISOString(),
      registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline).toISOString() : undefined,
      registrationUrl: sanitizePublicLink(body.registrationUrl) || undefined,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    db.events.unshift(newEvent);
    saveDatabase(db);
    recordAudit(actor, inst.id, 'CREATE_EVENT', 'event', newEvent.id, `Scheduled event "${newEvent.title}".`);
    res.status(201).json({ event: newEvent });
  }
);

// ---------- INSTITUTION ONBOARDING & SUBSCRIPTIONS ----------

app.post(
  '/api/institutions',
  requireAuth,
  requireRole(['super_admin']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    if (!actor) {
      res.status(401).json({ error: 'Actor not found.' });
      return;
    }

    const { name, shortName, city, country, tagline, websiteUrl, planId, campuses, faculties } = req.body as {
      name?: string;
      shortName?: string;
      city?: string;
      country?: string;
      tagline?: string;
      websiteUrl?: string;
      planId?: SubscriptionPlanId;
      campuses?: string[];
      faculties?: string[];
    };

    if (!name || !shortName || !city) {
      res.status(400).json({ error: 'Institution name, short name, and city are required.' });
      return;
    }

    const slug = shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const inst: Institution = {
      id: `inst-${crypto.randomBytes(3).toString('hex')}`,
      slug,
      name: name.trim(),
      shortName: shortName.trim(),
      country: (country || 'Uganda').trim(),
      city: city.trim(),
      tagline: (tagline || 'Verified Institutional Newsroom').trim(),
      websiteUrl: sanitizePublicLink(websiteUrl) || 'https://example.edu',
      primaryColor: '#1E3A8A',
      planId: planId || 'institutional_standard',
      campuses: campuses && campuses.length ? campuses : [`${shortName.trim()} Main Campus`],
      faculties: faculties && faculties.length ? faculties : ['Faculty of Science & Technology', 'School of Business'],
      departments: ['General Studies', 'Computer Science', 'Management'],
      programmes: ['BSc Computer Science', 'BBA Business Administration'],
      verifiedSourcesCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.institutions.push(inst);
    saveDatabase(db);
    recordAudit(actor, inst.id, 'ONBOARD_INSTITUTION', 'institution', inst.id, `Onboarded ${inst.name} (${inst.city}).`);
    res.status(201).json({ institution: inst });
  }
);

app.patch(
  '/api/institutions/:id/plan',
  requireAuth,
  requireRole(['super_admin', 'institution_admin']),
  (req: AuthedRequest, res: Response) => {
    const db = loadDatabase();
    const auth = req.auth!;
    const actor = db.users.find((u) => u.id === auth.userId);
    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!actor || !inst) {
      res.status(404).json({ error: 'Institution not found.' });
      return;
    }
    if (!canManageInstitution(auth, inst.id)) {
      res.status(403).json({ error: 'Cannot change subscription plan for another institution.' });
      return;
    }

    const { planId } = req.body as { planId?: SubscriptionPlanId };
    if (!planId || !db.plans.some((p) => p.id === planId)) {
      res.status(400).json({ error: 'Invalid subscription plan.' });
      return;
    }

    const oldPlan = inst.planId;
    inst.planId = planId;
    saveDatabase(db);
    recordAudit(
      actor,
      inst.id,
      'UPDATE_SUBSCRIPTION_PLAN',
      'subscription',
      inst.id,
      `Changed ${inst.shortName} subscription plan from ${oldPlan} to ${planId}.`
    );
    res.json({ institution: inst });
  }
);

// ---------- START SERVER WITH VITE MIDDLEWARE ----------

async function startServer() {
  loadDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DILECT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
