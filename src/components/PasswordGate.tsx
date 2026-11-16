import React, { useState } from 'react';
import { ThemeMode } from '../types';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

interface PasswordGateProps {
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  onAuthenticated: (token: string) => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({
  themeMode,
  onChangeTheme,
  onAuthenticated,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your access password.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      if (response.ok && data.ok && data.token) {
        onAuthenticated(data.token);
      } else {
        setErrorMsg(data.error || 'Incorrect password. Please try again.');
      }
    } catch {
      setErrorMsg('Could not verify password with server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Bar */}
      <header className="border-b border-slate-200/70 dark:border-slate-800/80 bg-[#FAFAFA]/90 dark:bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-3.5">
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Equilibrio
          </span>

          <div
            role="group"
            aria-label="Theme mode"
            className="inline-flex items-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 p-0.5"
          >
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTheme(opt.id)}
                  aria-label={`${opt.label} theme`}
                  aria-pressed={isActive}
                  title={`${opt.label} theme`}
                  className={`flex items-center justify-center rounded-md p-1.5 text-xs font-medium transition-all duration-150 shrink-0 ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Centered Password Card */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="animate-eq-fade-up w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl transition-colors duration-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mb-5">
            <Lock className="h-4 w-4" />
          </div>

          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Protected Study Workspace
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter your access password to unlock Equilibrio and your AI exercise triage engine.
          </p>

          {errorMsg && (
            <div
              role="alert"
              className="animate-eq-fade-up mt-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="workspace-password-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Access Password
              </label>
              <div className="relative">
                <input
                  id="workspace-password-input"
                  data-testid="workspace-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter password..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 pl-3.5 pr-9 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="unlock-workspace-button"
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.99] disabled:opacity-50 transition-all duration-150"
            >
              <span>{isSubmitting ? 'Verifying...' : 'Unlock Workspace'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-4 text-xs text-slate-400 dark:text-slate-500">
          <span>Equilibrio</span>
          <span>Password-Protected Academic Workspace</span>
        </div>
      </footer>
    </div>
  );
};
