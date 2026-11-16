import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ComplexityLevel,
  ExamRelevance,
  Exercise,
  ExerciseType,
  StudentBudget,
  ThemeMode,
  TriageStatus,
} from './types';
import {
  triageExercises,
  buildStudyScheduleAndSummary,
  buildDefaultRationale,
  mergeImportedExercises,
  mergeAiTriageDecisions,
} from './utils/triageEngine';
import { AddExerciseModal } from './components/AddExerciseModal';
import { FocusSessionModal } from './components/FocusSessionModal';
import { EveningTimeline } from './components/EveningTimeline';
import { PasswordGate } from './components/PasswordGate';
import {
  Plus,
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Play,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Upload,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  Lock,
} from 'lucide-react';

const STORAGE_KEY_EXERCISES = 'equilibrio_exercises_v1';
const STORAGE_KEY_BUDGET = 'equilibrio_budget_v1';
const STORAGE_KEY_THEME = 'equilibrio_theme_v1';
const STORAGE_KEY_AUTH = 'equilibrio_auth_token_v1';

const DEFAULT_BUDGET: StudentBudget = {
  availableMinutes: 120,
  currentHour: '20:00',
  targetBedtime: '23:00',
  windDownMinutes: 30,
  energyLevel: 'Moderate',
  optimizationMode: 'Balanced',
};

function sanitizeStoredExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => {
      const status: TriageStatus = ['Essential', 'High-Yield', 'Optional', 'Defer'].includes(
        item.triageStatus
      )
        ? item.triageStatus
        : 'Essential';
      const relevance: ExamRelevance = ['Low', 'Medium', 'High', 'Critical'].includes(
        item.examRelevance
      )
        ? item.examRelevance
        : 'High';
      const exType: ExerciseType = [
        'Proof',
        'Problem Set',
        'Coding Lab',
        'Case Study',
        'Drill',
        'Past Exam',
      ].includes(item.exerciseType)
        ? item.exerciseType
        : 'Problem Set';
      const complexity = (Math.min(5, Math.max(1, Number(item.complexity) || 3)) as ComplexityLevel);

      return {
        id: String(item.id || `stored-${idx}`),
        title: String(item.title || 'Untitled Exercise'),
        course: String(item.course || 'Course Assignment'),
        topic: String(item.topic || 'General'),
        description: String(item.description || ''),
        estimatedMinutes: Math.min(180, Math.max(10, Number(item.estimatedMinutes) || 35)),
        complexity,
        examRelevance: relevance,
        exerciseType: exType,
        dueDate: String(item.dueDate || 'Upcoming'),
        completed: Boolean(item.completed),
        triageStatus: status,
        priorityRank: Number(item.priorityRank) || idx + 1,
        pedagogicalScore: Number(item.pedagogicalScore) || 75,
        rationale: String(item.rationale || 'Selected based on exam relevance and study window.'),
        studyTip: String(item.studyTip || 'Focus on the core derivation steps first.'),
        keyConcepts:
          Array.isArray(item.keyConcepts) && item.keyConcepts.length > 0
            ? item.keyConcepts.map(String)
            : ['Core Concept'],
        redundancyNote: item.redundancyNote ? String(item.redundancyNote) : undefined,
      };
    });
}

export default function App() {
  // Theme mode state ('light' | 'dark' | 'system')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // Ignore storage read errors
    }
    return 'system';
  });

  // Sync themeMode with document.documentElement ('dark' class) and OS media query
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, themeMode);
    } catch {
      // Ignore storage write errors
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', isDark);
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };

    applyTheme();

    const handleSystemChange = () => {
      if (themeMode === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  // Password authentication state
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTH) || '';
    } catch {
      return '';
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY_AUTH));
    } catch {
      return false;
    }
  });

  // Verify stored token against server on startup
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      if (!authToken) {
        if (active) setIsAuthenticated(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/status', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem(STORAGE_KEY_AUTH);
            setAuthToken('');
            setIsAuthenticated(false);
          }
        }
      } catch {
        // Keep current session state on transient network check error
      }
    };
    void checkStatus();
    return () => {
      active = false;
    };
  }, [authToken]);

  const handleAuthenticated = (token: string) => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, token);
    } catch {
      // Ignore storage write errors
    }
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  const handleLockWorkspace = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch {
      // Ignore storage errors
    }
    setAuthToken('');
    setIsAuthenticated(false);
  };

  // Primary workspace view tab
  const [activeView, setActiveView] = useState<'exercises' | 'schedule'>('exercises');

  // Collapsible fine-tune settings drawer
  const [isBudgetTuneOpen, setIsBudgetTuneOpen] = useState(false);

  // Student study-rest budget state (loaded from localStorage if available)
  const [budget, setBudget] = useState<StudentBudget>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BUDGET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            availableMinutes: Number(parsed.availableMinutes) || DEFAULT_BUDGET.availableMinutes,
            currentHour:
              typeof parsed.currentHour === 'string'
                ? parsed.currentHour
                : DEFAULT_BUDGET.currentHour,
            targetBedtime:
              typeof parsed.targetBedtime === 'string'
                ? parsed.targetBedtime
                : DEFAULT_BUDGET.targetBedtime,
            windDownMinutes:
              typeof parsed.windDownMinutes === 'number'
                ? parsed.windDownMinutes
                : DEFAULT_BUDGET.windDownMinutes,
            energyLevel: ['Fresh', 'Moderate', 'Exhausted'].includes(parsed.energyLevel)
              ? parsed.energyLevel
              : DEFAULT_BUDGET.energyLevel,
            optimizationMode: ['Balanced', 'Exam-Focused', 'Deep-Concepts'].includes(
              parsed.optimizationMode
            )
              ? parsed.optimizationMode
              : DEFAULT_BUDGET.optimizationMode,
          };
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_BUDGET;
  });

  // Exercises state (loaded from localStorage if available, starts empty otherwise)
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXERCISES);
      if (saved) {
        return sanitizeStoredExercises(JSON.parse(saved));
      }
    } catch {
      // Ignore storage read errors
    }
    return [];
  });

  // Persist exercises and budget to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXERCISES, JSON.stringify(exercises));
    } catch {
      // Ignore storage write errors
    }
  }, [exercises]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify(budget));
    } catch {
      // Ignore storage write errors
    }
  }, [budget]);

  const [customAiInsight, setCustomAiInsight] = useState<string | undefined>(
    undefined
  );
  const [isTriaging, setIsTriaging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'selected' | 'deferred'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(
    null
  );

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'file' | 'single' | 'paste'>('file');
  const [activeFocusExerciseId, setActiveFocusExerciseId] = useState<
    string | null
  >(null);

  const triageRequestIdRef = useRef(0);

  // Re-run local deterministic triage whenever budget parameters change
  const applyLocalTriage = (
    rawList: Omit<
      Exercise,
      | 'triageStatus'
      | 'priorityRank'
      | 'pedagogicalScore'
      | 'rationale'
      | 'studyTip'
    >[],
    nextBudget: StudentBudget
  ) => {
    triageRequestIdRef.current += 1;
    setIsTriaging(false);
    const updated = triageExercises(rawList, nextBudget);
    setExercises(updated);
    setCustomAiInsight(undefined);
  };

  // Update budget helper
  const handleUpdateBudget = (partial: Partial<StudentBudget>) => {
    const nextBudget = { ...budget, ...partial };
    setBudget(nextBudget);
    if (exercises.length > 0) {
      applyLocalTriage(exercises, nextBudget);
    }
  };

  // Core AI triage runner (used both by "Re-Run AI Triage" button and automatically on file import)
  const executeAiTriage = async (
    targetList: Exercise[],
    targetBudget: StudentBudget
  ) => {
    if (targetList.length === 0) return;
    const requestId = ++triageRequestIdRef.current;
    setIsTriaging(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ exercises: targetList, budget: targetBudget }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (requestId !== triageRequestIdRef.current) return;

      if (response.status === 401) {
        handleLockWorkspace();
        return;
      }

      const data = await response.json();

      if (
        response.ok &&
        data.mode === 'gemini' &&
        Array.isArray(data.decisions) &&
        data.decisions.length > 0
      ) {
        const merged = mergeAiTriageDecisions(
          targetList,
          data.decisions,
          targetBudget
        );
        setExercises(merged);
        if (data.aiInsight) {
          setCustomAiInsight(data.aiInsight);
        }
      } else {
        const locallyTriaged = triageExercises(targetList, targetBudget);
        setExercises(locallyTriaged);
        setCustomAiInsight(undefined);
      }
    } catch {
      if (requestId !== triageRequestIdRef.current) return;
      const locallyTriaged = triageExercises(targetList, targetBudget);
      setExercises(locallyTriaged);
    } finally {
      if (requestId === triageRequestIdRef.current) {
        setIsTriaging(false);
      }
    }
  };

  // Trigger server-side Gemini AI Triage with seamless fallback to local engine
  const handleRunAiTriage = async () => {
    await executeAiTriage(exercises, budget);
  };

  // Add single exercise (deduplicates/refreshes if same title+course already exists)
  const handleAddSingleExercise = (
    newEx: Omit<
      Exercise,
      | 'id'
      | 'triageStatus'
      | 'priorityRank'
      | 'pedagogicalScore'
      | 'rationale'
      | 'studyTip'
    >
  ) => {
    const prefix = `ex-${Date.now()}`;
    const mergedRaw = mergeImportedExercises([newEx], exercises, 'merge', prefix);
    const triaged = triageExercises(mergedRaw, budget);
    setExercises(triaged);
    setCustomAiInsight(undefined);
    setStatusFilter('all');
    setSearchQuery('');
    setActiveView('exercises');
    if (mergedRaw.length > 0) {
      setExpandedExerciseId(mergedRaw[0].id);
    }
  };

  // Bulk add exercises from uploaded file or pasted sheet
  const handleBulkAddExercises = (
    newItems: Omit<
      Exercise,
      | 'id'
      | 'triageStatus'
      | 'priorityRank'
      | 'pedagogicalScore'
      | 'rationale'
      | 'studyTip'
    >[],
    importMode: 'merge' | 'replace' = 'merge'
  ) => {
    triageRequestIdRef.current += 1;
    setIsTriaging(false);
    const prefix = `bulk-${Date.now()}`;
    const mergedRaw = mergeImportedExercises(
      newItems,
      exercises,
      importMode,
      prefix
    );
    const triaged = triageExercises(mergedRaw, budget);
    setExercises(triaged);
    setCustomAiInsight(undefined);
    setStatusFilter('all');
    setSearchQuery('');
    setActiveView('exercises');
    if (triaged.length > 0) {
      setExpandedExerciseId(triaged[0].id);
    }
  };

  // Toggle completed state
  const handleToggleComplete = (id: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === id ? { ...ex, completed: !ex.completed } : ex
      )
    );
  };

  // Explicitly mark completed (used by FocusSessionModal)
  const handleMarkComplete = (id: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, completed: true } : ex))
    );
  };

  // Manually cycle status between Essential -> High-Yield -> Optional -> Defer and update rationale
  const handleCycleStatus = (id: string) => {
    const order: TriageStatus[] = [
      'Essential',
      'High-Yield',
      'Optional',
      'Defer',
    ];
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const nextIdx = (order.indexOf(ex.triageStatus) + 1) % order.length;
        const nextStatus = order[nextIdx];
        const updatedNotes = buildDefaultRationale(ex, nextStatus);
        return {
          ...ex,
          triageStatus: nextStatus,
          rationale: updatedNotes.rationale,
          studyTip: updatedNotes.studyTip,
        };
      })
    );
  };

  // Delete exercise
  const handleDeleteExercise = (id: string) => {
    triageRequestIdRef.current += 1;
    setIsTriaging(false);
    const remaining = exercises.filter((e) => e.id !== id);
    const retriaged = triageExercises(remaining, budget);
    setExercises(retriaged);
  };

  // Clear all exercises
  const handleClearAll = () => {
    triageRequestIdRef.current += 1;
    setIsTriaging(false);
    setExercises([]);
    setCustomAiInsight(undefined);
    setExpandedExerciseId(null);
    setStatusFilter('all');
    setSearchQuery('');
  };

  // Compute live schedule & summary
  const { schedule, summary } = useMemo(
    () => buildStudyScheduleAndSummary(exercises, budget, customAiInsight),
    [exercises, budget, customAiInsight]
  );

  // Filtered exercises for display
  const filteredExercises = useMemo(() => {
    return exercises
      .filter((ex) => {
        if (statusFilter === 'selected') {
          return (
            ex.triageStatus === 'Essential' || ex.triageStatus === 'High-Yield'
          );
        }
        if (statusFilter === 'deferred') {
          return (
            ex.triageStatus === 'Optional' || ex.triageStatus === 'Defer'
          );
        }
        return true;
      })
      .filter((ex) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          ex.title.toLowerCase().includes(q) ||
          ex.course.toLowerCase().includes(q) ||
          ex.topic.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.priorityRank - b.priorityRank);
  }, [exercises, statusFilter, searchQuery]);

  const activeFocusExercise = useMemo(
    () => exercises.find((e) => e.id === activeFocusExerciseId) || null,
    [exercises, activeFocusExerciseId]
  );

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  if (!isAuthenticated) {
    return (
      <PasswordGate
        themeMode={themeMode}
        onChangeTheme={setThemeMode}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Minimalist Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-slate-800/80 bg-[#FAFAFA]/90 dark:bg-[#090D16]/90 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-3.5">
          <a
            href="#top"
            className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 shrink-0"
          >
            Equilibrio
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            <a
              href="#workspace"
              onClick={() => setActiveView('exercises')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'exercises'
                  ? 'text-slate-900 dark:text-slate-100 font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Exercises
            </a>
            <a
              href="#workspace"
              onClick={() => setActiveView('schedule')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'schedule'
                  ? 'text-slate-900 dark:text-slate-100 font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Evening Schedule
            </a>
            <a
              href="#budget-bar"
              onClick={() => setIsBudgetTuneOpen(true)}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Study Parameters
            </a>
            <a
              href="#overview"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* Segmented Theme Switcher (Light / Dark / System) */}
            <div
              role="group"
              aria-label="Theme mode"
              data-testid="theme-switcher"
              className="inline-flex items-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 p-0.5"
            >
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeMode(opt.id)}
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

            {/* Lock Session Button */}
            <button
              type="button"
              onClick={handleLockWorkspace}
              aria-label="Lock workspace"
              title="Lock workspace"
              className="flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 p-2 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-150 shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>

            {exercises.length > 0 && (
              <button
                type="button"
                onClick={handleRunAiTriage}
                disabled={isTriaging}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <Sparkles
                  className={`h-3.5 w-3.5 text-teal-700 dark:text-teal-400 ${
                    isTriaging ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden sm:inline">
                  {isTriaging ? 'Evaluating...' : 'Re-Run AI Triage'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setModalInitialTab('file');
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Exercises
            </button>
          </div>
        </div>
      </header>

      {/* Focused Single-Column Container */}
      <main className="flex-1">
        <div className="mx-auto max-w-[920px] px-6 py-8 space-y-6">
          {/* Clean Title Header */}
          <div id="overview" className="animate-eq-fade-up space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Focus on high-impact exercises. Sleep on time.
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              AI prioritizes your university problem sets around your evening rest budget.
            </p>
          </div>

          {/* Compact Study-Rest Budget Bar */}
          <section
            id="budget-bar"
            aria-label="Study-Rest Budget Controls"
            style={{ animationDelay: '40ms' }}
            className="animate-eq-fade-up rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 transition-colors duration-200"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              {/* Time Budget Slider */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="available-minutes-slider"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Available Focus Time
                  </label>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatHoursMins(budget.availableMinutes)} ({budget.availableMinutes}m)
                  </span>
                </div>
                <input
                  id="available-minutes-slider"
                  type="range"
                  min={30}
                  max={240}
                  step={15}
                  value={budget.availableMinutes}
                  onChange={(e) =>
                    handleUpdateBudget({
                      availableMinutes: Number(e.target.value),
                    })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-800 accent-slate-900 dark:accent-teal-400"
                />
              </div>

              {/* Start & Target Bedtime + Tune Button */}
              <div className="flex flex-wrap items-end gap-3 sm:pl-4 sm:border-l sm:border-slate-100 dark:sm:border-slate-800">
                <div>
                  <label
                    htmlFor="start-hour-select"
                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Start Time
                  </label>
                  <select
                    id="start-hour-select"
                    value={budget.currentHour}
                    onChange={(e) =>
                      handleUpdateBudget({ currentHour: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                  >
                    <option value="18:30">18:30</option>
                    <option value="19:00">19:00</option>
                    <option value="19:30">19:30</option>
                    <option value="20:00">20:00</option>
                    <option value="20:30">20:30</option>
                    <option value="21:00">21:00</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="bedtime-select"
                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Target Bedtime
                  </label>
                  <select
                    id="bedtime-select"
                    value={budget.targetBedtime}
                    onChange={(e) =>
                      handleUpdateBudget({ targetBedtime: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                  >
                    <option value="22:00">22:00</option>
                    <option value="22:30">22:30</option>
                    <option value="23:00">23:00</option>
                    <option value="23:30">23:30</option>
                    <option value="00:00">00:00</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBudgetTuneOpen((prev) => !prev)}
                  aria-expanded={isBudgetTuneOpen}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isBudgetTuneOpen
                      ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Tune
                </button>
              </div>
            </div>

            {/* Collapsible Fine-Tune Drawer (Energy, Optimization Strategy & Appearance) */}
            <div
              className={`eq-accordion-grid ${
                isBudgetTuneOpen ? 'eq-accordion-open' : 'eq-accordion-closed'
              }`}
            >
              <div className="eq-accordion-inner">
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Cognitive Energy Level
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                      {(['Fresh', 'Moderate', 'Exhausted'] as const).map((lvl) => {
                        const isActive = budget.energyLevel === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleUpdateBudget({ energyLevel: lvl })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs scale-[1.01]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Prioritization Strategy
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                      {(
                        ['Balanced', 'Exam-Focused', 'Deep-Concepts'] as const
                      ).map((mode) => {
                        const isActive = budget.optimizationMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              handleUpdateBudget({ optimizationMode: mode })
                            }
                            className={`rounded-md py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs scale-[1.01]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Appearance
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                      {themeOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = themeMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setThemeMode(opt.id)}
                            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs scale-[1.01]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quiet Inline Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <span>
                  Selected:{' '}
                  <strong className="font-semibold text-slate-900 dark:text-slate-100">
                    {summary.selectedCount}/{summary.totalExercises}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span>
                  Focus:{' '}
                  <strong className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatHoursMins(summary.selectedStudyMinutes)}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-teal-700 dark:text-teal-400">
                  Saved:{' '}
                  <strong className="font-semibold">
                    {formatHoursMins(summary.timeSavedMinutes)}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span>
                  Coverage:{' '}
                  <strong className="font-semibold text-slate-900 dark:text-slate-100">
                    {summary.conceptCoveragePercent}%
                  </strong>
                </span>
              </div>

              <div className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Finish study{' '}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  {summary.projectedFinishTime}
                </strong>{' '}
                ·{' '}
                <span
                  className={
                    summary.sleepProtected
                      ? 'text-teal-700 dark:text-teal-400 font-medium'
                      : 'text-amber-700 dark:text-amber-400 font-medium'
                  }
                >
                  {summary.sleepProtected
                    ? 'Sleep Protected'
                    : 'Near Bedtime Limit'}
                </span>
              </div>
            </div>
          </section>

          {/* Main Workspace Section */}
          <section id="workspace" aria-label="Study Workspace" className="space-y-4">
            {exercises.length === 0 ? (
              /* Clean Empty State */
              <div
                style={{ animationDelay: '80ms' }}
                className="animate-eq-fade-up rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-16 text-center transition-colors duration-200"
              >
                <div className="mx-auto max-w-md space-y-4">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Upload or add your assigned exercises
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Import a problem sheet file (.pdf, .csv, .json, .txt, .md, or image) or enter exercises manually. Equilibrio ranks them by exam impact to protect your sleep.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setModalInitialTab('file');
                        setIsAddModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Exercise File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalInitialTab('single');
                        setIsAddModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Manually
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Unified Workspace Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* View Switcher: Priority List vs Evening Schedule */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800/80 p-1">
                      {(
                        [
                          {
                            id: 'exercises',
                            label: `Priority List (${exercises.length})`,
                          },
                          {
                            id: 'schedule',
                            label: `Evening Schedule (${schedule.length} blocks)`,
                          },
                        ] as const
                      ).map((tab) => {
                        const isActive = activeView === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveView(tab.id)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs scale-[1.01]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {activeView === 'exercises' && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 pl-1">
                        <button
                          type="button"
                          onClick={() => setStatusFilter('all')}
                          className={`rounded-md px-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === 'all'
                              ? 'font-semibold text-slate-900 dark:text-slate-100 underline underline-offset-4'
                              : 'hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          All ({exercises.length})
                        </button>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('selected')}
                          className={`rounded-md px-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === 'selected'
                              ? 'font-semibold text-teal-800 dark:text-teal-400 underline underline-offset-4'
                              : 'hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Selected ({summary.selectedCount})
                        </button>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('deferred')}
                          className={`rounded-md px-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === 'deferred'
                              ? 'font-semibold text-slate-900 dark:text-slate-100 underline underline-offset-4'
                              : 'hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Deferred ({summary.deferredCount})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Toolbar Actions */}
                  <div className="flex items-center gap-2">
                    {activeView === 'exercises' && (
                      <input
                        type="search"
                        aria-label="Filter exercises by keyword"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-36 sm:w-44 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setModalInitialTab('file');
                        setIsAddModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {activeView === 'schedule' ? (
                  <EveningTimeline
                    schedule={schedule}
                    summary={summary}
                    budget={budget}
                    onStartStudyBlock={(exerciseId) =>
                      setActiveFocusExerciseId(exerciseId)
                    }
                  />
                ) : (
                  <div className="animate-eq-fade-up space-y-3">
                    {/* Quiet AI Synthesis Line */}
                    <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                      {summary.aiInsight}
                    </p>

                    {filteredExercises.length === 0 ? (
                      <div className="animate-eq-fade-up rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No exercises match your current filter or search query.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('all');
                            setSearchQuery('');
                          }}
                          className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-200">
                        {filteredExercises.map((ex, index) => {
                          const isSelectedTonight =
                            ex.triageStatus === 'Essential' ||
                            ex.triageStatus === 'High-Yield';
                          const isExpanded = expandedExerciseId === ex.id;

                          return (
                            <article
                              key={ex.id}
                              style={{ animationDelay: `${index * 35}ms` }}
                              data-testid={`exercise-card-${ex.id}`}
                              className={`animate-eq-fade-up p-5 transition-colors duration-200 ${
                                ex.completed
                                  ? 'bg-slate-50/60 dark:bg-slate-950/60 opacity-65'
                                  : !isSelectedTonight
                                  ? 'bg-slate-50/30 dark:bg-slate-950/30'
                                  : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleComplete(ex.id)}
                                    aria-label={`Mark "${ex.title}" as ${
                                      ex.completed ? 'incomplete' : 'completed'
                                    }`}
                                    className="mt-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all duration-150 shrink-0"
                                  >
                                    {ex.completed ? (
                                      <CheckCircle2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                                    ) : (
                                      <Circle className="h-4 w-4" />
                                    )}
                                  </button>

                                  <div translate="no" className="notranslate min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                        #{ex.priorityRank}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span
                                        className={`font-semibold ${
                                          ex.triageStatus === 'Essential'
                                            ? 'text-teal-700 dark:text-teal-400'
                                            : ex.triageStatus === 'High-Yield'
                                            ? 'text-emerald-700 dark:text-emerald-400'
                                            : ex.triageStatus === 'Optional'
                                            ? 'text-amber-700 dark:text-amber-400'
                                            : 'text-slate-400 dark:text-slate-500'
                                        }`}
                                      >
                                        {ex.triageStatus}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-slate-700 dark:text-slate-300">
                                        {ex.course}
                                      </span>
                                      {ex.topic && ex.topic !== 'General' && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>{ex.topic}</span>
                                        </>
                                      )}
                                    </div>

                                    <h3
                                      className={`text-sm font-semibold leading-snug ${
                                        ex.completed
                                          ? 'line-through text-slate-400 dark:text-slate-500'
                                          : 'text-slate-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {ex.title}
                                    </h3>

                                    {ex.description && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {ex.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="flex items-center gap-1 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 mr-1">
                                    <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                    {ex.estimatedMinutes}m
                                  </span>

                                  {isSelectedTonight && !ex.completed && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveFocusExerciseId(ex.id)
                                      }
                                      aria-label={`Start Focus on ${ex.title}`}
                                      className="flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0"
                                    >
                                      <Play className="h-3 w-3" />
                                      Focus
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleCycleStatus(ex.id)}
                                    title="Change triage status"
                                    aria-label={`Change triage status for ${ex.title}`}
                                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95 transition-all duration-150"
                                  >
                                    <ArrowUpDown className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedExerciseId(
                                        isExpanded ? null : ex.id
                                      )
                                    }
                                    aria-expanded={isExpanded}
                                    aria-label={`Toggle AI rationale for ${ex.title}`}
                                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95 transition-all duration-150"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteExercise(ex.id)
                                    }
                                    aria-label={`Remove ${ex.title}`}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all duration-150"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Animated Accordion AI Rationale & Tactical Tip */}
                              <div
                                className={`eq-accordion-grid ${
                                  isExpanded
                                    ? 'eq-accordion-open'
                                    : 'eq-accordion-closed'
                                }`}
                              >
                                <div className="eq-accordion-inner">
                                  <div className="mt-3.5 ml-7 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3.5 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                      <strong className="font-semibold text-slate-900 dark:text-slate-100">
                                        Rationale:
                                      </strong>{' '}
                                      {ex.rationale}
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                      <strong className="font-semibold text-teal-800 dark:text-teal-400">
                                        Study Tip:
                                      </strong>{' '}
                                      {ex.studyTip}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* Minimalist Footer */}
      <footer className="mt-12 border-t border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 transition-colors duration-200">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-5 text-xs text-slate-400 dark:text-slate-500">
          <span>Equilibrio</span>
          <span>Study-Rest Balance & Exercise Triage</span>
        </div>
      </footer>

      {/* Modals */}
      <AddExerciseModal
        isOpen={isAddModalOpen}
        initialTab={modalInitialTab}
        existingCount={exercises.length}
        authToken={authToken}
        onClose={() => setIsAddModalOpen(false)}
        onAddExercise={handleAddSingleExercise}
        onBulkAddExercises={handleBulkAddExercises}
      />

      <FocusSessionModal
        exercise={activeFocusExercise}
        onClose={() => setActiveFocusExerciseId(null)}
        onCompleteExercise={handleMarkComplete}
      />
    </div>
  );
}
