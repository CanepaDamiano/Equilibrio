import {
  Exercise,
  StudentBudget,
  TriageSummary,
  ScheduleBlock,
  ExamRelevance,
  ExerciseType,
  TriageStatus,
} from '../types';

const RELEVANCE_WEIGHT: Record<ExamRelevance, number> = {
  Critical: 42,
  High: 30,
  Medium: 18,
  Low: 8,
};

const TYPE_PEDAGOGICAL_WEIGHT: Record<ExerciseType, number> = {
  'Past Exam': 26,
  Proof: 24,
  'Coding Lab': 22,
  'Problem Set': 18,
  'Case Study': 16,
  Drill: 8,
};

/**
 * Computes a deterministic pedagogical utility score (0 - 100) for an exercise
 * based on complexity, exam relevance, exercise type, and the student's current mode/energy.
 */
export function calculatePedagogicalScore(
  exercise: Pick<
    Exercise,
    'complexity' | 'examRelevance' | 'exerciseType' | 'estimatedMinutes' | 'keyConcepts'
  >,
  budget: Pick<StudentBudget, 'energyLevel' | 'optimizationMode'>
): number {
  let score = 0;

  // 1. Exam relevance weight (up to 42)
  score += RELEVANCE_WEIGHT[exercise.examRelevance] ?? 18;

  // 2. Pedagogical depth by exercise type (up to 26)
  score += TYPE_PEDAGOGICAL_WEIGHT[exercise.exerciseType] ?? 15;

  // 3. Complexity contribution (1-5 -> up to 22)
  const complexityBonus = exercise.complexity * 4.4;
  score += complexityBonus;

  // 4. Concept density bonus (up to 10)
  const conceptCount = exercise.keyConcepts?.length || 1;
  score += Math.min(10, conceptCount * 3);

  // 5. Mode adjustments
  if (budget.optimizationMode === 'Exam-Focused') {
    if (exercise.examRelevance === 'Critical' || exercise.exerciseType === 'Past Exam') {
      score += 10;
    }
    if (exercise.exerciseType === 'Drill') {
      score -= 8;
    }
  } else if (budget.optimizationMode === 'Deep-Concepts') {
    if (exercise.complexity >= 4 || exercise.exerciseType === 'Proof') {
      score += 10;
    }
  } else {
    // Balanced mode favors high yield per minute (efficiency)
    const efficiency = score / Math.max(15, exercise.estimatedMinutes);
    score += Math.min(8, efficiency * 4);
  }

  // 6. Energy level adjustments (if exhausted, penalize 60+ min 5/5 tasks slightly if alternatives exist)
  if (budget.energyLevel === 'Exhausted' && exercise.complexity === 5 && exercise.estimatedMinutes >= 55) {
    score -= 6;
  }

  return Math.max(12, Math.min(99, Math.round(score)));
}

/**
 * Generates an insightful pedagogical rationale when local optimization runs or when status is overridden.
 */
export function buildDefaultRationale(
  exercise: Pick<
    Exercise,
    'title' | 'course' | 'topic' | 'complexity' | 'examRelevance' | 'exerciseType' | 'estimatedMinutes'
  >,
  status: TriageStatus,
  redundantWithTitle?: string
): { rationale: string; studyTip: string; redundancyNote?: string } {
  const cleanTopic =
    !exercise.topic || exercise.topic.toLowerCase() === 'general'
      ? exercise.course || 'course'
      : exercise.topic;

  if (status === 'Essential') {
    return {
      rationale: `Core ${exercise.examRelevance.toLowerCase()}-relevance ${exercise.exerciseType.toLowerCase()} covering foundational ${cleanTopic} concepts. Mastering this single problem unlocks simpler variations automatically.`,
      studyTip: `Focus on setting up the governing equations and boundary conditions first; spend the first 10 minutes mapping the structure before calculating.`,
    };
  }
  if (status === 'High-Yield') {
    return {
      rationale: `Strong return on time (${exercise.estimatedMinutes} min) for ${exercise.course}. Consolidates multi-step reasoning without excessive mechanical repetition.`,
      studyTip: `Work through the main derivation cleanly and annotate the key transition step for exam review.`,
    };
  }
  if (status === 'Optional') {
    return {
      rationale: `Useful reinforcement for ${cleanTopic}, but fits outside tonight's optimal study-rest window given higher-priority exam targets.`,
      studyTip: `Skim the problem statement and outline the 3-step solution strategy in 3 minutes instead of writing out the full computation tonight.`,
    };
  }
  return {
    rationale: redundantWithTitle
      ? `Safely deferred to protect your sleep window. Conceptually overlaps with "${redundantWithTitle}", which already tests this skill at higher depth.`
      : `Low marginal learning gain relative to its ${exercise.estimatedMinutes}-minute time cost tonight. Deferring protects cognitive recovery before bedtime.`,
    studyTip: `Skip full execution tonight; review the published solution key during tomorrow's 10-minute warm-up.`,
    redundancyNote: redundantWithTitle
      ? `Covered by "${redundantWithTitle}"`
      : `Low marginal yield tonight`,
  };
}

/**
 * Parses "HH:MM" string into total minutes from midnight (0 - 1439, or wraps past midnight).
 */
export function parseTimeToMinutes(timeStr: string): number {
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length !== 2) return 20 * 60; // default 20:00
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(mins)) return 20 * 60;
  return hours * 60 + mins;
}

/**
 * Formats minutes from midnight into "HH:MM" (24h).
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates max safe minutes available before wind-down + target bedtime.
 */
export function computeSafeStudyWindowMinutes(budget: StudentBudget): number {
  const startMins = parseTimeToMinutes(budget.currentHour);
  let bedMins = parseTimeToMinutes(budget.targetBedtime);
  if (bedMins <= startMins) {
    bedMins += 24 * 60; // crosses midnight
  }
  const totalUntilBed = bedMins - startMins;
  const safeBeforeWindDown = Math.max(0, totalUntilBed - budget.windDownMinutes);
  return Math.min(budget.availableMinutes, safeBeforeWindDown);
}

export type RawExerciseInput = Omit<
  Exercise,
  'id' | 'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'
>;

export type IdentifiableRawExercise = Omit<
  Exercise,
  'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'
>;

function buildExerciseIdentityKey(item: Pick<Exercise, 'course' | 'title'>): string {
  const normCourse = (item.course || 'course assignment').trim().toLowerCase();
  const normTitle = (item.title || '').trim().toLowerCase();
  return `${normCourse}::${normTitle}`;
}

/**
 * Merges newly imported exercises (from a file upload or pasted sheet) with existing exercises.
 * - Deduplicates identical (course, title) entries within the incoming batch.
 * - If an incoming exercise already exists in `existing` (e.g. re-uploading a previously uploaded file),
 *   it replaces the stale entry (resetting `completed: false`) instead of creating duplicate rows
 *   that would poison redundancy scoring and time-budget allocation.
 * - If `mode === 'replace'`, replaces the entire backlog with the newly uploaded batch.
 */
export function mergeImportedExercises(
  incoming: RawExerciseInput[],
  existing: IdentifiableRawExercise[],
  mode: 'merge' | 'replace' = 'merge',
  idPrefix = `bulk-${Date.now()}`
): IdentifiableRawExercise[] {
  const seenIncomingKeys = new Set<string>();
  const deduplicatedIncoming: IdentifiableRawExercise[] = [];

  incoming.forEach((item, idx) => {
    const key = buildExerciseIdentityKey(item);
    if (!item.title.trim() || seenIncomingKeys.has(key)) return;
    seenIncomingKeys.add(key);
    deduplicatedIncoming.push({
      ...item,
      id: `${idPrefix}-${idx}`,
      completed: false,
    });
  });

  if (mode === 'replace' || existing.length === 0) {
    return deduplicatedIncoming;
  }

  // Keep only existing exercises that are NOT being re-imported in this batch
  const remainingExisting = existing.filter(
    (ex) => !seenIncomingKeys.has(buildExerciseIdentityKey(ex))
  );

  return [...deduplicatedIncoming, ...remainingExisting];
}

/**
 * Runs deterministic triage across the student's exercise backlog.
 * Selects the highest-value, non-redundant subset of exercises that fits within the student's safe time budget,
 * accounting for 10-minute restorative breaks every ~50 minutes of deep work.
 */
export function triageExercises(
  exercises: IdentifiableRawExercise[],
  budget: StudentBudget
): Exercise[] {
  if (exercises.length === 0) return [];

  const safeWindowMinutes = computeSafeStudyWindowMinutes(budget);

  // Deduplicate any exact (course, title) collisions in the input list while preserving order
  const uniqueExercises: IdentifiableRawExercise[] = [];
  const seenKeys = new Set<string>();
  for (const ex of exercises) {
    const key = buildExerciseIdentityKey(ex);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueExercises.push(ex);
  }

  // Score all exercises first
  const scored = uniqueExercises.map((ex) => {
    const baseScore = calculatePedagogicalScore(ex, budget);
    return {
      ...ex,
      baseScore,
    };
  });

  // Sort descending by baseScore, then by efficiency (baseScore / estimatedMinutes)
  scored.sort((a, b) => {
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    return b.baseScore / b.estimatedMinutes - a.baseScore / a.estimatedMinutes;
  });

  // Track covered specific topics/courses to penalize repetitive low-complexity drills on the same topic.
  // Do not treat generic placeholders ("general", "core topic") as duplicate topics unless titles match.
  const coveredTopicMap = new Map<string, string>(); // topicKey -> first selected exercise title
  const adjustedList = scored.map((item) => {
    const normalizedTopic = item.topic.trim().toLowerCase();
    const isGenericTopic =
      !normalizedTopic ||
      normalizedTopic === 'general' ||
      normalizedTopic === 'core topic' ||
      normalizedTopic === 'core problem set' ||
      normalizedTopic === 'uploaded document';

    const topicKey = isGenericTopic
      ? `${item.course.toLowerCase()}::title::${item.title.toLowerCase()}`
      : `${item.course.toLowerCase()}::topic::${normalizedTopic}`;

    const existingTitle = coveredTopicMap.get(topicKey);
    let finalScore = item.baseScore;
    let redundantWith: string | undefined = undefined;

    if (
      existingTitle &&
      existingTitle.trim().toLowerCase() !== item.title.trim().toLowerCase()
    ) {
      // Penalize duplicate topic if it's a drill or lower complexity
      finalScore = Math.max(15, item.baseScore - (item.exerciseType === 'Drill' ? 28 : 16));
      redundantWith = existingTitle;
    } else if (!existingTitle) {
      coveredTopicMap.set(topicKey, item.title);
    }

    return {
      ...item,
      pedagogicalScore: finalScore,
      redundantWith,
    };
  });

  // Re-sort after redundancy penalty
  adjustedList.sort((a, b) => b.pedagogicalScore - a.pedagogicalScore);

  let usedStudyMinutes = 0;

  return adjustedList.map((item, idx) => {
    const rank = idx + 1;

    // Already-completed exercises stay selected as accomplished work without consuming remaining evening focus budget
    if (item.completed) {
      const status: TriageStatus = item.pedagogicalScore >= 78 || rank <= 2 ? 'Essential' : 'High-Yield';
      const defaults = buildDefaultRationale(item, status, item.redundantWith);
      return {
        id: item.id,
        title: item.title,
        course: item.course,
        topic: item.topic,
        description: item.description,
        estimatedMinutes: item.estimatedMinutes,
        complexity: item.complexity,
        examRelevance: item.examRelevance,
        exerciseType: item.exerciseType,
        dueDate: item.dueDate,
        completed: true,
        triageStatus: status,
        priorityRank: rank,
        pedagogicalScore: item.pedagogicalScore,
        rationale: defaults.rationale,
        studyTip: defaults.studyTip,
        keyConcepts: item.keyConcepts,
        redundancyNote: defaults.redundancyNote,
      };
    }

    // Account for a 10m break if adding this exercise pushes work past 45m intervals
    const projectedWork = usedStudyMinutes + item.estimatedMinutes;
    const neededBreaks = Math.floor(Math.max(0, projectedWork - 1) / 55) * 10;
    const totalTimeNeeded = projectedWork + neededBreaks;

    let status: TriageStatus;

    if (totalTimeNeeded <= safeWindowMinutes) {
      usedStudyMinutes += item.estimatedMinutes;
      status = item.pedagogicalScore >= 78 || rank <= 2 ? 'Essential' : 'High-Yield';
    } else if (
      usedStudyMinutes === 0 &&
      safeWindowMinutes >= 20
    ) {
      // Always select at least the #1 highest-impact incomplete exercise if the student has at least 20 mins
      usedStudyMinutes += item.estimatedMinutes;
      status = 'Essential';
    } else {
      status = item.pedagogicalScore >= 68 && !item.redundantWith ? 'Optional' : 'Defer';
    }

    const defaults = buildDefaultRationale(item, status, item.redundantWith);

    return {
      id: item.id,
      title: item.title,
      course: item.course,
      topic: item.topic,
      description: item.description,
      estimatedMinutes: item.estimatedMinutes,
      complexity: item.complexity,
      examRelevance: item.examRelevance,
      exerciseType: item.exerciseType,
      dueDate: item.dueDate,
      completed: item.completed,
      triageStatus: status,
      priorityRank: rank,
      pedagogicalScore: item.pedagogicalScore,
      rationale: defaults.rationale,
      studyTip: defaults.studyTip,
      keyConcepts: item.keyConcepts,
      redundancyNote: defaults.redundancyNote,
    };
  });
}

/**
 * Safely merges Gemini AI triage decisions into the exercise list while guaranteeing:
 * 1. Exact ID matching with fallback to normalized title matching (if the LLM altered an ID).
 * 2. Strict 1..N sequential priorityRank numbering with no ties or gaps.
 * 3. Strict adherence to the student's safe study window so AI triage never overloads bedtime.
 */
export function mergeAiTriageDecisions(
  exercises: Exercise[],
  decisions: any[],
  budget: StudentBudget
): Exercise[] {
  if (!Array.isArray(decisions) || decisions.length === 0 || exercises.length === 0) {
    return triageExercises(exercises, budget);
  }

  const byId = new Map<string, any>();
  const byTitle = new Map<string, any>();

  decisions.forEach((d: any) => {
    if (!d || typeof d !== 'object') return;
    if (d.id) byId.set(String(d.id), d);
    if (d.title) byTitle.set(String(d.title).trim().toLowerCase(), d);
  });

  const safeWindowMinutes = computeSafeStudyWindowMinutes(budget);

  const enriched = exercises.map((ex, idx) => {
    const dec =
      byId.get(ex.id) ||
      byTitle.get(ex.title.trim().toLowerCase()) ||
      (decisions.length === exercises.length ? decisions[idx] : undefined);

    if (!dec) return ex;

    const validStatus: TriageStatus = [
      'Essential',
      'High-Yield',
      'Optional',
      'Defer',
    ].includes(dec.triageStatus)
      ? dec.triageStatus
      : ex.triageStatus;

    const score = Number(dec.pedagogicalScore);
    const validScore =
      !isNaN(score) && score >= 10 && score <= 99
        ? Math.round(score)
        : ex.pedagogicalScore;

    const rank = Number(dec.priorityRank);
    const rawRank = !isNaN(rank) && rank >= 1 ? rank : ex.priorityRank;

    return {
      ...ex,
      triageStatus: validStatus,
      priorityRank: rawRank,
      pedagogicalScore: validScore,
      rationale:
        typeof dec.rationale === 'string' && dec.rationale.trim()
          ? dec.rationale.trim()
          : ex.rationale,
      studyTip:
        typeof dec.studyTip === 'string' && dec.studyTip.trim()
          ? dec.studyTip.trim()
          : ex.studyTip,
      redundancyNote:
        typeof dec.redundancyNote === 'string' && dec.redundancyNote.trim()
          ? dec.redundancyNote.trim()
          : ex.redundancyNote,
    };
  });

  // Sort by AI priorityRank ascending, breaking ties by pedagogicalScore descending
  enriched.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return b.pedagogicalScore - a.pedagogicalScore;
  });

  // Enforce budget cap so AI decisions never exceed safeWindowMinutes and normalize priorityRank 1..N
  let usedStudyMinutes = 0;
  return enriched.map((ex, idx) => {
    const normalizedRank = idx + 1;
    if (ex.completed) {
      return { ...ex, priorityRank: normalizedRank };
    }

    const wantsSelection =
      ex.triageStatus === 'Essential' || ex.triageStatus === 'High-Yield';
    const projectedWork = usedStudyMinutes + ex.estimatedMinutes;
    const neededBreaks = Math.floor(Math.max(0, projectedWork - 1) / 55) * 10;
    const totalTimeNeeded = projectedWork + neededBreaks;

    let finalStatus: TriageStatus = ex.triageStatus;

    if (wantsSelection) {
      if (totalTimeNeeded <= safeWindowMinutes) {
        usedStudyMinutes += ex.estimatedMinutes;
      } else if (usedStudyMinutes === 0 && safeWindowMinutes >= 20) {
        usedStudyMinutes += ex.estimatedMinutes;
        finalStatus = 'Essential';
      } else {
        finalStatus = ex.pedagogicalScore >= 68 ? 'Optional' : 'Defer';
      }
    } else if (usedStudyMinutes === 0 && idx === 0 && safeWindowMinutes >= 20) {
      // Ensure at least 1 exercise is selected if the student has >= 20m available
      usedStudyMinutes += ex.estimatedMinutes;
      finalStatus = 'Essential';
    }

    // If status was adjusted to fit budget, ensure rationale matches if it didn't come from AI
    return {
      ...ex,
      triageStatus: finalStatus,
      priorityRank: normalizedRank,
    };
  });
}

/**
 * Builds the evening timeline schedule (study blocks, restorative breaks, wind-down, sleep protection)
 * and computes the overall TriageSummary metrics.
 * Completed exercises remain counted in selected metrics, while only remaining incomplete selected
 * exercises consume upcoming evening timeline blocks.
 */
export function buildStudyScheduleAndSummary(
  exercises: Exercise[],
  budget: StudentBudget,
  customAiInsight?: string
): { schedule: ScheduleBlock[]; summary: TriageSummary } {
  const selected = exercises
    .filter((e) => e.triageStatus === 'Essential' || e.triageStatus === 'High-Yield')
    .sort((a, b) => a.priorityRank - b.priorityRank);

  const activeRemainingSelected = selected.filter((e) => !e.completed);

  const deferred = exercises.filter(
    (e) => e.triageStatus === 'Optional' || e.triageStatus === 'Defer'
  );

  const totalAssignedMinutes = exercises.reduce((acc, e) => acc + e.estimatedMinutes, 0);
  const selectedStudyMinutes = selected.reduce((acc, e) => acc + e.estimatedMinutes, 0);
  const remainingStudyMinutes = activeRemainingSelected.reduce(
    (acc, e) => acc + e.estimatedMinutes,
    0
  );
  const timeSavedMinutes = Math.max(0, totalAssignedMinutes - selectedStudyMinutes);

  // Calculate concept coverage: unique concepts in selected / unique concepts in all exercises
  const allConcepts = new Set<string>();
  const selectedConcepts = new Set<string>();
  exercises.forEach((e) => {
    const concepts =
      e.keyConcepts && e.keyConcepts.length > 0 && e.keyConcepts[0] !== 'Core Concept'
        ? e.keyConcepts
        : [e.topic && e.topic !== 'General' ? e.topic : e.title];
    concepts.forEach((c) => allConcepts.add(c.toLowerCase()));
  });
  selected.forEach((e) => {
    const concepts =
      e.keyConcepts && e.keyConcepts.length > 0 && e.keyConcepts[0] !== 'Core Concept'
        ? e.keyConcepts
        : [e.topic && e.topic !== 'General' ? e.topic : e.title];
    concepts.forEach((c) => selectedConcepts.add(c.toLowerCase()));
  });

  const conceptCoveragePercent =
    allConcepts.size === 0
      ? 0
      : Math.min(100, Math.round((selectedConcepts.size / allConcepts.size) * 100));

  // Build timeline blocks starting from budget.currentHour for remaining incomplete selected exercises
  const schedule: ScheduleBlock[] = [];
  let cursorMins = parseTimeToMinutes(budget.currentHour);
  let minutesSinceBreak = 0;
  let totalBreakMinutes = 0;

  activeRemainingSelected.forEach((ex, index) => {
    // Insert a 10-minute restorative break if we've studied >= 45 minutes and there are more tasks
    if (minutesSinceBreak >= 45) {
      const breakStart = formatMinutesToTime(cursorMins);
      cursorMins += 10;
      const breakEnd = formatMinutesToTime(cursorMins);
      totalBreakMinutes += 10;
      schedule.push({
        id: `break-${index}`,
        startTime: breakStart,
        endTime: breakEnd,
        durationMinutes: 10,
        type: 'break',
        title: 'Cognitive Decompression Break',
        subtitle: 'Step away from screens, hydrate, and reset working memory.',
      });
      minutesSinceBreak = 0;
    }

    const startStr = formatMinutesToTime(cursorMins);
    cursorMins += ex.estimatedMinutes;
    const endStr = formatMinutesToTime(cursorMins);
    minutesSinceBreak += ex.estimatedMinutes;

    schedule.push({
      id: `study-${ex.id}`,
      startTime: startStr,
      endTime: endStr,
      durationMinutes: ex.estimatedMinutes,
      type: 'study',
      title: ex.title,
      subtitle: `${ex.course} · ${ex.topic} (${ex.triageStatus})`,
      exerciseId: ex.id,
      course: ex.course,
    });
  });

  const projectedFinishTime = formatMinutesToTime(cursorMins);

  // Add Wind-Down Block
  if (budget.windDownMinutes > 0) {
    const windStart = formatMinutesToTime(cursorMins);
    cursorMins += budget.windDownMinutes;
    const windEnd = formatMinutesToTime(cursorMins);
    schedule.push({
      id: 'wind-down',
      startTime: windStart,
      endTime: windEnd,
      durationMinutes: budget.windDownMinutes,
      type: 'wind-down',
      title: 'Screen-Free Wind-Down Ritual',
      subtitle: 'Close textbooks, pack tomorrow’s bag, and allow melatonin onset.',
    });
  }

  // Add Sleep Protection Anchor
  const sleepStart = formatMinutesToTime(cursorMins);
  const sleepEnd = formatMinutesToTime(cursorMins + 8 * 60);
  schedule.push({
    id: 'sleep-anchor',
    startTime: sleepStart,
    endTime: sleepEnd,
    durationMinutes: 480,
    type: 'sleep',
    title: 'Protected 8-Hour Sleep Window',
    subtitle: 'Memory consolidation & synaptic recovery phase.',
  });

  const startMins = parseTimeToMinutes(budget.currentHour);
  let targetBedMins = parseTimeToMinutes(budget.targetBedtime);
  if (targetBedMins <= startMins) targetBedMins += 1440;

  const actualBedMins =
    startMins + remainingStudyMinutes + totalBreakMinutes + budget.windDownMinutes;
  const sleepProtected = actualBedMins <= targetBedMins + 15;

  let burnoutRisk: 'Protected' | 'Moderate' | 'Overloaded' = 'Protected';
  if (!sleepProtected || remainingStudyMinutes > 210) {
    burnoutRisk = 'Overloaded';
  } else if (remainingStudyMinutes > 150 || budget.energyLevel === 'Exhausted') {
    burnoutRisk = 'Moderate';
  }

  const exerciseNoun = selected.length === 1 ? 'exercise' : 'exercises';
  const completedCount = selected.length - activeRemainingSelected.length;
  const completedNote =
    completedCount > 0 ? ` (${completedCount} already completed)` : '';

  const defaultInsight =
    exercises.length === 0
      ? 'Upload an assignment file or add your exercises to generate an optimized evening study-rest plan.'
      : `Focusing on ${selected.length} high-leverage ${exerciseNoun}${completedNote} (${selectedStudyMinutes} min total) retains ${conceptCoveragePercent}% of core exam concepts while saving ${timeSavedMinutes} min of repetitive work—protecting your ${budget.targetBedtime} bedtime.`;

  return {
    schedule,
    summary: {
      totalExercises: exercises.length,
      selectedCount: selected.length,
      deferredCount: deferred.length,
      totalAssignedMinutes,
      selectedStudyMinutes,
      breakMinutes: totalBreakMinutes,
      timeSavedMinutes,
      conceptCoveragePercent,
      burnoutRisk,
      projectedFinishTime,
      sleepProtected,
      aiInsight: customAiInsight || defaultInsight,
    },
  };
}
