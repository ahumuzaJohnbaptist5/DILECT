import { useMemo, useState, type FormEvent } from 'react';
import { Bell, Calendar as CalendarIcon, ExternalLink, MapPin, Plus } from 'lucide-react';
import type { InstitutionalEvent, Institution, UserAccount } from '../types';
import { createEvent, formatDateTime, safeExternalHref } from '../lib/api';

interface CalendarViewProps {
  events: InstitutionalEvent[];
  institutions: Institution[];
  selectedInstitutionId: string;
  currentUser: UserAccount | null;
  onToggleReminder: (eventId: string) => void;
  onEventCreated: (evt: InstitutionalEvent) => void;
}

const EVENT_CATEGORIES: Array<'All' | InstitutionalEvent['category']> = [
  'All',
  'Academic',
  'Deadline',
  'Conference',
  'Workshop',
  'Ceremony',
  'Sports',
];

export function CalendarView({
  events,
  institutions,
  selectedInstitutionId,
  currentUser,
  onToggleReminder,
  onEventCreated,
}: CalendarViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'All' | InstitutionalEvent['category']>('All');
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<InstitutionalEvent['category']>('Academic');
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || 'inst-mak');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState('2026-12-02T09:00');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    currentUser && ['super_admin', 'institution_admin', 'content_editor'].includes(currentUser.role);

  const instMap = useMemo(() => {
    const map = new Map<string, Institution>();
    for (const i of institutions) map.set(i.id, i);
    return map;
  }, [institutions]);

  const filteredEvents = useMemo(
    () =>
      events
        .filter((e) => {
          if (selectedInstitutionId !== 'all' && e.institutionId !== selectedInstitutionId) return false;
          if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
          return true;
        })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [events, selectedInstitutionId, categoryFilter]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const targetInst = currentUser?.role === 'super_admin' ? institutionId : currentUser?.institutionId;
      const res = await createEvent({
        title,
        description,
        category,
        institutionId: targetInst,
        venue,
        startsAt,
        registrationUrl: registrationUrl || undefined,
      });
      onEventCreated(res.event);
      setTitle('');
      setDescription('');
      setVenue('');
      setRegistrationUrl('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-50 headline-balance">
            Institutional Events & Academic Deadlines
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Verified university conferences, registration windows, workshops, convocation ceremonies, and athletics fixtures.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Close Form' : 'Schedule Event'}</span>
          </button>
        )}
      </div>

      {showCreate && canCreate && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D] space-y-4"
        >
          <h2 className="font-editorial text-xl font-semibold">Publish Verified Calendar Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Event Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Faculty of Computing Innovation Expo"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Venue</label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Yusuf Lule Central Teaching Facility"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InstitutionalEvent['category'])}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                {EVENT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>
            {currentUser?.role === 'super_admin' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Institution</label>
                <select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
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
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Registration URL (optional)
              </label>
              <input
                type="url"
                value={registrationUrl}
                onChange={(e) => setRegistrationUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Description</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
            />
          </div>
          {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950"
          >
            {saving ? 'Scheduling...' : 'Publish to Calendar'}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat
                ? 'bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-stone-950'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-14 text-center border border-stone-200 dark:border-stone-800 rounded-xl">
          <p className="text-sm text-stone-600 dark:text-stone-400">No upcoming events match this filter.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800">
          {filteredEvents.map((evt) => {
            const inst = instMap.get(evt.institutionId);
            const hasReminder = currentUser?.eventReminders.includes(evt.id) || false;
            const regHref = safeExternalHref(evt.registrationUrl);
            const dt = new Date(evt.startsAt);
            const monthLabel = dt.toLocaleDateString('en-US', { month: 'short' });
            const dayNum = dt.toLocaleDateString('en-US', { day: '2-digit' });

            return (
              <div
                key={evt.id}
                className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-5">
                  <div className="w-16 shrink-0 text-center py-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#14171D]">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-[#9A3412] dark:text-[#E07A5F]">
                      {monthLabel}
                    </div>
                    <div className="font-data text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {dayNum}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{evt.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{inst?.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{evt.campus}</span>
                    </div>
                    <h3 className="font-editorial text-xl font-semibold text-stone-900 dark:text-stone-100">
                      {evt.title}
                    </h3>
                    <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
                      {evt.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-stone-500 dark:text-stone-400 font-data">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {formatDateTime(evt.startsAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {evt.venue}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {regHref && (
                    <a
                      href={regHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                    >
                      <span>Register</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleReminder(evt.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      hasReminder
                        ? 'bg-[#14532D] text-white dark:bg-emerald-500 dark:text-stone-950'
                        : 'border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{hasReminder ? 'Reminder Set' : 'Remind Me'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
