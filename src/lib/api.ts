import type {
  AuditLogEntry,
  AuthorizedSource,
  InstitutionalEvent,
  Institution,
  NewsArticle,
  NotificationItem,
  SubscriptionPlan,
  SubscriptionPlanId,
  UserAccount,
  UserPreferences,
  UserRole,
} from '../types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(path, { ...options, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export interface BootstrapResponse {
  institutions: Institution[];
  articles: NewsArticle[];
  events: InstitutionalEvent[];
  sources: AuthorizedSource[];
  auditLogs: AuditLogEntry[];
  notifications: NotificationItem[];
  plans: SubscriptionPlan[];
  currentUser: UserAccount | null;
}

export function fetchBootstrap(): Promise<BootstrapResponse> {
  return apiRequest<BootstrapResponse>('/api/bootstrap');
}

export function fetchBootstrapStatus(): Promise<{ adminClaimed: boolean; envPasscodeConfigured: boolean }> {
  return apiRequest('/api/auth/bootstrap-status');
}

export function claimAdminAccount(payload: {
  email: string;
  fullName: string;
  password: string;
  passcode?: string;
}): Promise<{ token: string; user: UserAccount }> {
  return apiRequest('/api/auth/claim-admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerAccount(payload: {
  email: string;
  fullName: string;
  password: string;
  institutionId: string;
  roleRequested: 'registered_user' | 'content_contributor';
}): Promise<{ token: string; user: UserAccount }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<{ token: string; user: UserAccount }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserPreferences(prefs: Partial<UserPreferences>): Promise<{ user: UserAccount }> {
  return apiRequest('/api/users/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}

export function toggleBookmark(articleId: string): Promise<{ bookmarks: string[] }> {
  return apiRequest(`/api/users/bookmarks/${encodeURIComponent(articleId)}`, {
    method: 'POST',
  });
}

export function toggleEventReminder(eventId: string): Promise<{ eventReminders: string[] }> {
  return apiRequest(`/api/users/reminders/${encodeURIComponent(eventId)}`, {
    method: 'POST',
  });
}

export function recordArticleView(articleId: string): Promise<{ viewsCount: number }> {
  return apiRequest(`/api/articles/${encodeURIComponent(articleId)}/view`, {
    method: 'POST',
  });
}

export function recordArticleShare(articleId: string): Promise<{ sharesCount: number }> {
  return apiRequest(`/api/articles/${encodeURIComponent(articleId)}/share`, {
    method: 'POST',
  });
}

export function generateArticleSummary(articleId: string): Promise<{ summary: string; mode: 'gemini' | 'extractive' }> {
  return apiRequest(`/api/articles/${encodeURIComponent(articleId)}/summary`, {
    method: 'POST',
  });
}

export function createArticle(payload: Partial<NewsArticle>): Promise<{ article: NewsArticle }> {
  return apiRequest('/api/articles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateArticle(id: string, payload: Partial<NewsArticle>): Promise<{ article: NewsArticle }> {
  return apiRequest(`/api/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createSource(payload: Partial<AuthorizedSource>): Promise<{ source: AuthorizedSource }> {
  return apiRequest('/api/sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function syncSource(
  id: string,
  rawPayload?: string
): Promise<{ source: AuthorizedSource; importedCount: number; duplicatesSkipped: number; articles: NewsArticle[] }> {
  return apiRequest(`/api/sources/${encodeURIComponent(id)}/sync`, {
    method: 'POST',
    body: JSON.stringify(rawPayload ? { rawPayload } : {}),
  });
}

export function createEvent(payload: Partial<InstitutionalEvent>): Promise<{ event: InstitutionalEvent }> {
  return apiRequest('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchTeamUsers(): Promise<{ users: UserAccount[] }> {
  return apiRequest('/api/users');
}

export function createStaffUser(payload: {
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
  institutionId: string;
  department?: string;
}): Promise<{ user: UserAccount }> {
  return apiRequest('/api/users/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserRole(userId: string, role: UserRole): Promise<{ user: UserAccount }> {
  return apiRequest(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function createInstitution(payload: {
  name: string;
  shortName: string;
  city: string;
  country: string;
  tagline: string;
  websiteUrl: string;
  planId: SubscriptionPlanId;
}): Promise<{ institution: Institution }> {
  return apiRequest('/api/institutions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateInstitutionPlan(
  institutionId: string,
  planId: SubscriptionPlanId
): Promise<{ institution: Institution }> {
  return apiRequest(`/api/institutions/${encodeURIComponent(institutionId)}/plan`, {
    method: 'PATCH',
    body: JSON.stringify({ planId }),
  });
}

export function formatShortDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Recent';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function safeExternalHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function verificationLabel(tier: NewsArticle['verificationTier']): string {
  if (tier === 'verified_official') return 'Verified Official';
  if (tier === 'imported_official') return 'Imported Official Source';
  return 'Community Submission';
}
