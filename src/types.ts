export type UserRole =
  | 'super_admin'
  | 'institution_admin'
  | 'content_editor'
  | 'content_contributor'
  | 'registered_user';

export type VerificationTier =
  | 'verified_official'
  | 'imported_official'
  | 'community_submission';

export type ArticleStatus =
  | 'published'
  | 'pending_review'
  | 'scheduled'
  | 'draft'
  | 'archived'
  | 'rejected';

export type SubscriptionPlanId =
  | 'student_public'
  | 'institutional_standard'
  | 'multi_campus_enterprise';

export interface Institution {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  country: string;
  city: string;
  tagline: string;
  websiteUrl: string;
  primaryColor: string;
  planId: SubscriptionPlanId;
  campuses: string[];
  faculties: string[];
  departments: string[];
  programmes: string[];
  verifiedSourcesCount: number;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  institutionId: string;
  title: string;
  deck: string;
  body: string;
  category: string;
  verificationTier: VerificationTier;
  status: ArticleStatus;
  isUrgent: boolean;
  isFeatured: boolean;
  campus: string;
  faculty: string;
  department: string;
  programme: string;
  imageUrl: string;
  imageCaption: string;
  sourceName: string;
  sourceUrl: string;
  sourceGuid?: string;
  contentHash?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  attachmentLabel?: string;
  attachmentUrl?: string;
  readTimeMinutes: number;
  viewsCount: number;
  sharesCount: number;
  publishedAt: string;
  scheduledFor?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalEvent {
  id: string;
  institutionId: string;
  title: string;
  description: string;
  category: 'Academic' | 'Conference' | 'Workshop' | 'Ceremony' | 'Sports' | 'Deadline';
  campus: string;
  faculty: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline?: string;
  registrationUrl?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthorizedSource {
  id: string;
  institutionId: string;
  name: string;
  sourceType: 'rss' | 'atom' | 'json_feed' | 'official_api';
  feedUrl: string;
  categoryDefault: string;
  campusDefault: string;
  publishingRule: 'editorial_queue' | 'auto_publish';
  isActive: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: string;
  itemsImportedCount: number;
  duplicatesSkippedCount: number;
  createdAt: string;
}

export interface UserPreferences {
  institutionId: string;
  campus: string;
  faculty: string;
  department: string;
  programme: string;
  interests: string[];
  webPushEnabled: boolean;
  emailDigestEnabled: boolean;
  urgentAlertsOnly: boolean;
  deadlineReminders: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionId: string;
  department?: string;
  bookmarks: string[];
  eventReminders: string[];
  preferences: UserPreferences;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  institutionId: string;
  action: string;
  targetType: 'article' | 'source' | 'event' | 'institution' | 'user' | 'subscription';
  targetId: string;
  summary: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  institutionId: string;
  title: string;
  summary: string;
  kind: 'urgent' | 'deadline' | 'editorial' | 'system';
  articleId?: string;
  eventId?: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  audience: string;
  monthlyUsd: number;
  annualUsd: number;
  maxSources: number;
  maxEditors: number;
  maxCampuses: number;
  features: string[];
}
