import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  Check,
  FilePlus2,
  History,
  LayoutDashboard,
  RefreshCw,
  Rss,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  AuditLogEntry,
  AuthorizedSource,
  Institution,
  NewsArticle,
  SubscriptionPlanId,
  UserAccount,
  UserRole,
} from '../types';
import {
  createArticle,
  createInstitution,
  createSource,
  createStaffUser,
  fetchTeamUsers,
  formatDateTime,
  syncSource,
  updateArticle,
  updateUserRole,
  verificationLabel,
} from '../lib/api';

interface EditorialDashboardProps {
  currentUser: UserAccount | null;
  institutions: Institution[];
  articles: NewsArticle[];
  sources: AuthorizedSource[];
  auditLogs: AuditLogEntry[];
  onOpenSignIn: () => void;
  onRefreshData: () => Promise<void>;
}

type DashSection =
  | 'overview'
  | 'compose'
  | 'queue'
  | 'sources'
  | 'team'
  | 'audit'
  | 'institutions';

const PRESET_IMAGES = [
  { label: 'University Library Quad', url: '/src/assets/images/hero_campus_library_1795482356471.jpg' },
  { label: 'Research Laboratory', url: '/src/assets/images/story_research_lab_1795482357348.jpg' },
  { label: 'Convocation Auditorium', url: '/src/assets/images/story_convocation_hall_1795482356396.jpg' },
  { label: 'Innovation Studio', url: '/src/assets/images/story_innovation_hub_1795482357371.jpg' },
  { label: 'University Athletics Track', url: '/src/assets/images/story_athletics_stadium_1795482357543.jpg' },
];

const SAMPLE_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Official University Academic Feed</title>
    <item>
      <guid>mak-senate-notice-2026-11-23</guid>
      <title>Postgraduate Research Ethics Clearance Submission Window Opens for January Cohort</title>
      <link>https://news.mak.ac.ug/notices/ethics-clearance-2026</link>
      <pubDate>Mon, 23 Nov 2026 10:15:00 GMT</pubDate>
      <category>Research &amp; Innovation</category>
      <description>Graduate candidates preparing dissertation proposals for the January sitting must upload signed supervisor endorsements and ethics protocols via the research portal by December 12.</description>
    </item>
  </channel>
</rss>`;

export function EditorialDashboard({
  currentUser,
  institutions,
  articles,
  sources,
  auditLogs,
  onOpenSignIn,
  onRefreshData,
}: EditorialDashboardProps) {
  const isStaff =
    currentUser &&
    ['super_admin', 'institution_admin', 'content_editor', 'content_contributor'].includes(
      currentUser.role
    );
  const canEdit =
    currentUser && ['super_admin', 'institution_admin', 'content_editor'].includes(currentUser.role);
  const isAdmin = currentUser && ['super_admin', 'institution_admin'].includes(currentUser.role);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [section, setSection] = useState<DashSection>(canEdit ? 'overview' : 'compose');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compose article form state
  const [title, setTitle] = useState('');
  const [deck, setDeck] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Academic Notices');
  const [targetInstId, setTargetInstId] = useState(currentUser?.institutionId || institutions[0]?.id || 'inst-mak');
  const [campus, setCampus] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [programme, setProgramme] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0].url);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishMode, setPublishMode] = useState<'published' | 'scheduled' | 'draft'>('published');
  const [scheduledFor, setScheduledFor] = useState('');
  const [submittingArticle, setSubmittingArticle] = useState(false);

  // Sources form & sync state
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState<'rss' | 'atom' | 'json_feed' | 'official_api'>('rss');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcCategory, setSrcCategory] = useState('Academic Notices');
  const [srcRule, setSrcRule] = useState<'editorial_queue' | 'auto_publish'>('editorial_queue');
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [payloadTestSourceId, setPayloadTestSourceId] = useState<string | null>(null);
  const [rawFeedPayload, setRawFeedPayload] = useState(SAMPLE_RSS_XML);

  // Team management state
  const [teamUsers, setTeamUsers] = useState<UserAccount[]>([]);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('content_editor');
  const [staffInstId, setStaffInstId] = useState(currentUser?.institutionId || institutions[0]?.id || 'inst-mak');

  // Institution onboarding state
  const [instName, setInstName] = useState('');
  const [instShort, setInstShort] = useState('');
  const [instCity, setInstCity] = useState('');
  const [instCountry, setInstCountry] = useState('Uganda');
  const [instTagline, setInstTagline] = useState('');
  const [instWeb, setInstWeb] = useState('');
  const [instPlan, setInstPlan] = useState<SubscriptionPlanId>('institutional_standard');

  const activeInst = institutions.find((i) => i.id === targetInstId) || institutions[0];

  useEffect(() => {
    if (isAdmin && section === 'team') {
      fetchTeamUsers()
        .then((res) => setTeamUsers(res.users))
        .catch(() => {});
    }
  }, [isAdmin, section]);

  const tenantArticles = useMemo(() => {
    if (!currentUser) return [];
    return articles.filter((a) => isSuperAdmin || a.institutionId === currentUser.institutionId);
  }, [articles, currentUser, isSuperAdmin]);

  const pendingArticles = useMemo(
    () => tenantArticles.filter((a) => a.status === 'pending_review'),
    [tenantArticles]
  );

  const metrics = useMemo(() => {
    const published = tenantArticles.filter((a) => a.status === 'published');
    const totalReads = published.reduce((acc, a) => acc + a.viewsCount, 0);
    const totalShares = published.reduce((acc, a) => acc + a.sharesCount, 0);
    return {
      publishedCount: published.length,
      pendingCount: pendingArticles.length,
      sourcesCount: sources.length,
      totalReads,
      totalShares,
    };
  }, [tenantArticles, pendingArticles, sources]);

  if (!currentUser || !isStaff) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] text-center space-y-4">
        <ShieldCheck className="w-8 h-8 text-[#1E3A8A] dark:text-[#60A5FA] mx-auto" />
        <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Editorial & Institutional Administration Desk
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
          Sign in with a Campus Contributor, Content Editor, Institution Administrator, or Super Administrator account to publish verified notices, review submissions, and manage official RSS/API aggregation.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenSignIn}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors"
          >
            Sign In or Claim Admin Setup
          </button>
        </div>
      </div>
    );
  }

  function flash(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  }

  async function handlePublishSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmittingArticle(true);
    try {
      await createArticle({
        institutionId: isSuperAdmin ? targetInstId : currentUser?.institutionId,
        title,
        deck,
        body,
        category,
        campus: campus || activeInst?.campuses[0],
        faculty: faculty || activeInst?.faculties[0],
        department: department || activeInst?.departments[0],
        programme: programme || activeInst?.programmes[0],
        imageUrl,
        attachmentLabel: attachmentLabel || undefined,
        attachmentUrl: attachmentUrl || undefined,
        isUrgent,
        isFeatured,
        status: currentUser?.role === 'content_contributor' ? 'pending_review' : publishMode,
        scheduledFor: publishMode === 'scheduled' ? scheduledFor : undefined,
      });
      setTitle('');
      setDeck('');
      setBody('');
      setAttachmentLabel('');
      setAttachmentUrl('');
      setIsUrgent(false);
      setIsFeatured(false);
      await onRefreshData();
      flash(
        currentUser?.role === 'content_contributor'
          ? 'Story submitted to the institutional editorial queue for verification.'
          : 'Institutional dispatch saved and published.'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save article.');
    } finally {
      setSubmittingArticle(false);
    }
  }

  async function handleModerate(articleId: string, decision: 'published' | 'rejected') {
    setErrorMessage(null);
    try {
      await updateArticle(articleId, {
        status: decision,
        verificationTier: decision === 'published' ? 'verified_official' : undefined,
      });
      await onRefreshData();
      flash(decision === 'published' ? 'Article verified and published to live feed.' : 'Submission declined.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Moderation update failed.');
    }
  }

  async function handleCreateSource(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await createSource({
        institutionId: isSuperAdmin ? targetInstId : currentUser?.institutionId,
        name: srcName,
        sourceType: srcType,
        feedUrl: srcUrl,
        categoryDefault: srcCategory,
        publishingRule: srcRule,
      });
      setSrcName('');
      setSrcUrl('');
      await onRefreshData();
      flash('Authorized official source registered.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to add source.');
    }
  }

  async function handleSyncSource(sourceId: string, useRawPayload = false) {
    setErrorMessage(null);
    setSyncingSourceId(sourceId);
    try {
      const res = await syncSource(sourceId, useRawPayload ? rawFeedPayload : undefined);
      await onRefreshData();
      setPayloadTestSourceId(null);
      flash(
        `Source synchronized: ${res.importedCount} new item(s) collected, ${res.duplicatesSkipped} duplicate(s) skipped.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Source sync failed.');
    } finally {
      setSyncingSourceId(null);
    }
  }

  async function handleAddStaff(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await createStaffUser({
        fullName: staffName,
        email: staffEmail,
        password: staffPassword,
        role: staffRole,
        institutionId: isSuperAdmin ? staffInstId : currentUser!.institutionId,
      });
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      const team = await fetchTeamUsers();
      setTeamUsers(team.users);
      await onRefreshData();
      flash('Institutional staff account provisioned.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create staff user.');
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setErrorMessage(null);
    try {
      await updateUserRole(userId, role);
      const team = await fetchTeamUsers();
      setTeamUsers(team.users);
      await onRefreshData();
      flash('User role updated.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Role update failed.');
    }
  }

  async function handleOnboardInstitution(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await createInstitution({
        name: instName,
        shortName: instShort,
        city: instCity,
        country: instCountry,
        tagline: instTagline,
        websiteUrl: instWeb,
        planId: instPlan,
      });
      setInstName('');
      setInstShort('');
      setInstCity('');
      setInstTagline('');
      setInstWeb('');
      await onRefreshData();
      flash('New institution onboarded into multi-tenant directory.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Institution onboarding failed.');
    }
  }

  const navItems: Array<{ id: DashSection; label: string; icon: typeof LayoutDashboard; show: boolean }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: Boolean(canEdit) },
    { id: 'compose', label: currentUser.role === 'content_contributor' ? 'Submit Story' : 'Publish News', icon: FilePlus2, show: true },
    { id: 'queue', label: `Review Queue (${pendingArticles.length})`, icon: ShieldCheck, show: Boolean(canEdit) },
    { id: 'sources', label: 'Official Sources', icon: Rss, show: Boolean(canEdit) },
    { id: 'team', label: 'Team & Roles', icon: Users, show: Boolean(isAdmin) },
    { id: 'audit', label: 'Audit Trail', icon: History, show: Boolean(canEdit) },
    { id: 'institutions', label: 'Onboard Tenant', icon: Building2, show: Boolean(isSuperAdmin) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-3 space-y-4">
        <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#14171D]">
          <div className="text-xs font-data text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Signed In Role
          </div>
          <div className="mt-1 font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100">
            {currentUser.fullName}
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            {currentUser.role.replace(/_/g, ' ')} ·{' '}
            {institutions.find((i) => i.id === currentUser.institutionId)?.shortName}
          </div>
        </div>

        <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 text-left ${
                    active
                      ? 'bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>
      </aside>

      {/* Main Workspace */}
      <div className="lg:col-span-9 space-y-6">
        {statusMessage && (
          <div className="p-3.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-medium text-emerald-900 dark:text-emerald-200">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs font-medium text-red-900 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        {/* OVERVIEW */}
        {section === 'overview' && canEdit && (
          <div className="space-y-6">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Institutional Communication Metrics
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Scoped to {isSuperAdmin ? 'all member institutions' : institutions.find((i) => i.id === currentUser.institutionId)?.name}.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D]">
                <div className="text-xs text-stone-500 dark:text-stone-400">Published Dispatches</div>
                <div className="mt-1 font-data text-2xl font-semibold tabular-nums">{metrics.publishedCount}</div>
              </div>
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D]">
                <div className="text-xs text-stone-500 dark:text-stone-400">Pending Approval</div>
                <div className="mt-1 font-data text-2xl font-semibold tabular-nums">{metrics.pendingCount}</div>
              </div>
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D]">
                <div className="text-xs text-stone-500 dark:text-stone-400">Active Feeds</div>
                <div className="mt-1 font-data text-2xl font-semibold tabular-nums">{metrics.sourcesCount}</div>
              </div>
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D]">
                <div className="text-xs text-stone-500 dark:text-stone-400">Total Reads / Shares</div>
                <div className="mt-1 font-data text-2xl font-semibold tabular-nums">
                  {metrics.totalReads.toLocaleString()} / {metrics.totalShares.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300">
                Recent Published & Scheduled Dispatches
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Headline</th>
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-4 font-medium">Verification</th>
                      <th className="py-2.5 px-4 font-medium text-right">Reads</th>
                      <th className="py-2.5 px-4 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {tenantArticles.slice(0, 8).map((art) => (
                      <tr key={art.id} className="hover:bg-stone-100/60 dark:hover:bg-stone-800/40">
                        <td className="py-3 px-4 font-medium text-stone-900 dark:text-stone-100 max-w-xs truncate">
                          {art.title}
                        </td>
                        <td className="py-3 px-4 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                          {art.category}
                        </td>
                        <td className="py-3 px-4 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                          {verificationLabel(art.verificationTier)}
                        </td>
                        <td className="py-3 px-4 text-right font-data tabular-nums">
                          {art.viewsCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-data whitespace-nowrap">
                          {art.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COMPOSE / SUBMIT STORY */}
        {section === 'compose' && (
          <form
            onSubmit={handlePublishSubmit}
            className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] space-y-5"
          >
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                {currentUser.role === 'content_contributor'
                  ? 'Submit Story for Editorial Approval'
                  : 'Create & Publish Institutional Dispatch'}
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Target specific campuses, faculties, departments, or programmes with verifiable attribution.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Headline
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter clear, factual institutional headline"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Summary Deck
                </label>
                <input
                  type="text"
                  required
                  value={deck}
                  onChange={(e) => setDeck(e.target.value)}
                  placeholder="One-sentence sub-headline summarizing who is affected and key dates"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Institution
                  </label>
                  <select
                    value={targetInstId}
                    onChange={(e) => setTargetInstId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  >
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="Academic Notices">Academic Notices</option>
                  <option value="Research & Innovation">Research & Innovation</option>
                  <option value="Scholarships & Opportunities">Scholarships & Opportunities</option>
                  <option value="Campus Announcements">Campus Announcements</option>
                  <option value="Sports & Student Life">Sports & Student Life</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Target Campus
                </label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="All Campuses">All Campuses</option>
                  {(activeInst?.campuses || []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Target Faculty
                </label>
                <select
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="All Faculties">All Faculties</option>
                  {(activeInst?.faculties || []).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Department (Optional)
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="All Departments"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Programme (Optional)
                </label>
                <input
                  type="text"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  placeholder="All Programmes"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Editorial Photography
                </label>
                <select
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img.url} value={img.url}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Supporting Document Label (Optional)
                </label>
                <input
                  type="text"
                  value={attachmentLabel}
                  onChange={(e) => setAttachmentLabel(e.target.value)}
                  placeholder="e.g. Official Circular (PDF)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Supporting Document URL (Optional)
                </label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Full Story Body
              </label>
              <textarea
                rows={6}
                required
                minLength={20}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the full announcement with dates, venues, eligibility, and official contacts..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4 h-4 accent-[#9A3412]"
                  />
                  <span className="font-medium">Mark as Urgent Institutional Bulletin</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#1E3A8A]"
                  />
                  <span className="font-medium">Feature as Lead Front-Page Story</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-stone-500 dark:text-stone-400">Workflow:</span>
                  <select
                    value={publishMode}
                    onChange={(e) => setPublishMode(e.target.value as 'published' | 'scheduled' | 'draft')}
                    className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  >
                    <option value="published">Publish Immediately</option>
                    <option value="scheduled">Schedule Release</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>

                {publishMode === 'scheduled' && (
                  <input
                    type="datetime-local"
                    required
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  />
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingArticle}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors"
            >
              {submittingArticle
                ? 'Submitting...'
                : currentUser.role === 'content_contributor'
                  ? 'Submit for Editorial Review'
                  : publishMode === 'published'
                    ? 'Verify & Publish Dispatch'
                    : 'Save Dispatch'}
            </button>
          </form>
        )}

        {/* EDITORIAL REVIEW QUEUE */}
        {section === 'queue' && canEdit && (
          <div className="space-y-4">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Editorial Approval Queue
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Review contributor submissions and imported official-source drafts before public release.
              </p>
            </div>

            {pendingArticles.length === 0 ? (
              <div className="p-10 text-center rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#14171D]">
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  The editorial queue is clear. All submissions have been processed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl bg-white/80 dark:bg-[#14171D]">
                {pendingArticles.map((art) => (
                  <div key={art.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-semibold text-[#9A3412] dark:text-[#E07A5F]">
                          {verificationLabel(art.verificationTier)}
                        </span>
                        <span className="mx-2">·</span>
                        <span>{art.authorName}</span>
                        <span className="mx-2">·</span>
                        <span>{art.category}</span>
                      </div>
                      <h3 className="font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100">
                        {art.title}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">{art.deck}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleModerate(art.id, 'published')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#14532D] hover:bg-[#0F3F22] text-white dark:bg-emerald-500 dark:text-stone-950 transition-colors whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify & Publish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModerate(art.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OFFICIAL SOURCES & AGGREGATION */}
        {section === 'sources' && canEdit && (
          <div className="space-y-6">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Authorized Official Sources
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Collect updates from verified RSS, Atom, and JSON Feed endpoints with automatic deduplication and attribution preservation.
              </p>
            </div>

            {isAdmin && (
              <form
                onSubmit={handleCreateSource}
                className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-medium mb-1">Source Name</label>
                  <input
                    type="text"
                    required
                    value={srcName}
                    onChange={(e) => setSrcName(e.target.value)}
                    placeholder="e.g. Registrar Notice RSS"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Feed URL (HTTPS)</label>
                  <input
                    type="url"
                    required
                    value={srcUrl}
                    onChange={(e) => setSrcUrl(e.target.value)}
                    placeholder="https://news.university.ac.ug/feed/"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Format & Rule</label>
                  <div className="flex gap-2">
                    <select
                      value={srcType}
                      onChange={(e) => setSrcType(e.target.value as typeof srcType)}
                      className="flex-1 px-2 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                    >
                      <option value="rss">RSS</option>
                      <option value="atom">Atom</option>
                      <option value="json_feed">JSON Feed</option>
                    </select>
                    <select
                      value={srcRule}
                      onChange={(e) => setSrcRule(e.target.value as typeof srcRule)}
                      className="flex-1 px-2 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                    >
                      <option value="editorial_queue">Queue</option>
                      <option value="auto_publish">Auto-Publish</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950"
                >
                  Add Source
                </button>
              </form>
            )}

            <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl bg-white/80 dark:bg-[#14171D]">
              {sources.map((src) => (
                <div key={src.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-data">
                        {src.sourceType.toUpperCase()} · {src.publishingRule === 'auto_publish' ? 'Auto-Publish' : 'Editorial Queue'} ·{' '}
                        {src.itemsImportedCount} imported / {src.duplicatesSkippedCount} duplicates skipped
                      </div>
                      <h3 className="font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100">
                        {src.name}
                      </h3>
                      <div className="text-xs text-stone-500 dark:text-stone-400 break-all">{src.feedUrl}</div>
                      {src.lastSyncStatus && (
                        <div className="text-xs text-stone-600 dark:text-stone-300 pt-0.5">
                          {src.lastSyncStatus}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={syncingSourceId === src.id}
                        onClick={() => handleSyncSource(src.id, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950 disabled:opacity-60 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingSourceId === src.id ? 'animate-spin' : ''}`} />
                        <span>Sync Live Feed</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPayloadTestSourceId(payloadTestSourceId === src.id ? null : src.id)
                        }
                        className="px-3 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap"
                      >
                        Ingest Feed XML/JSON
                      </button>
                    </div>
                  </div>

                  {payloadTestSourceId === src.id && (
                    <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                        Paste Official RSS 2.0, Atom, or JSON Feed Payload to parse & deduplicate:
                      </label>
                      <textarea
                        rows={6}
                        value={rawFeedPayload}
                        onChange={(e) => setRawFeedPayload(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-data rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSyncSource(src.id, true)}
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#14532D] text-white dark:bg-emerald-500 dark:text-stone-950"
                        >
                          Run Parser & Deduplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayloadTestSourceId(null)}
                          className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM & ROLES */}
        {section === 'team' && isAdmin && (
          <div className="space-y-6">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Institutional Team & Contributors
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Provision and manage editors, contributors, and administrators with strict institutional data isolation.
              </p>
            </div>

            <form
              onSubmit={handleAddStaff}
              className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="content_editor">Content Editor</option>
                  <option value="content_contributor">Content Contributor</option>
                  <option value="institution_admin">Institution Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950"
              >
                Provision Staff
              </button>
            </form>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Name</th>
                    <th className="py-2.5 px-4 font-medium">Email</th>
                    <th className="py-2.5 px-4 font-medium">Institution</th>
                    <th className="py-2.5 px-4 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {teamUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-medium">{u.fullName}</td>
                      <td className="py-3 px-4 text-stone-600 dark:text-stone-400">{u.email}</td>
                      <td className="py-3 px-4">
                        {institutions.find((i) => i.id === u.institutionId)?.shortName}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          disabled={u.id === currentUser.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="px-2 py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                        >
                          {isSuperAdmin && <option value="super_admin">super_admin</option>}
                          <option value="institution_admin">institution_admin</option>
                          <option value="content_editor">content_editor</option>
                          <option value="content_contributor">content_contributor</option>
                          <option value="registered_user">registered_user</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT TRAIL */}
        {section === 'audit' && canEdit && (
          <div className="space-y-4">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Publishing History & Audit Trail
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Chronological ledger of editorial approvals, urgent notices, source synchronizations, and governance actions.
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] overflow-hidden">
              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-medium text-stone-900 dark:text-stone-100">{log.summary}</div>
                      <div className="text-stone-500 dark:text-stone-400">
                        {log.actorName} ({log.actorRole}) · {log.action}
                      </div>
                    </div>
                    <div className="font-data text-stone-500 dark:text-stone-400 shrink-0 tabular-nums">
                      {formatDateTime(log.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUPER ADMIN TENANT ONBOARDING */}
        {section === 'institutions' && isSuperAdmin && (
          <form
            onSubmit={handleOnboardInstitution}
            className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] space-y-4"
          >
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Onboard New Institution
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Provision an isolated multi-tenant university or organizational news channel across Uganda and East Africa.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Full Institution Name</label>
                <input
                  type="text"
                  required
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  placeholder="e.g. Gulu University"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Short Name / Acronym</label>
                <input
                  type="text"
                  required
                  value={instShort}
                  onChange={(e) => setInstShort(e.target.value)}
                  placeholder="e.g. Gulu"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">City</label>
                <input
                  type="text"
                  required
                  value={instCity}
                  onChange={(e) => setInstCity(e.target.value)}
                  placeholder="e.g. Gulu"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Country</label>
                <input
                  type="text"
                  required
                  value={instCountry}
                  onChange={(e) => setInstCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Official Website</label>
                <input
                  type="url"
                  value={instWeb}
                  onChange={(e) => setInstWeb(e.target.value)}
                  placeholder="https://gu.ac.ug"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Subscription Tier</label>
                <select
                  value={instPlan}
                  onChange={(e) => setInstPlan(e.target.value as SubscriptionPlanId)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="institutional_standard">Institution Standard</option>
                  <option value="multi_campus_enterprise">Multi-Campus Enterprise</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Institutional Tagline</label>
                <input
                  type="text"
                  value={instTagline}
                  onChange={(e) => setInstTagline(e.target.value)}
                  placeholder="For Community Transformation"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950"
            >
              Provision Institution Channel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
