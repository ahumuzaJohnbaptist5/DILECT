import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Institution, SubscriptionPlan, SubscriptionPlanId, UserAccount } from '../types';
import { updateInstitutionPlan } from '../lib/api';

interface PlansViewProps {
  plans: SubscriptionPlan[];
  institutions: Institution[];
  currentUser: UserAccount | null;
  onPlanUpdated: () => Promise<void>;
  onOpenSignIn: () => void;
}

export function PlansView({
  plans,
  institutions,
  currentUser,
  onPlanUpdated,
  onOpenSignIn,
}: PlansViewProps) {
  const [cadence, setCadence] = useState<'monthly' | 'annual'>('annual');
  const [selectedInstId, setSelectedInstId] = useState(
    currentUser?.institutionId || institutions[0]?.id || 'inst-mak'
  );
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManagePlans =
    currentUser && ['super_admin', 'institution_admin'].includes(currentUser.role);
  const activeInst = institutions.find((i) => i.id === selectedInstId) || institutions[0];

  async function handleSelectPlan(planId: SubscriptionPlanId) {
    if (!canManagePlans || !activeInst) {
      onOpenSignIn();
      return;
    }
    setError(null);
    setFeedback(null);
    setUpdatingPlanId(planId);
    try {
      await updateInstitutionPlan(activeInst.id, planId);
      await onPlanUpdated();
      setFeedback(`Updated ${activeInst.shortName} subscription plan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update subscription plan.');
    } finally {
      setUpdatingPlanId(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-50 headline-balance">
            Free for Students. Built for Institutions.
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            Students, staff, and public readers always access verified institutional news free of charge. Institutions subscribe to automated aggregation, governance, and multi-campus communication tooling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {currentUser?.role === 'super_admin' && (
            <select
              aria-label="Select institution to manage plan"
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14171D]"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.shortName} ({i.planId.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-200/70 dark:bg-stone-800/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setCadence('monthly')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                cadence === 'monthly'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCadence('annual')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                cadence === 'annual'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Annual Billing
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-medium text-emerald-900 dark:text-emerald-200">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs font-medium text-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = cadence === 'monthly' ? plan.monthlyUsd : plan.annualUsd;
          const isCurrentForInst = activeInst?.planId === plan.id && plan.id !== 'student_public';
          return (
            <div
              key={plan.id}
              className="flex flex-col justify-between p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#14171D]"
            >
              <div>
                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {plan.audience}
                </div>
                <h2 className="mt-1.5 font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  {plan.name}
                </h2>
                <div className="mt-4 flex items-baseline gap-1.5 font-data tabular-nums">
                  <span className="text-3xl font-semibold text-stone-900 dark:text-stone-50">
                    ${price.toLocaleString()}
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {price === 0 ? 'forever' : cadence === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>

                <div className="mt-5 py-3 border-y border-stone-200 dark:border-stone-800 grid grid-cols-3 gap-2 text-xs font-data tabular-nums">
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Sources</div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {plan.maxSources === 0 ? 'Read-only' : plan.maxSources}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Editors</div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {plan.maxEditors === 0 ? '—' : plan.maxEditors}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Campuses</div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {plan.maxCampuses}
                    </div>
                  </div>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs text-stone-700 dark:text-stone-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                {plan.id === 'student_public' ? (
                  <button
                    type="button"
                    onClick={onOpenSignIn}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    {currentUser ? 'Active for Public Readers' : 'Register Free Student Account'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCurrentForInst || updatingPlanId === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                      isCurrentForInst
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 cursor-default'
                        : 'bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950'
                    }`}
                  >
                    {isCurrentForInst
                      ? `Active on ${activeInst?.shortName}`
                      : updatingPlanId === plan.id
                        ? 'Updating Plan...'
                        : canManagePlans
                          ? `Switch ${activeInst?.shortName} to Plan`
                          : 'Sign In as Institution Admin'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
