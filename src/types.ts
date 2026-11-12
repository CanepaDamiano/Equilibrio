export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;
export type ExamRelevance = 'Low' | 'Medium' | 'High' | 'Critical';
export type TriageStatus = 'Essential' | 'High-Yield' | 'Optional' | 'Defer';
export type ExerciseType = 'Proof' | 'Problem Set' | 'Coding Lab' | 'Case Study' | 'Drill' | 'Past Exam';

export interface Exercise {
  id: string;
  title: string;
  course: string;
  topic: string;
  description: string;
  estimatedMinutes: number;
  complexity: ComplexityLevel;
  examRelevance: ExamRelevance;
  exerciseType: ExerciseType;
  dueDate: string; // e.g., 'Tomorrow, 09:00' or 'In 2 days'
  completed: boolean;
  // Triage fields (computed by AI or deterministic optimization engine)
  triageStatus: TriageStatus;
  priorityRank: number;
  pedagogicalScore: number; // 0-100 composite utility score
  rationale: string;
  studyTip: string;
  keyConcepts: string[];
  redundancyNote?: string;
}

export interface StudentBudget {
  availableMinutes: number; // e.g. 150 mins (2h 30m)
  currentHour: string; // e.g. "20:00"
  targetBedtime: string; // e.g. "23:00"
  windDownMinutes: number; // e.g. 30 mins before sleep
  energyLevel: 'Fresh' | 'Moderate' | 'Exhausted';
  optimizationMode: 'Balanced' | 'Exam-Focused' | 'Deep-Concepts';
}

export interface ScheduleBlock {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: 'study' | 'break' | 'wind-down' | 'sleep';
  title: string;
  subtitle: string;
  exerciseId?: string;
  course?: string;
}

export interface TriageSummary {
  totalExercises: number;
  selectedCount: number;
  deferredCount: number;
  totalAssignedMinutes: number;
  selectedStudyMinutes: number;
  breakMinutes: number;
  timeSavedMinutes: number;
  conceptCoveragePercent: number;
  burnoutRisk: 'Protected' | 'Moderate' | 'Overloaded';
  projectedFinishTime: string;
  sleepProtected: boolean;
  aiInsight: string;
}

export interface CoursePack {
  id: string;
  name: string;
  department: string;
  description: string;
  exercises: Omit<Exercise, 'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'>[];
}
