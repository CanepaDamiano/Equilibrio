import { ComplexityLevel, ExamRelevance, Exercise, ExerciseType } from '../types';

export type ImportedExerciseInput = Omit<
  Exercise,
  'id' | 'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'
>;

/**
 * Splits a single CSV line into fields while respecting double-quoted values containing commas/semicolons.
 */
export function splitCsvLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^['"]|['"]$/g, '').trim());
}

function normalizeRelevance(val: unknown): ExamRelevance {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'critical') return 'Critical';
  if (s === 'high') return 'High';
  if (s === 'low') return 'Low';
  if (s === 'medium') return 'Medium';
  return 'High';
}

function normalizeExerciseType(val: unknown, fallbackLine = ''): ExerciseType {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'proof') return 'Proof';
  if (s === 'past exam' || s === 'exam') return 'Past Exam';
  if (s === 'coding lab' || s === 'coding' || s === 'lab') return 'Coding Lab';
  if (s === 'case study' || s === 'case') return 'Case Study';
  if (s === 'drill') return 'Drill';
  if (s === 'problem set') return 'Problem Set';

  if (/prove|proof|derive|show that|theorem/i.test(fallbackLine)) return 'Proof';
  if (/exam|midterm|final|past paper/i.test(fallbackLine)) return 'Past Exam';
  if (/drill|table|worksheet|trace/i.test(fallbackLine)) return 'Drill';
  if (/code|implement|algorithm|function/i.test(fallbackLine)) return 'Coding Lab';
  return 'Problem Set';
}

function normalizeComplexity(val: unknown, type: ExerciseType): ComplexityLevel {
  const n = Number(val);
  if (!isNaN(n) && n >= 1 && n <= 5) {
    return Math.round(n) as ComplexityLevel;
  }
  if (type === 'Proof' || type === 'Past Exam') return 5;
  if (type === 'Drill') return 2;
  return 4;
}

/**
 * Deterministically parses JSON, CSV (including quoted commas), or plain text / Markdown content
 * from an uploaded exercise file into structured university exercises.
 */
export function parseStructuredExerciseFile(
  content: string,
  fileName: string,
  defaultCourse = 'Course Assignment'
): ImportedExerciseInput[] {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];

  const cleanCourse = defaultCourse.trim() || 'Course Assignment';
  const lowerName = fileName.toLowerCase();

  // 1. JSON format (.json or starts with [ / {)
  if (lowerName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.exercises)
        ? parsed.exercises
        : Array.isArray(parsed.items)
        ? parsed.items
        : [];
      if (arr.length > 0) {
        return arr
          .map((item: any) => {
            const title = String(item.title || item.name || item.problem || '').trim();
            if (!title) return null;
            const exType = normalizeExerciseType(item.exerciseType || item.type, title);
            const topic = String(item.topic || 'General').trim();
            return {
              title,
              course: String(item.course || cleanCourse).trim(),
              topic,
              description: String(item.description || item.notes || '').trim(),
              estimatedMinutes: Math.min(
                180,
                Math.max(10, Number(item.estimatedMinutes || item.duration || item.minutes) || 35)
              ),
              complexity: normalizeComplexity(item.complexity, exType),
              examRelevance: normalizeRelevance(item.examRelevance || item.relevance),
              exerciseType: exType,
              dueDate: String(item.dueDate || item.due || 'Upcoming').trim(),
              completed: false,
              keyConcepts: Array.isArray(item.keyConcepts)
                ? item.keyConcepts.map(String)
                : [topic !== 'General' ? topic : title],
            };
          })
          .filter((x: ImportedExerciseInput | null): x is ImportedExerciseInput => x !== null);
      }
    } catch {
      // Fall through to line/CSV parser if JSON is invalid
    }
  }

  // 2. CSV format (.csv or comma/semicolon header row with title)
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (
    lines.length >= 2 &&
    (lowerName.endsWith('.csv') || /^(?:["']?title["']?|["']?exercise["']?)\s*[,;]/i.test(lines[0]))
  ) {
    const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
    const headers = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());

    const titleIdx = headers.findIndex((h) =>
      ['title', 'exercise', 'problem', 'name'].includes(h)
    );

    if (titleIdx !== -1) {
      const courseIdx = headers.findIndex((h) => ['course', 'subject', 'class'].includes(h));
      const topicIdx = headers.findIndex((h) => ['topic', 'chapter', 'module'].includes(h));
      const minIdx = headers.findIndex((h) =>
        ['minutes', 'estimatedminutes', 'duration', 'time'].includes(h)
      );
      const compIdx = headers.findIndex((h) => ['complexity', 'difficulty'].includes(h));
      const relIdx = headers.findIndex((h) =>
        ['relevance', 'examrelevance', 'weight', 'priority'].includes(h)
      );
      const typeIdx = headers.findIndex((h) => ['type', 'exercisetype', 'format'].includes(h));
      const descIdx = headers.findIndex((h) =>
        ['description', 'notes', 'prompt', 'details'].includes(h)
      );

      const results: ImportedExerciseInput[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i], delimiter);
        const rowTitle = cols[titleIdx];
        if (!rowTitle) continue;

        const rawType = typeIdx !== -1 ? cols[typeIdx] : '';
        const exType = normalizeExerciseType(rawType, rowTitle);
        const rawMins = minIdx !== -1 ? parseInt(cols[minIdx], 10) : 35;
        const rowTopic = (topicIdx !== -1 && cols[topicIdx]) || 'General';

        results.push({
          title: rowTitle,
          course: (courseIdx !== -1 && cols[courseIdx]) || cleanCourse,
          topic: rowTopic,
          description: (descIdx !== -1 && cols[descIdx]) || '',
          estimatedMinutes: !isNaN(rawMins) ? Math.min(180, Math.max(10, rawMins)) : 35,
          complexity: normalizeComplexity(compIdx !== -1 ? cols[compIdx] : undefined, exType),
          examRelevance: normalizeRelevance(relIdx !== -1 ? cols[relIdx] : 'High'),
          exerciseType: exType,
          dueDate: 'Upcoming',
          completed: false,
          keyConcepts: [rowTopic !== 'General' ? rowTopic : rowTitle],
        });
      }
      if (results.length > 0) return results;
    }
  }

  // 3. Plain Text / Markdown problem list (.txt, .md, or unstructured lines)
  return lines
    .filter((l) => l.length > 4 && !/^#+\s/.test(l))
    .slice(0, 25)
    .map((line) => {
      const minMatch = line.match(/(\d+)\s*(?:min|m\b|minutes)/i);
      const estimatedMinutes = minMatch
        ? Math.min(180, Math.max(10, parseInt(minMatch[1], 10)))
        : 35;
      const exType = normalizeExerciseType('', line);
      const isHighYield = exType === 'Proof' || exType === 'Past Exam';
      const cleanTitle = line.replace(/^[-*•\d.)\]]+\s*/, '').slice(0, 110);

      return {
        title: cleanTitle,
        course: cleanCourse,
        topic:
          exType === 'Proof'
            ? 'Theoretical Proof'
            : exType === 'Drill'
            ? 'Practice Drill'
            : 'Core Topic',
        description: line,
        estimatedMinutes,
        complexity: normalizeComplexity(undefined, exType),
        examRelevance: isHighYield ? 'Critical' : exType === 'Drill' ? 'Low' : 'High',
        exerciseType: exType,
        dueDate: 'Upcoming',
        completed: false,
        keyConcepts: [cleanTitle],
      };
    });
}
