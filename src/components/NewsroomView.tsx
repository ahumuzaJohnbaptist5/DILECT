import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, FileText, Search, ShieldCheck, TrendingUp } from 'lucide-react';
import type { InstitutionalEvent, Institution, NewsArticle, UserPreferences } from '../types';
import { formatShortDate, verificationLabel } from '../lib/api';

interface NewsroomViewProps {
  articles: NewsArticle[];
  institutions: Institution[];
  events: InstitutionalEvent[];
  selectedInstitutionId: string;
  preferences: UserPreferences;
  bookmarks: string[];
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (articleId: string) => void;
  onNavigateTab: (tab: 'calendar' | 'institutions') => void;
}

const CATEGORIES = [
  'All',
  'Academic Notices',
  'Research & Innovation',
  'Scholarships & Opportunities',
  'Campus Announcements',
  'Sports & Student Life',
];

function EditorialImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-stone-200 to-stone-100 dark:from-stone-800 dark:to-stone-900 flex flex-col items-center justify-center p-4 text-center`}
      >
        <FileText className="w-6 h-6 text-stone-500 mb-1.5" />
        <span className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function NewsroomView({
  articles,
  institutions,
  events,
  selectedInstitutionId,
  preferences,
  bookmarks,
  onOpenArticle,
  onToggleBookmark,
  onNavigateTab,
}: NewsroomViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified_official' | 'imported_official'>('all');
  const [feedScope, setFeedScope] = useState<'all' | 'personalized' | 'saved'>('all');

  const instMap = useMemo(() => {
    const map = new Map<string, Institution>();
    for (const i of institutions) map.set(i.id, i);
    return map;
  }, [institutions]);

  const publishedArticles = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'published')
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [articles]
  );

  const urgentBulletins = useMemo(
    () =>
      publishedArticles.filter(
        (a) =>
          a.isUrgent &&
          (selectedInstitutionId === 'all' || a.institutionId === selectedInstitutionId)
      ),
    [publishedArticles, selectedInstitutionId]
  );

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publishedArticles.filter((a) => {
      if (selectedInstitutionId !== 'all' && a.institutionId !== selectedInstitutionId) return false;
      if (activeCategory !== 'All' && a.category !== activeCategory) return false;
      if (verificationFilter !== 'all' && a.verificationTier !== verificationFilter) return false;
      if (feedScope === 'saved' && !bookmarks.includes(a.id)) return false;
      if (feedScope === 'personalized') {
        const matchesInst = !preferences.institutionId || a.institutionId === preferences.institutionId;
        const matchesCampus = !preferences.campus || a.campus === preferences.campus || a.campus === 'All Campuses';
        const matchesFaculty = !preferences.faculty || a.faculty === preferences.faculty || a.faculty === 'All Faculties';
        const matchesInterest =
          preferences.interests.length === 0 || preferences.interests.includes(a.category);
        if (!(matchesInst && (matchesCampus || matchesFaculty || matchesInterest))) return false;
      }
      if (q) {
        const instName = instMap.get(a.institutionId)?.name.toLowerCase() || '';
        const haystack = `${a.title} ${a.deck} ${a.body} ${a.category} ${a.campus} ${a.faculty} ${instName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    publishedArticles,
    selectedInstitutionId,
    activeCategory,
    verificationFilter,
    feedScope,
    bookmarks,
    preferences,
    searchQuery,
    instMap,
  ]);

  const leadArticle =
    filteredArticles.find((a) => a.isFeatured) || filteredArticles[0] || null;

  const secondaryArticles = useMemo(
    () => filteredArticles.filter((a) => a.id !== leadArticle?.id).slice(0, 3),
    [filteredArticles, leadArticle]
  );

  const dispatchArticles = useMemo(
    () => filteredArticles.filter((a) => a.id !== leadArticle?.id).slice(3),
    [filteredArticles, leadArticle]
  );

  const trendingStories = useMemo(
    () =>
      [...publishedArticles]
        .sort((a, b) => b.viewsCount + b.sharesCount * 3 - (a.viewsCount + a.sharesCount * 3))
        .slice(0, 4),
    [publishedArticles]
  );

  const upcomingDeadlines = useMemo(
    () =>
      [...events]
        .filter((e) => selectedInstitutionId === 'all' || e.institutionId === selectedInstitutionId)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 4),
    [events, selectedInstitutionId]
  );

  return (
    <div className="space-y-10">
      {/* Urgent Institutional Bulletins */}
      {urgentBulletins.length > 0 && (
        <section
          aria-label="Urgent institutional bulletins"
          className="rounded-xl border border-[#9A3412]/30 dark:border-[#E07A5F]/40 bg-[#F4F0E8] dark:bg-[#191D25] px-5 py-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#9A3412] dark:text-[#E07A5F]">
                Urgent Institutional Bulletin
              </div>
              <button
                type="button"
                onClick={() => onOpenArticle(urgentBulletins[0])}
                className="text-left font-editorial text-lg sm:text-xl font-semibold text-stone-900 dark:text-stone-100 hover:underline headline-balance"
              >
                {urgentBulletins[0].title}
              </button>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                <span>{instMap.get(urgentBulletins[0].institutionId)?.name}</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>{urgentBulletins[0].campus}</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span className="font-data">{formatShortDate(urgentBulletins[0].publishedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {urgentBulletins.length > 1 && (
                <button
                  type="button"
                  onClick={() => onOpenArticle(urgentBulletins[1])}
                  className="text-xs font-medium text-stone-700 dark:text-stone-300 hover:underline whitespace-nowrap"
                >
                  + {urgentBulletins.length - 1} more urgent notice
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenArticle(urgentBulletins[0])}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#9A3412] hover:bg-[#7C2D12] text-white dark:bg-[#E07A5F] dark:hover:bg-[#D1664B] dark:text-stone-950 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Read Notice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Search, Feed Scope & Category Filter Bar */}
      <section className="space-y-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements, faculties, scholarships, campuses..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14171D] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-200/70 dark:bg-stone-800/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFeedScope('all')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  feedScope === 'all'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                All News
              </button>
              <button
                type="button"
                onClick={() => setFeedScope('personalized')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  feedScope === 'personalized'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                For Your Campus
              </button>
              <button
                type="button"
                onClick={() => setFeedScope('saved')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  feedScope === 'saved'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Saved ({bookmarks.length})
              </button>
            </div>

            <select
              aria-label="Filter by verification tier"
              value={verificationFilter}
              onChange={(e) =>
                setVerificationFilter(e.target.value as 'all' | 'verified_official' | 'imported_official')
              }
              className="px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14171D] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            >
              <option value="all">All Verification Tiers</option>
              <option value="verified_official">Verified Official Only</option>
              <option value="imported_official">Imported Official Feeds</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeCategory === category
                  ? 'bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/70'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Empty State */}
      {filteredArticles.length === 0 ? (
        <div className="py-16 text-center border border-stone-200 dark:border-stone-800 rounded-xl bg-white/50 dark:bg-[#14171D]">
          <h3 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
            No matching institutional dispatches
          </h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Try clearing your search filter, switching back to All News, or updating your campus personalization profile.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
                setVerificationFilter('all');
                setFeedScope('all');
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('institutions')}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-stone-300 dark:border-stone-700"
            >
              Update Campus Profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tier 1: Lead Story */}
          {leadArticle && (
            <section aria-label="Lead story" className="border-b border-stone-200 dark:border-stone-800 pb-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-7 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
                  <EditorialImage
                    src={leadArticle.imageUrl}
                    alt={leadArticle.title}
                    className="w-full h-72 sm:h-96 lg:h-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                  />
                </div>
                <div className="lg:col-span-5 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-400 mb-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#14532D] dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {verificationLabel(leadArticle.verificationTier)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{instMap.get(leadArticle.institutionId)?.shortName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{leadArticle.category}</span>
                    </div>

                    <h1
                      onClick={() => onOpenArticle(leadArticle)}
                      className="font-editorial text-3xl sm:text-4xl font-semibold leading-[1.15] text-stone-900 dark:text-stone-50 hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer transition-colors headline-balance"
                    >
                      {leadArticle.title}
                    </h1>

                    <p className="mt-4 text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                      {leadArticle.deck}
                    </p>
                  </div>

                  <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-800 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-data">
                      <span>{leadArticle.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatShortDate(leadArticle.publishedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{leadArticle.readTimeMinutes} min read</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(leadArticle)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors whitespace-nowrap"
                      >
                        <span>Read Full Story</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(leadArticle.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{bookmarks.includes(leadArticle.id) ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tier 2: Secondary Features */}
          {secondaryArticles.length > 0 && (
            <section aria-label="Featured dispatches" className="border-b border-stone-200 dark:border-stone-800 pb-10">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  Latest Institutional Reports
                </h2>
                <span className="text-xs font-data text-stone-500 dark:text-stone-400">
                  {filteredArticles.length} active stories
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {secondaryArticles.map((article) => {
                  const inst = instMap.get(article.institutionId);
                  const saved = bookmarks.includes(article.id);
                  return (
                    <article key={article.id} className="flex flex-col justify-between group">
                      <div>
                        <div
                          onClick={() => onOpenArticle(article)}
                          className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800 cursor-pointer mb-4"
                        >
                          <EditorialImage
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-full aspect-4/3 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mb-2">
                          <span className="font-medium text-[#9A3412] dark:text-[#E07A5F]">
                            {verificationLabel(article.verificationTier)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{inst?.shortName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{article.category}</span>
                        </div>
                        <h3
                          onClick={() => onOpenArticle(article)}
                          className="font-editorial text-xl font-semibold leading-snug text-stone-900 dark:text-stone-100 group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] cursor-pointer transition-colors headline-balance"
                        >
                          {article.title}
                        </h3>
                        <p className="mt-2.5 text-sm text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed">
                          {article.deck}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-data">
                        <span>
                          {formatShortDate(article.publishedAt)} · {article.readTimeMinutes}m
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleBookmark(article.id)}
                          className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                          aria-label={saved ? 'Remove bookmark' : 'Save article'}
                        >
                          {saved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tier 3: Department Dispatch + Trending & Deadlines Side Rail */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8">
              <h2 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-5">
                Campus & Faculty Archive
              </h2>
              {dispatchArticles.length === 0 ? (
                <p className="text-sm text-stone-600 dark:text-stone-400 py-6 border-t border-stone-200 dark:border-stone-800">
                  All matching stories are featured in the lead broadsheet above.
                </p>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800 border-t border-stone-200 dark:border-stone-800">
                  {dispatchArticles.map((article) => {
                    const inst = instMap.get(article.institutionId);
                    return (
                      <article
                        key={article.id}
                        className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className="font-medium text-stone-800 dark:text-stone-200">
                              {verificationLabel(article.verificationTier)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{inst?.shortName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{article.faculty}</span>
                          </div>
                          <h3
                            onClick={() => onOpenArticle(article)}
                            className="font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100 hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer transition-colors"
                          >
                            {article.title}
                          </h3>
                          <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                            {article.deck}
                          </p>
                          <div className="text-xs text-stone-500 dark:text-stone-400 font-data pt-1">
                            <span>{article.sourceName}</span>
                            <span className="mx-2" aria-hidden="true">·</span>
                            <span>{formatShortDate(article.publishedAt)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenArticle(article)}
                          className="self-start sm:self-center px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          Read Dispatch
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="lg:col-span-4 space-y-8">
              {/* Trending Institutional Stories */}
              <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#14171D]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100">
                    Trending Across Campuses
                  </h3>
                  <TrendingUp className="w-4 h-4 text-stone-500" />
                </div>
                <ol className="divide-y divide-stone-200 dark:divide-stone-800">
                  {trendingStories.map((story, idx) => (
                    <li key={story.id} className="py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(story)}
                        className="w-full text-left group flex items-start gap-3"
                      >
                        <span className="font-data text-xs font-semibold text-stone-400 pt-0.5 tabular-nums">
                          0{idx + 1}
                        </span>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors leading-snug">
                            {story.title}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 font-data tabular-nums">
                            {instMap.get(story.institutionId)?.shortName} · {story.viewsCount.toLocaleString()} reads
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Upcoming Deadlines & Events */}
              <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#14171D]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-editorial text-lg font-semibold text-stone-900 dark:text-stone-100">
                    Upcoming Deadlines
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('calendar')}
                    className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                  >
                    Full Calendar
                  </button>
                </div>
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {upcomingDeadlines.map((evt) => (
                    <div key={evt.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-data">
                        {formatShortDate(evt.startsAt)} · {evt.category}
                      </div>
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-snug">
                        {evt.title}
                      </div>
                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        {instMap.get(evt.institutionId)?.shortName} · {evt.venue}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
