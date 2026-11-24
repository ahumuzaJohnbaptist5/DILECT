import { useState, type FormEvent } from 'react';
import { Building2, Check, ExternalLink, SlidersHorizontal } from 'lucide-react';
import type { Institution, NewsArticle, UserAccount, UserPreferences } from '../types';
import { safeExternalHref, updateUserPreferences } from '../lib/api';

interface InstitutionsViewProps {
  institutions: Institution[];
  articles: NewsArticle[];
  currentUser: UserAccount | null;
  preferences: UserPreferences;
  onSelectInstitutionFilter: (instId: string) => void;
  onPreferencesUpdated: (prefs: UserPreferences) => void;
}

const TOPIC_OPTIONS = [
  'Academic Notices',
  'Research & Innovation',
  'Scholarships & Opportunities',
  'Campus Announcements',
  'Sports & Student Life',
];

export function InstitutionsView({
  institutions,
  articles,
  currentUser,
  preferences,
  onSelectInstitutionFilter,
  onPreferencesUpdated,
}: InstitutionsViewProps) {
  const [draft, setDraft] = useState<UserPreferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInst = institutions.find((i) => i.id === draft.institutionId) || institutions[0];

  function handleInstitutionChange(instId: string) {
    const inst = institutions.find((i) => i.id === instId);
    setDraft((prev) => ({
      ...prev,
      institutionId: instId,
      campus: inst?.campuses[0] || '',
      faculty: inst?.faculties[0] || '',
      department: inst?.departments[0] || '',
      programme: inst?.programmes[0] || '',
    }));
  }

  function toggleInterest(topic: string) {
    setDraft((prev) => ({
      ...prev,
      interests: prev.interests.includes(topic)
        ? prev.interests.filter((t) => t !== topic)
        : [...prev.interests, topic],
    }));
  }

  async function handleSavePreferences(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (currentUser) {
        const res = await updateUserPreferences(draft);
        onPreferencesUpdated(res.user.preferences);
      } else {
        onPreferencesUpdated(draft);
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save preferences.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* Multi-Tenant Institutional Directory */}
      <div className="lg:col-span-7 space-y-6">
        <div className="border-b border-stone-200 dark:border-stone-800 pb-5">
          <h1 className="font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-50 headline-balance">
            Member Institutions & Channels
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Each university or organization operates an isolated multi-tenant newsroom with verified editors, campuses, and official feeds.
          </p>
        </div>

        <div className="divide-y divide-stone-200 dark:divide-stone-800 border-b border-stone-200 dark:border-stone-800">
          {institutions.map((inst) => {
            const storyCount = articles.filter(
              (a) => a.institutionId === inst.id && a.status === 'published'
            ).length;
            const websiteHref = safeExternalHref(inst.websiteUrl);
            return (
              <div key={inst.id} className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-data">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>
                      {inst.city}, {inst.country}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{inst.campuses.length} campuses</span>
                    <span aria-hidden="true">·</span>
                    <span>{storyCount} published dispatches</span>
                  </div>
                  <h2 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {inst.name}
                  </h2>
                  <p className="text-sm italic text-stone-600 dark:text-stone-400">{inst.tagline}</p>
                  <div className="text-xs text-stone-600 dark:text-stone-400 pt-1">
                    Faculties: {inst.faculties.slice(0, 3).join(' · ')}
                    {inst.faculties.length > 3 ? ` +${inst.faculties.length - 3} more` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {websiteHref && (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                    >
                      <span>Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectInstitutionFilter(inst.id)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors whitespace-nowrap"
                  >
                    Open Channel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personalization & Smart Notification Preferences */}
      <div className="lg:col-span-5">
        <form
          onSubmit={handleSavePreferences}
          className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] space-y-5"
        >
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-stone-900 dark:text-stone-100">
                Personalize Your Feed
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {currentUser
                  ? `Synced to ${currentUser.email}`
                  : 'Active for this session · Sign in to sync across devices'}
              </p>
            </div>
            <SlidersHorizontal className="w-4 h-4 text-stone-500" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Institution
              </label>
              <select
                value={draft.institutionId}
                onChange={(e) => handleInstitutionChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Campus
                </label>
                <select
                  value={draft.campus}
                  onChange={(e) => setDraft({ ...draft, campus: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {(selectedInst?.campuses || []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Faculty / School
                </label>
                <select
                  value={draft.faculty}
                  onChange={(e) => setDraft({ ...draft, faculty: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {(selectedInst?.faculties || []).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Department
                </label>
                <select
                  value={draft.department}
                  onChange={(e) => setDraft({ ...draft, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {(selectedInst?.departments || []).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Programme
                </label>
                <select
                  value={draft.programme}
                  onChange={(e) => setDraft({ ...draft, programme: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {(selectedInst?.programmes || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
              Topic Interests
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((topic) => {
                const active = draft.interests.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleInterest(topic)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-stone-950'
                        : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-stone-800">
            <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Notification Channels
            </div>
            <label className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 cursor-pointer py-1">
              <span>Web Push Urgent Bulletins</span>
              <input
                type="checkbox"
                checked={draft.webPushEnabled}
                onChange={(e) => setDraft({ ...draft, webPushEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#1E3A8A]"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 cursor-pointer py-1">
              <span>Daily Institutional Email Digest</span>
              <input
                type="checkbox"
                checked={draft.emailDigestEnabled}
                onChange={(e) => setDraft({ ...draft, emailDigestEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#1E3A8A]"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 cursor-pointer py-1">
              <span>Academic Deadline Reminders</span>
              <input
                type="checkbox"
                checked={draft.deadlineReminders}
                onChange={(e) => setDraft({ ...draft, deadlineReminders: e.target.checked })}
                className="w-4 h-4 accent-[#1E3A8A]"
              />
            </label>
          </div>

          {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors"
          >
            {savedToast ? <Check className="w-4 h-4" /> : null}
            <span>{saving ? 'Saving...' : savedToast ? 'Preferences Saved' : 'Save Personalization'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
