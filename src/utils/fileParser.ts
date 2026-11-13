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
  if (s === 'critical' || s === 'critico' || s === 'critica' || s === 'essenziale') return 'Critical';
  if (s === 'high' || s === 'alta' || s === 'alto') return 'High';
  if (s === 'low' || s === 'bassa' || s === 'basso') return 'Low';
  if (s === 'medium' || s === 'media' || s === 'medio') return 'Medium';
  return 'High';
}

function normalizeExerciseType(val: unknown, fallbackLine = ''): ExerciseType {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'proof' || s === 'dimostrazione' || s === 'teorema') return 'Proof';
  if (s === 'past exam' || s === 'exam' || s === 'esame' || s === 'appello' || s === 'tema d\'esame')
    return 'Past Exam';
  if (s === 'coding lab' || s === 'coding' || s === 'lab' || s === 'laboratorio')
    return 'Coding Lab';
  if (s === 'case study' || s === 'case' || s === 'caso di studio') return 'Case Study';
  if (s === 'drill' || s === ' ripasso' || s === 'calcolo') return 'Drill';
  if (s === 'problem set' || s === 'esercizio' || s === 'problema') return 'Problem Set';

  if (/prove|proof|derive|show that|theorem|dimostra|dimostrare|teorema|dedurre/i.test(fallbackLine))
    return 'Proof';
  if (/exam|midterm|final|past paper|esame|appello|parziale/i.test(fallbackLine))
    return 'Past Exam';
  if (/drill|table|worksheet|trace|tabella|ripetitivo|calcolo base/i.test(fallbackLine))
    return 'Drill';
  if (/code|implement|algorithm|function|implementa|algoritmo|codice/i.test(fallbackLine))
    return 'Coding Lab';
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

const TITLE_HEADERS = [
  'title',
  'exercise',
  'problem',
  'name',
  'question',
  'task',
  'titolo',
  'esercizio',
  'problema',
  'nome',
  'domanda',
  'quesito',
];

const COURSE_HEADERS = ['course', 'subject', 'class', 'corso', 'materia', 'insegnamento'];
const TOPIC_HEADERS = ['topic', 'chapter', 'module', 'argomento', 'capitolo', 'modulo', 'tema'];
const MINUTES_HEADERS = [
  'minutes',
  'estimatedminutes',
  'duration',
  'time',
  'min',
  'minuti',
  'durata',
  'tempo',
];
const COMPLEXITY_HEADERS = [
  'complexity',
  'difficulty',
  'level',
  'complessita',
  'complessità',
  'difficolta',
  'difficoltà',
  'livello',
];
const RELEVANCE_HEADERS = [
  'relevance',
  'examrelevance',
  'weight',
  'priority',
  'rilevanza',
  'peso',
  'priorita',
  'priorità',
];
const TYPE_HEADERS = ['type', 'exercisetype', 'format', 'category', 'tipo', 'formato', 'categoria'];
const DESC_HEADERS = [
  'description',
  'notes',
  'prompt',
  'details',
  'text',
  'descrizione',
  'note',
  'testo',
  'dettagli',
  'consegna',
];

/**
 * Deterministically parses JSON, CSV (including quoted commas & multilingual headers),
 * or plain text / Markdown content from an uploaded exercise file into structured university exercises.
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
            const title = String(
              item.title || item.titolo || item.name || item.problem || item.esercizio || ''
            ).trim();
            if (!title) return null;
            const exType = normalizeExerciseType(
              item.exerciseType || item.type || item.tipo,
              title
            );
            const topic = String(item.topic || item.argomento || 'General').trim();
            return {
              title,
              course: String(item.course || item.corso || cleanCourse).trim(),
              topic,
              description: String(
                item.description || item.descrizione || item.notes || item.note || ''
              ).trim(),
              estimatedMinutes: Math.min(
                180,
                Math.max(
                  10,
                  Number(
                    item.estimatedMinutes ||
                      item.duration ||
                      item.minutes ||
                      item.minuti ||
                      item.durata
                  ) || 35
                )
              ),
              complexity: normalizeComplexity(
                item.complexity || item.complessita || item.difficolta,
                exType
              ),
              examRelevance: normalizeRelevance(
                item.examRelevance || item.relevance || item.rilevanza
              ),
              exerciseType: exType,
              dueDate: String(item.dueDate || item.due || item.scadenza || 'Upcoming').trim(),
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

  // 2. CSV format (.csv or comma/semicolon header row with a recognized header)
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const firstLineDelimiter =
    lines.length > 0 && lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const candidateHeaders =
    lines.length >= 2
      ? splitCsvLine(lines[0], firstLineDelimiter).map((h) => h.toLowerCase().trim())
      : [];
  const detectedTitleIdx = candidateHeaders.findIndex((h) => TITLE_HEADERS.includes(h));

  if (lines.length >= 2 && (lowerName.endsWith('.csv') || detectedTitleIdx !== -1)) {
    const delimiter = firstLineDelimiter;
    const headers = candidateHeaders;
    const titleIdx = detectedTitleIdx !== -1 ? detectedTitleIdx : 0;
    const hasHeaderRow = detectedTitleIdx !== -1 || headers.some((h) => COURSE_HEADERS.includes(h) || MINUTES_HEADERS.includes(h));

    const courseIdx = headers.findIndex((h) => COURSE_HEADERS.includes(h));
    const topicIdx = headers.findIndex((h) => TOPIC_HEADERS.includes(h));
    const minIdx = headers.findIndex((h) => MINUTES_HEADERS.includes(h));
    const compIdx = headers.findIndex((h) => COMPLEXITY_HEADERS.includes(h));
    const relIdx = headers.findIndex((h) => RELEVANCE_HEADERS.includes(h));
    const typeIdx = headers.findIndex((h) => TYPE_HEADERS.includes(h));
    const descIdx = headers.findIndex((h) => DESC_HEADERS.includes(h));

    const startRow = hasHeaderRow ? 1 : 0;
    const results: ImportedExerciseInput[] = [];

    for (let i = startRow; i < lines.length; i++) {
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

  // 3. Plain Text / Markdown problem list (.txt, .md, or unstructured lines)
  // Group numbered/bulleted blocks if multi-line exercises exist
  const rawLines = trimmed.split(/\r?\n/);
  const blocks: string[] = [];
  const itemStartRegex =
    /^(?:[-*•]|\d+[.)\]]|(?:exercise|esercizio|problem|problema|quesito|domanda|ex|es|q)\s*\d*[:.)\-]?)\s+/i;

  const nonHeaderLines = rawLines
    .map((l) => l.trim())
    .filter((l) => !/^#+\s/.test(l));

  const hasExplicitMarkers = nonHeaderLines.some((l) => itemStartRegex.test(l));

  if (hasExplicitMarkers) {
    let currentBlock = '';
    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line || /^#+\s/.test(line)) {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = '';
        }
        continue;
      }
      if (itemStartRegex.test(line)) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = line;
      } else if (currentBlock) {
        currentBlock += ` ${line}`;
      } else if (line.length > 4) {
        currentBlock = line;
      }
    }
    if (currentBlock) blocks.push(currentBlock);
  }

  const effectiveEntries =
    blocks.length > 0
      ? blocks
      : lines.filter((l) => l.length > 4 && !/^#+\s/.test(l));

  return effectiveEntries.slice(0, 25).map((entry) => {
    const minMatch = entry.match(/(\d+)\s*(?:min|m\b|minutes|minuti)/i);
    const estimatedMinutes = minMatch
      ? Math.min(180, Math.max(10, parseInt(minMatch[1], 10)))
      : 35;
    const exType = normalizeExerciseType('', entry);
    const isHighYield = exType === 'Proof' || exType === 'Past Exam';
    const stripped = entry.replace(itemStartRegex, '').replace(/^[-*•\d.)\]]+\s*/, '').trim();
    const firstSentenceEnd = stripped.search(/[.:]\s/);
    const cleanTitle =
      firstSentenceEnd > 10 && firstSentenceEnd <= 95
        ? stripped.slice(0, firstSentenceEnd)
        : stripped.slice(0, 110);

    return {
      title: cleanTitle || stripped.slice(0, 110),
      course: cleanCourse,
      topic:
        exType === 'Proof'
          ? 'Theoretical Proof'
          : exType === 'Drill'
          ? 'Practice Drill'
          : 'Core Topic',
      description: entry,
      estimatedMinutes,
      complexity: normalizeComplexity(undefined, exType),
      examRelevance: isHighYield ? 'Critical' : exType === 'Drill' ? 'Low' : 'High',
      exerciseType: exType,
      dueDate: 'Upcoming',
      completed: false,
      keyConcepts: [cleanTitle || 'Core Concept'],
    };
  });
}
