import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePedagogicalScore,
  triageExercises,
  buildStudyScheduleAndSummary,
  parseTimeToMinutes,
  formatMinutesToTime,
} from './triageEngine';
import { StudentBudget } from '../types';

const mockBudget: StudentBudget = {
  availableMinutes: 120,
  currentHour: '20:00',
  targetBedtime: '23:00',
  windDownMinutes: 30,
  energyLevel: 'Moderate',
  optimizationMode: 'Balanced',
};

test('parseTimeToMinutes and formatMinutesToTime round-trip accurately', () => {
  assert.equal(parseTimeToMinutes('20:30'), 1230);
  assert.equal(formatMinutesToTime(1230), '20:30');
  assert.equal(formatMinutesToTime(1440 + 45), '00:45');
});

test('calculatePedagogicalScore ranks critical complex proofs higher than low-relevance drills', () => {
  const complexProof = calculatePedagogicalScore(
    {
      complexity: 5,
      examRelevance: 'Critical',
      exerciseType: 'Proof',
      estimatedMinutes: 45,
      keyConcepts: ['Spectral Theorem', 'Orthogonal Projections', 'Eigenvalues'],
    },
    mockBudget
  );

  const routineDrill = calculatePedagogicalScore(
    {
      complexity: 1,
      examRelevance: 'Low',
      exerciseType: 'Drill',
      estimatedMinutes: 30,
      keyConcepts: ['Matrix Addition'],
    },
    mockBudget
  );

  assert.equal(complexProof > routineDrill, true);
  assert.equal(complexProof >= 80, true);
  assert.equal(routineDrill <= 45, true);
});

test('triageExercises respects student time budget and penalizes redundant topic drills', () => {
  const rawExercises = [
    {
      id: 'ex-1',
      title: 'Bellman-Ford Negative Cycle Proof',
      course: 'CS 301 Algorithms',
      topic: 'Shortest Paths',
      description: 'Prove correctness of negative cycle detection in O(VE).',
      estimatedMinutes: 45,
      complexity: 5 as const,
      examRelevance: 'Critical' as const,
      exerciseType: 'Proof' as const,
      dueDate: 'Tomorrow, 10:00',
      completed: false,
      keyConcepts: ['Bellman-Ford', 'Dynamic Programming', 'Negative Cycles'],
    },
    {
      id: 'ex-2',
      title: 'Routine Shortest Path Trace on 5-Node Graph',
      course: 'CS 301 Algorithms',
      topic: 'Shortest Paths',
      description: 'Run manual table trace on small graph.',
      estimatedMinutes: 40,
      complexity: 2 as const,
      examRelevance: 'Low' as const,
      exerciseType: 'Drill' as const,
      dueDate: 'Tomorrow, 10:00',
      completed: false,
      keyConcepts: ['Bellman-Ford'],
    },
    {
      id: 'ex-3',
      title: 'Carnot Cycle Entropy Derivation',
      course: 'PHYS 204 Thermodynamics',
      topic: 'Second Law & Entropy',
      description: 'Derive efficiency bound for non-ideal heat engine.',
      estimatedMinutes: 45,
      complexity: 4 as const,
      examRelevance: 'High' as const,
      exerciseType: 'Problem Set' as const,
      dueDate: 'Friday, 14:00',
      completed: false,
      keyConcepts: ['Entropy', 'Carnot Efficiency'],
    },
    {
      id: 'ex-4',
      title: 'Extra Numerical Substitutions Set B',
      course: 'PHYS 204 Thermodynamics',
      topic: 'Ideal Gas Law',
      description: '20 repetitive unit conversion plug-and-chug items.',
      estimatedMinutes: 60,
      complexity: 1 as const,
      examRelevance: 'Low' as const,
      exerciseType: 'Drill' as const,
      dueDate: 'Next Monday',
      completed: false,
      keyConcepts: ['Unit Conversion'],
    },
  ];

  const triaged = triageExercises(rawExercises, mockBudget);
  assert.equal(triaged.length, 4);

  const selected = triaged.filter(
    (e) => e.triageStatus === 'Essential' || e.triageStatus === 'High-Yield'
  );
  const deferred = triaged.filter(
    (e) => e.triageStatus === 'Optional' || e.triageStatus === 'Defer'
  );

  // Total time is 190m, budget is 120m -> should select 2 high-impact ones (90m + 10m break = 100m <= 120m)
  assert.equal(selected.length, 2);
  assert.equal(deferred.length, 2);
  assert.equal(selected[0].id, 'ex-1');
  assert.equal(selected[1].id, 'ex-3');

  // Verify schedule and summary generation
  const { schedule, summary } = buildStudyScheduleAndSummary(triaged, mockBudget);
  assert.equal(summary.selectedStudyMinutes, 90);
  assert.equal(summary.timeSavedMinutes, 100);
  assert.equal(summary.sleepProtected, true);
  assert.equal(schedule.some((b) => b.type === 'wind-down'), true);
  assert.equal(schedule.some((b) => b.type === 'sleep'), true);
});

import { parseStructuredExerciseFile } from './fileParser';

test('parseStructuredExerciseFile parses CSV, JSON, and plain text exercise files accurately', () => {
  const csvContent = `Title,Course,Topic,Minutes,Complexity,Relevance,Type
Spectral Theorem Proof,Linear Algebra,Eigenvalues,45,5,Critical,Proof
Matrix Addition Worksheet,Linear Algebra,Matrices,30,1,Low,Drill`;

  const fromCsv = parseStructuredExerciseFile(csvContent, 'assignments.csv', 'MATH 201');
  assert.equal(fromCsv.length, 2);
  assert.equal(fromCsv[0].title, 'Spectral Theorem Proof');
  assert.equal(fromCsv[0].estimatedMinutes, 45);
  assert.equal(fromCsv[0].complexity, 5);
  assert.equal(fromCsv[0].examRelevance, 'Critical');
  assert.equal(fromCsv[1].exerciseType, 'Drill');

  const jsonContent = JSON.stringify([
    {
      title: 'Dynamic Programming Knapsack',
      course: 'CS 301',
      topic: 'DP',
      estimatedMinutes: 50,
      complexity: 4,
      examRelevance: 'High',
      exerciseType: 'Coding Lab',
    },
  ]);

  const fromJson = parseStructuredExerciseFile(jsonContent, 'problems.json');
  assert.equal(fromJson.length, 1);
  assert.equal(fromJson[0].title, 'Dynamic Programming Knapsack');
  assert.equal(fromJson[0].exerciseType, 'Coding Lab');

  const txtContent = `1. Prove Bellman-Ford correctness on negative weights (45 min)
2. Routine trace table worksheet on 5 nodes (30 min)`;
  const fromTxt = parseStructuredExerciseFile(txtContent, 'sheet.txt', 'Algorithms');
  assert.equal(fromTxt.length, 2);
  assert.equal(fromTxt[0].exerciseType, 'Proof');
  assert.equal(fromTxt[0].estimatedMinutes, 45);
  assert.equal(fromTxt[1].exerciseType, 'Drill');

  // Verify CSV with quoted commas in title/description
  const quotedCsv = `Title,Course,Topic,Minutes,Complexity,Relevance,Type
"Prove f(x, y) Continuity, Differentiability",Analysis,Multivariable,40,5,Critical,Proof`;
  const fromQuoted = parseStructuredExerciseFile(quotedCsv, 'quoted.csv');
  assert.equal(fromQuoted.length, 1);
  assert.equal(fromQuoted[0].title, 'Prove f(x, y) Continuity, Differentiability');
  assert.equal(fromQuoted[0].estimatedMinutes, 40);
});

test('completed exercises are removed from upcoming evening schedule blocks and generic topics do not collide', () => {
  const genericTopicItems = [
    {
      id: 'g-1',
      title: 'Problem 1: Eigenvalues',
      course: 'Math 101',
      topic: 'General',
      description: '',
      estimatedMinutes: 30,
      complexity: 4 as const,
      examRelevance: 'High' as const,
      exerciseType: 'Problem Set' as const,
      dueDate: 'Upcoming',
      completed: false,
      keyConcepts: ['Problem 1: Eigenvalues'],
    },
    {
      id: 'g-2',
      title: 'Problem 2: Determinants',
      course: 'Math 101',
      topic: 'General',
      description: '',
      estimatedMinutes: 30,
      complexity: 4 as const,
      examRelevance: 'High' as const,
      exerciseType: 'Problem Set' as const,
      dueDate: 'Upcoming',
      completed: true,
      keyConcepts: ['Problem 2: Determinants'],
    },
  ];

  const triaged = triageExercises(genericTopicItems, mockBudget);
  // Neither should be penalized as redundant since topic is generic 'General' and titles differ
  assert.equal(triaged[0].pedagogicalScore, triaged[1].pedagogicalScore);

  const { schedule, summary } = buildStudyScheduleAndSummary(triaged, mockBudget);
  // Both are selected (total 60m), but g-2 is already completed so only g-1 (30m) is in the remaining schedule
  assert.equal(summary.selectedCount, 2);
  assert.equal(summary.selectedStudyMinutes, 60);
  assert.equal(summary.projectedFinishTime, '20:30');
  const studyBlocks = schedule.filter((b) => b.type === 'study');
  assert.equal(studyBlocks.length, 1);
});


