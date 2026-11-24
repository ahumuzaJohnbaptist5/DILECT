import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { Institution, UserAccount } from '../types';
import {
  claimAdminAccount,
  fetchBootstrapStatus,
  loginAccount,
  registerAccount,
  setAuthToken,
} from '../lib/api';

interface AuthModalProps {
  institutions: Institution[];
  onAuthenticated: (user: UserAccount) => void;
  onClose: () => void;
}

export function AuthModal({ institutions, onAuthenticated, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'claim_admin'>('login');
  const [adminClaimed, setAdminClaimed] = useState(true);
  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || 'inst-mak');
  const [roleRequested, setRoleRequested] = useState<'registered_user' | 'content_contributor'>('registered_user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBootstrapStatus()
      .then((status) => {
        setAdminClaimed(status.adminClaimed);
        setEnvPasscodeConfigured(status.envPasscodeConfigured);
        if (!status.adminClaimed && !status.envPasscodeConfigured) {
          setMode('claim_admin');
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginAccount({ email, password });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else if (mode === 'register') {
        const res = await registerAccount({
          email,
          fullName,
          password,
          institutionId,
          roleRequested,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await claimAdminAccount({
          email,
          fullName,
          password,
          passcode: envPasscodeConfigured ? passcode : undefined,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FBF9F5] dark:bg-[#14171D] text-[#1C1917] dark:text-[#F3F1EC] border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h2 id="auth-modal-title" className="font-editorial text-xl font-semibold">
              DILECT Account Access
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Personalize your institutional feed or manage newsroom operations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Close sign in dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Register
            </button>
            {(!adminClaimed || envPasscodeConfigured) && (
              <button
                type="button"
                onClick={() => {
                  setMode('claim_admin');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md transition-colors whitespace-nowrap ${
                  mode === 'claim_admin'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Admin Setup
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'claim_admin' && (
            <div className="p-3 rounded-lg bg-[#F4F0E8] dark:bg-[#1B2028] border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {envPasscodeConfigured
                  ? 'Enter the server ADMIN_PASSCODE to provision a Super Administrator account.'
                  : 'First-run setup: claim the initial Super Administrator account for DILECT. Once claimed, this setup locks automatically.'}
              </span>
            </div>
          )}

          {(mode === 'register' || mode === 'claim_admin') && (
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Grace Tumusiime"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Institutional or Personal Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@university.ac.ug"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Password (minimum 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            />
          </div>

          {mode === 'claim_admin' && envPasscodeConfigured && (
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Server Admin Passcode
              </label>
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Configured ADMIN_PASSCODE"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Primary Institution
                </label>
                <select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Account Role
                </label>
                <select
                  value={roleRequested}
                  onChange={(e) =>
                    setRoleRequested(e.target.value as 'registered_user' | 'content_contributor')
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  <option value="registered_user">Student / Staff Reader</option>
                  <option value="content_contributor">Campus Contributor</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#1E3A8A] hover:bg-[#172C68] text-white dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] dark:text-stone-950 transition-colors disabled:opacity-60"
          >
            {loading
              ? 'Verifying...'
              : mode === 'login'
                ? 'Sign In to DILECT'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Claim Super Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
