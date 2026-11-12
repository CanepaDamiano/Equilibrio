import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. AI Triage Endpoint: Evaluates exercises against the student's available time & sleep window
  app.post('/api/triage', async (req, res) => {
    const { exercises, budget } = req.body;

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one exercise to triage.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return res.status(200).json({
        mode: 'deterministic',
        message: 'Using local pedagogical optimization engine.',
        decisions: null,
      });
    }

    try {
      const prompt = `You are an elite university academic advisor and cognitive load specialist.
A university student has the following exercises assigned tonight, but only has ${budget?.availableMinutes || 135} minutes of study time before their ${budget?.targetBedtime || '23:00'} sleep target (starting at ${budget?.currentHour || '20:00'}, with ${budget?.windDownMinutes || 30} minutes of screen-free wind-down before bed; energy level: ${budget?.energyLevel || 'Moderate'}; strategy: ${budget?.optimizationMode || 'Balanced'}).

Select the highest-leverage exercises ('Essential' or 'High-Yield') that maximize conceptual mastery and exam readiness while fitting strictly inside their safe study window (leaving room for a 10-minute break every ~50 minutes). Mark repetitive, low-yield, or redundant exercises as 'Optional' or 'Defer' so the student does not stay up late.

Exercises JSON:
${JSON.stringify(
  exercises.map((e: any) => ({
    id: e.id,
    title: e.title,
    course: e.course,
    topic: e.topic,
    description: e.description,
    estimatedMinutes: e.estimatedMinutes,
    complexity: e.complexity,
    examRelevance: e.examRelevance,
    exerciseType: e.exerciseType,
    keyConcepts: e.keyConcepts,
  })),
  null,
  2
)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Always respond in clear, encouraging, academically rigorous English. Prioritize student sleep health and Pareto (80/20) conceptual efficiency.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiInsight: {
                type: Type.STRING,
                description:
                  'A concise 1-2 sentence executive summary explaining how tonight’s selection maximizes exam readiness while protecting sleep.',
              },
              decisions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    triageStatus: {
                      type: Type.STRING,
                      description: 'Must be one of: Essential, High-Yield, Optional, Defer',
                    },
                    priorityRank: { type: Type.INTEGER },
                    pedagogicalScore: {
                      type: Type.INTEGER,
                      description: 'Score from 10 to 99 indicating learning utility per minute.',
                    },
                    rationale: {
                      type: Type.STRING,
                      description:
                        'Specific academic reason why this exercise is selected for tonight or safely deferred.',
                    },
                    studyTip: {
                      type: Type.STRING,
                      description:
                        'Concrete 1-sentence tactical advice on how to solve or skim this exercise efficiently.',
                    },
                    redundancyNote: {
                      type: Type.STRING,
                      description:
                        'Optional short note if this overlaps with a higher-priority problem.',
                    },
                  },
                  required: [
                    'id',
                    'triageStatus',
                    'priorityRank',
                    'pedagogicalScore',
                    'rationale',
                    'studyTip',
                  ],
                },
              },
            },
            required: ['aiInsight', 'decisions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        mode: 'gemini',
        aiInsight: parsed.aiInsight,
        decisions: parsed.decisions,
      });
    } catch (error: any) {
      console.warn('Gemini triage fallback triggered:', error?.message || error);
      return res.status(200).json({
        mode: 'deterministic',
        message: 'Evaluated using local pedagogical optimization engine.',
        decisions: null,
      });
    }
  });

  // 2. AI Assignment Text Parser Endpoint: Extracts structured exercises from raw pasted syllabus / assignment text
  app.post('/api/parse-assignment', async (req, res) => {
    const { rawText, defaultCourse } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'Please paste assignment text to parse.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      // Deterministic parser when Gemini API key is not configured
      const lines = rawText
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 6);

      const extracted = lines.slice(0, 8).map((line: string, index: number) => {
        const minMatch = line.match(/(\d+)\s*(?:min|m\b|minutes)/i);
        const estimatedMinutes = minMatch ? Math.min(120, Math.max(15, parseInt(minMatch[1], 10))) : 35;
        const isProof = /prove|proof|derive|show that|theorem/i.test(line);
        const isDrill = /drill|table|worksheet|trace|calculate|compute/i.test(line);
        const isExam = /exam|midterm|final|past paper/i.test(line);

        return {
          title: line.replace(/^[-*•\d.)\s]+/, '').slice(0, 95),
          course: defaultCourse || 'UNIV 300 · Imported Course',
          topic: isProof ? 'Theoretical Derivation' : isDrill ? 'Practice Computation' : 'Core Problem Set',
          description: line,
          estimatedMinutes,
          complexity: isProof || isExam ? 5 : isDrill ? 2 : 4,
          examRelevance: isProof || isExam ? 'Critical' : isDrill ? 'Low' : 'High',
          exerciseType: isExam ? 'Past Exam' : isProof ? 'Proof' : isDrill ? 'Drill' : 'Problem Set',
          dueDate: 'Tomorrow, 09:00',
          keyConcepts: [isProof ? 'Formal Proof' : 'Problem Solving'],
        };
      });

      return res.json({ mode: 'deterministic', exercises: extracted });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract individual university exercises from the following raw assignment sheet text. Default course name if not mentioned: "${defaultCourse || 'University Course'}".
CRITICAL LANGUAGE RULE: Do NOT translate the exercises into Italian or any other language. Keep each exercise's title, description, course, topic, and keyConcepts in the EXACT original language as written in the source text.

Raw Text:
${rawText}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Extract each distinct exercise or problem from the student’s pasted assignment text. CRITICAL: Never translate exercise titles, descriptions, topics, or courses into Italian or any other language—always preserve the exact original language and verbatim wording of the source text. Estimate realistic completion minutes (15-90), complexity (1-5), examRelevance (Low, Medium, High, Critical), exerciseType (Proof, Problem Set, Coding Lab, Case Study, Drill, Past Exam), and 1-3 keyConcepts.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description:
                        'The exact title or problem statement in its original language as written in the source text. Never translate.',
                    },
                    course: {
                      type: Type.STRING,
                      description:
                        'The course name in its original language (or defaultCourse). Never translate.',
                    },
                    topic: {
                      type: Type.STRING,
                      description:
                        'The academic topic in the original language of the exercise. Never translate into Italian.',
                    },
                    description: {
                      type: Type.STRING,
                      description:
                        'The verbatim exercise description or instructions in the exact original language of the source text. Never translate.',
                    },
                    estimatedMinutes: { type: Type.INTEGER },
                    complexity: { type: Type.INTEGER },
                    examRelevance: { type: Type.STRING },
                    exerciseType: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    keyConcepts: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description:
                        '1-3 key concepts in the original language of the exercise.',
                    },
                  },
                  required: [
                    'title',
                    'course',
                    'topic',
                    'description',
                    'estimatedMinutes',
                    'complexity',
                    'examRelevance',
                    'exerciseType',
                    'dueDate',
                    'keyConcepts',
                  ],
                },
              },
            },
            required: ['exercises'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ mode: 'gemini', exercises: parsed.exercises || [] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse assignment sheet.' });
    }
  });

  // 3. Multimodal File Upload Endpoint: Extracts exercises from uploaded PDF, images, or text documents
  app.post('/api/parse-file', async (req, res) => {
    const { fileName, mimeType, base64Data, textContent, defaultCourse } = req.body;

    if (!base64Data && !textContent) {
      return res.status(400).json({ error: 'No file content received.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return res.status(200).json({
        mode: 'deterministic',
        exercises: null,
        message: 'Using client-side structured file parser.',
      });
    }

    try {
      const parts: any[] = [];
      if (typeof textContent === 'string' && textContent.trim().length > 0) {
        parts.push({
          text: `Extract all university exercises from the uploaded file "${fileName || 'assignment'}". Default course if not specified: "${defaultCourse || 'Course Assignment'}".
CRITICAL LANGUAGE RULE: Do NOT translate the exercises into Italian or any other language. Preserve the exact original language and verbatim wording of every exercise in the file.

File Content:
${textContent}`,
        });
      } else if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
        parts.push({
          text: `Extract all individual university exercises or problems from this uploaded assignment file ("${fileName || 'document'}"). Default course name if not mentioned in the document: "${defaultCourse || 'Course Assignment'}".
CRITICAL LANGUAGE RULE: Do NOT translate the exercises into Italian or any other language. You MUST keep each exercise's title, description, topic, course, and keyConcepts in the EXACT original language written in the uploaded document.`,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Extract each distinct exercise or problem from the uploaded university assignment file. CRITICAL: Never translate the exercises into Italian or any other language—always preserve the exact original language and verbatim text of the source document for title, description, topic, course, and keyConcepts. Estimate realistic completion minutes (15-90), complexity (1-5), examRelevance (Low, Medium, High, Critical), exerciseType (Proof, Problem Set, Coding Lab, Case Study, Drill, Past Exam), and 1-3 keyConcepts.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description:
                        'The exact title or problem statement in its original language as written in the uploaded file. Never translate.',
                    },
                    course: {
                      type: Type.STRING,
                      description:
                        'The course name in the original language of the document (or defaultCourse). Never translate.',
                    },
                    topic: {
                      type: Type.STRING,
                      description:
                        'The academic topic in the original language of the document. Never translate into Italian.',
                    },
                    description: {
                      type: Type.STRING,
                      description:
                        'The verbatim problem statement or description in the exact original language of the uploaded file. Never translate.',
                    },
                    estimatedMinutes: { type: Type.INTEGER },
                    complexity: { type: Type.INTEGER },
                    examRelevance: { type: Type.STRING },
                    exerciseType: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    keyConcepts: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description:
                        '1-3 key concepts in the original language of the document.',
                    },
                  },
                  required: [
                    'title',
                    'course',
                    'topic',
                    'description',
                    'estimatedMinutes',
                    'complexity',
                    'examRelevance',
                    'exerciseType',
                    'dueDate',
                    'keyConcepts',
                  ],
                },
              },
            },
            required: ['exercises'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ mode: 'gemini', exercises: parsed.exercises || [] });
    } catch (err) {
      return res.status(200).json({
        mode: 'deterministic',
        exercises: null,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (req.url.startsWith('/node_modules/.vite/')) {
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = (name: string, value: any) => {
          if (name.toLowerCase() === 'cache-control') {
            return origSetHeader(name, 'no-cache, no-store, must-revalidate');
          }
          return origSetHeader(name, value);
        };
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Equilibrio server running on http://localhost:${PORT}`);
  });
}

startServer();
