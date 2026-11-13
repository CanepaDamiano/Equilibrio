import React, { useState, useEffect } from 'react';
import { Exercise } from '../types';
import { X, Play, Pause, RotateCcw, CheckCircle2, BookOpen, Lightbulb } from 'lucide-react';

interface FocusSessionModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  onCompleteExercise: (id: string) => void;
}

export const FocusSessionModal: React.FC<FocusSessionModalProps> = ({
  exercise,
  onClose,
  onCompleteExercise,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [scratchpad, setScratchpad] = useState('');

  useEffect(() => {
    if (exercise) {
      setSecondsLeft(exercise.estimatedMinutes * 60);
      setIsRunning(false);
      setScratchpad('');
    }
  }, [exercise]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  if (!exercise) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      className="animate-eq-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-modal-title"
    >
      <div className="animate-eq-modal w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div translate="no" className="notranslate flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <BookOpen className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
            <span>{exercise.course}</span>
            <span aria-hidden="true">·</span>
            <span>{exercise.topic}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Priority #{exercise.priorityRank}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close focus session"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main body */}
        <div className="space-y-5 p-6">
          <div translate="no" className="notranslate">
            <h2
              id="focus-modal-title"
              className="text-xl font-semibold text-slate-900 dark:text-slate-100"
            >
              {exercise.title}
            </h2>
            {exercise.description && (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {exercise.description}
              </p>
            )}
          </div>

          {/* Timer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-5 py-4">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Allocated Deep-Work Window
              </div>
              <div
                className={`mt-0.5 text-3xl font-semibold font-mono tabular-nums transition-transform duration-200 ${
                  isRunning
                    ? 'text-teal-800 dark:text-teal-300 scale-[1.02]'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formattedTimer}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause Timer
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Start Timer
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  setSecondsLeft(exercise.estimatedMinutes * 60);
                }}
                aria-label="Reset timer"
                className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* AI Tactical Study Guidance */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-400">
              <Lightbulb className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Why This Exercise Was Selected & How to Approach It
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="font-medium text-slate-800 dark:text-slate-100">
                Triage Rationale:
              </strong>{' '}
              {exercise.rationale}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="font-medium text-slate-800 dark:text-slate-100">
                Execution Strategy:
              </strong>{' '}
              {exercise.studyTip}
            </p>
          </div>

          {/* Scratchpad */}
          <div>
            <label
              htmlFor="focus-scratchpad"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Derivation & Solution Outline Scratchpad
            </label>
            <textarea
              id="focus-scratchpad"
              rows={3}
              value={scratchpad}
              onChange={(e) => setScratchpad(e.target.value)}
              placeholder="Write down key equations, base cases, or proof steps here..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/60 dark:bg-slate-950/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Completing this exercise locks in{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-200">
              {exercise.estimatedMinutes} min
            </span>{' '}
            toward your sleep-protected target.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onCompleteExercise(exercise.id);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 dark:bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 dark:hover:bg-teal-500 active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Exercise Completed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
