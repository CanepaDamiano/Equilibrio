import React from 'react';
import { ScheduleBlock, StudentBudget, TriageSummary } from '../types';
import { Moon, Coffee, BookOpen, Sunset } from 'lucide-react';

interface EveningTimelineProps {
  schedule: ScheduleBlock[];
  summary: TriageSummary;
  budget: StudentBudget;
  onStartStudyBlock?: (exerciseId: string) => void;
}

export const EveningTimeline: React.FC<EveningTimelineProps> = ({
  schedule,
  summary,
  budget,
  onStartStudyBlock,
}) => {
  const focusPercentage = Math.min(
    100,
    Math.round(
      (summary.selectedStudyMinutes /
        Math.max(1, summary.totalAssignedMinutes)) *
        100
    )
  );
  const savedPercentage = Math.min(
    100,
    Math.round(
      (summary.timeSavedMinutes /
        Math.max(1, summary.totalAssignedMinutes)) *
        100
    )
  );

  return (
    <div className="animate-eq-fade-up rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      {/* Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 px-6 py-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Evening Study-Rest Timeline
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Session starts at{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {budget.currentHour}
            </span>{' '}
            · Projected study completion at{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {summary.projectedFinishTime}
            </span>{' '}
            · Target sleep at{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {budget.targetBedtime}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="text-slate-600 dark:text-slate-400">
            Focus:{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {summary.selectedStudyMinutes}m
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            Breaks:{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {summary.breakMinutes}m
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span className="text-teal-700 dark:text-teal-400 font-medium">
            Saved: {summary.timeSavedMinutes}m
          </span>
        </div>
      </div>

      {/* Proportion Bar */}
      {summary.totalExercises > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-800/80 px-6 py-3 bg-slate-50/40 dark:bg-slate-950/40">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              style={{ width: `${focusPercentage}%` }}
              className="animate-eq-bar bg-slate-900 dark:bg-slate-100 transition-all duration-500"
            />
            <div
              style={{ width: `${savedPercentage}%` }}
              className="animate-eq-bar bg-teal-600/45 dark:bg-teal-400/50 transition-all duration-500"
            />
          </div>
        </div>
      )}

      {/* Chronological Blocks */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {schedule.map((block, index) => {
          const isStudy = block.type === 'study';
          const isBreak = block.type === 'break';
          const isWindDown = block.type === 'wind-down';
          const isSleep = block.type === 'sleep';

          return (
            <div
              key={block.id}
              style={{ animationDelay: `${index * 45}ms` }}
              className={`animate-eq-fade-up flex items-center justify-between gap-4 px-6 py-4 transition-colors duration-200 ${
                isSleep
                  ? 'bg-slate-50/80 dark:bg-slate-950/60'
                  : isWindDown
                  ? 'bg-teal-50/20 dark:bg-teal-950/20'
                  : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-24 shrink-0 pt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {block.startTime}–{block.endTime}
                </div>

                <div translate="no" className="notranslate min-w-0">
                  <div className="flex items-center gap-2">
                    {isStudy && (
                      <BookOpen className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                    )}
                    {isBreak && (
                      <Coffee className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    {isWindDown && (
                      <Sunset className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                    )}
                    {isSleep && (
                      <Moon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                    )}
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {block.title}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {block.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                  {block.durationMinutes}m
                </span>
                {isStudy && block.exerciseId && onStartStudyBlock && (
                  <button
                    type="button"
                    onClick={() => onStartStudyBlock(block.exerciseId!)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-slate-100 dark:hover:text-slate-900 dark:hover:border-slate-100 active:scale-[0.97] transition-all duration-150 whitespace-nowrap shrink-0"
                  >
                    Start Focus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
