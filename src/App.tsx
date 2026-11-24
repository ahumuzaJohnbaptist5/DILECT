import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import type {
  AuditLogEntry,
  AuthorizedSource,
  InstitutionalEvent,
  Institution,
  NewsArticle,
  NotificationItem,
  SubscriptionPlan,
  UserAccount,
  UserPreferences,
} from './types';
import {
  fetchBootstrap,
  formatShortDate,
  recordArticleView,
  setAuthToken,
  toggleBookmark as apiToggleBookmark,
  toggleEventReminder as apiToggleEventReminder,
} from './lib/api';
import { NewsroomView } from './components/NewsroomView';
import { CalendarView } from './components/CalendarView';
import { InstitutionsView } from './components/InstitutionsView';
import { EditorialDashboard } from './components/EditorialDashboard';
import { PlansView } from './components/PlansView';
import { ArticleModal } from './components/ArticleModal';
import { AuthModal } from './components/AuthModal';

type AppTab = 'newsroom' | 'calendar' | 'institutions' | 'editorial' | 'plans';

const DEFAULT_PREFS: UserPreferences = {
  institutionId: 'inst-mak',
  campus: 'Main Campus (Makerere Hill)',
  faculty: 'College of Computing and Information Sciences',
  department: 'Computer Science',
  programme: 'BSc Software Engineering',
  interests: ['Academic Notices', 'Research & Innovation', 'Scholarships & Opportunities'],
  webPushEnabled: true,
  emailDigestEnabled: true,
  urgentAlertsOnly: false,
  deadlineReminders: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('newsroom');
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [events, setEvents] = useState<InstitutionalEvent[]>([]);
  const [sources, setSources] = useState<AuthorizedSource[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [visitorPrefs, setVisitorPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [visitorBookmarks, setVisitorBookmarks] = useState<string[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('all');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchBootstrap();
      setInstitutions(data.institutions);
      setArticles(data.articles);
      setEvents(data.events);
      setSources(data.sources);
      setAuditLogs(data.auditLogs);
      setNotifications(data.notifications);
      setPlans(data.plans);
      setCurrentUser(data.currentUser);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to DILECT server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, 60_000);
    return () => clearInterval(poll);
  }, [loadData]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const activePreferences = currentUser?.preferences || visitorPrefs;
  const activeBookmarks = currentUser?.bookmarks || visitorBookmarks;

  const activeArticle = useMemo(
    () => articles.find((a) => a.id === activeArticleId) || null,
    [articles, activeArticleId]
  );

  async function handleOpenArticle(article: NewsArticle) {
    setActiveArticleId(article.id);
    try {
      const res = await recordArticleView(article.id);
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, viewsCount: res.viewsCount } : a))
      );
    } catch {
      // Non-blocking view counter
    }
  }

  async function handleToggleBookmark(articleId: string) {
    if (currentUser) {
      try {
        const res = await apiToggleBookmark(articleId);
        setCurrentUser({ ...currentUser, bookmarks: res.bookmarks });
      } catch {
        // Ignore transient failure
      }
      return;
    }
    setVisitorBookmarks((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  }

  async function handleToggleReminder(eventId: string) {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await apiToggleEventReminder(eventId);
      setCurrentUser({ ...currentUser, eventReminders: res.eventReminders });
    } catch {
      // Ignore transient failure
    }
  }

  function handleSignOut() {
    setAuthToken(null);
    setCurrentUser(null);
    loadData();
  }

  const editionDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const navLinks: Array<{ id: AppTab; label: string }> = [
    { id: 'newsroom', label: 'Newsroom' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'institutions', label: 'Institutions' },
    { id: 'editorial', label: 'Editorial' },
    { id: 'plans', label: 'Plans' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#0F1115] text-[#1C1917] dark:text-[#F3F1EC] transition-colors">
      {/* Strict 3-Zone Top Bar */}
      <header className="border-b border-stone-200 dark:border-stone-800 bg-[#FBF9F5] dark:bg-[#0F1115]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('newsroom')}
            className="font-editorial text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 whitespace-nowrap shrink-0"
          >
            DILECT
          </button>

          {/* Zone 2: 5 Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navLinks.map((link) => {
              const active = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveTab(link.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#9A3412] dark:border-[#E07A5F] text-stone-900 dark:text-stone-50 font-semibold'
                      : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
                title={`Signed in as ${currentUser.fullName} (${currentUser.role})`}
              >
                <span className="max-w-[140px] truncate">{currentUser.fullName}</span>
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-stone-300 dark:border-stone-700"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 dark:border-stone-800 px-4 py-3 flex flex-wrap gap-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  setActiveTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === link.id
                    ? 'bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Edition & Workspace Utility Ribbon (Below Header) */}
      <div className="border-b border-stone-200 dark:border-stone-800 bg-[#F4F0E8]/70 dark:bg-[#14171D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-stone-600 dark:text-stone-400">
            <span className="font-data">{editionDate}</span>
            <span className="mx-2 hidden sm:inline" aria-hidden="true">·</span>
            <span className="hidden sm:inline italic font-editorial">
              Your Institution. Your Information. Your Connection.
            </span>
          </div>

          <div className="flex items-center gap-3 relative">
            <select
              aria-label="Filter by member institution"
              value={selectedInstitutionId}
              onChange={(e) => setSelectedInstitutionId(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200"
            >
              <option value="all">All Institutions</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.shortName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAlertsOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
              aria-label="Open institutional alerts"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="font-data tabular-nums">{notifications.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            {alertsOpen && (
              <div className="absolute right-0 top-10 z-40 w-80 sm:w-96 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FBF9F5] dark:bg-[#14171D] shadow-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                  <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                    Recent Alerts & Deadlines
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(false)}
                    className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  >
                    Close
                  </button>
                </div>
                <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="text-[11px] font-semibold text-[#9A3412] dark:text-[#E07A5F]">
                        {n.title}
                      </div>
                      <div className="text-xs text-stone-800 dark:text-stone-200 leading-snug">
                        {n.summary}
                      </div>
                      <div className="text-[11px] font-data text-stone-500 dark:text-stone-400">
                        {formatShortDate(n.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-80 rounded-xl bg-stone-200 dark:bg-stone-800" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 rounded-xl bg-stone-200 dark:bg-stone-800" />
              <div className="h-64 rounded-xl bg-stone-200 dark:bg-stone-800" />
              <div className="h-64 rounded-xl bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
        ) : loadError ? (
          <div className="p-8 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-center space-y-3">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'newsroom' && (
              <NewsroomView
                articles={articles}
                institutions={institutions}
                events={events}
                selectedInstitutionId={selectedInstitutionId}
                preferences={activePreferences}
                bookmarks={activeBookmarks}
                onOpenArticle={handleOpenArticle}
                onToggleBookmark={handleToggleBookmark}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                events={events}
                institutions={institutions}
                selectedInstitutionId={selectedInstitutionId}
                currentUser={currentUser}
                onToggleReminder={handleToggleReminder}
                onEventCreated={(evt) => setEvents((prev) => [evt, ...prev])}
              />
            )}

            {activeTab === 'institutions' && (
              <InstitutionsView
                institutions={institutions}
                articles={articles}
                currentUser={currentUser}
                preferences={activePreferences}
                onSelectInstitutionFilter={(instId) => {
                  setSelectedInstitutionId(instId);
                  setActiveTab('newsroom');
                }}
                onPreferencesUpdated={(prefs) => {
                  if (currentUser) {
                    setCurrentUser({ ...currentUser, preferences: prefs });
                  } else {
                    setVisitorPrefs(prefs);
                  }
                }}
              />
            )}

            {activeTab === 'editorial' && (
              <EditorialDashboard
                currentUser={currentUser}
                institutions={institutions}
                articles={articles}
                sources={sources}
                auditLogs={auditLogs}
                onOpenSignIn={() => setAuthModalOpen(true)}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'plans' && (
              <PlansView
                plans={plans}
                institutions={institutions}
                currentUser={currentUser}
                onPlanUpdated={loadData}
                onOpenSignIn={() => setAuthModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Broadsheet Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          <div>
            <span className="font-editorial text-sm font-semibold text-stone-800 dark:text-stone-200 mr-2">
              DILECT
            </span>
            <span>Your Institution. Your Information. Your Connection.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => setActiveTab('newsroom')} className="hover:underline">
              Newsroom
            </button>
            <button type="button" onClick={() => setActiveTab('calendar')} className="hover:underline">
              Events Calendar
            </button>
            <button type="button" onClick={() => setActiveTab('institutions')} className="hover:underline">
              Institutions
            </button>
            <button type="button" onClick={() => setActiveTab('plans')} className="hover:underline">
              Institutional Plans
            </button>
          </div>
        </div>
      </footer>

      {activeArticle && (
        <ArticleModal
          article={activeArticle}
          institution={institutions.find((i) => i.id === activeArticle.institutionId)}
          isBookmarked={activeBookmarks.includes(activeArticle.id)}
          onToggleBookmark={handleToggleBookmark}
          onShared={(articleId, sharesCount) =>
            setArticles((prev) =>
              prev.map((a) => (a.id === articleId ? { ...a, sharesCount } : a))
            )
          }
          onClose={() => setActiveArticleId(null)}
        />
      )}

      {authModalOpen && (
        <AuthModal
          institutions={institutions}
          onAuthenticated={(user) => {
            setCurrentUser(user);
            loadData();
          }}
          onClose={() => setAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
