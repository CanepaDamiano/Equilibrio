# Equilibrio — University Exercise Triage & Study-Rest Planner

**Equilibrio** is a full-stack academic productivity and cognitive load management web application designed for university students. When faced with more assigned problem sets, proofs, and drills than can reasonably fit into a single evening, Equilibrio uses AI and a deterministic pedagogical triage engine to select the highest-impact exercises that fit within the student's available focus window—protecting their sleep schedule and preventing late-night burnout.

---

## Key Features

- **Multi-Format Assignment Import**:
  - Upload problem sheets directly via **PDF (`.pdf`)**, **CSV (`.csv`)**, **JSON (`.json`)**, **Markdown (`.md`)**, **Plain Text (`.txt`)**, or **Images (`.png`, `.jpg`, `.webp`)**.
  - Add individual exercises manually or bulk-paste raw syllabus/assignment text.
- **Hybrid AI & Pedagogical Triage Engine**:
  - Evaluates exercises across **Exam Relevance** (`Critical`, `High`, `Medium`, `Low`), **Complexity** (`1–5`), **Format** (`Proof`, `Past Exam`, `Coding Lab`, `Problem Set`, `Case Study`, `Drill`), and **Estimated Duration**.
  - Automatically detects redundant drills on the same topic and defers low-marginal-yield repetition.
  - Classifies each exercise into `Essential`, `High-Yield`, `Optional`, or `Defer`, complete with a specific **Triage Rationale** and **Execution Study Tip**.
- **Study-Rest Budget & Sleep Protection**:
  - Configure available evening focus time (`30m–240m`), session start time, target bedtime, cognitive energy level (`Fresh`, `Moderate`, `Exhausted`), and prioritization strategy (`Balanced`, `Exam-Focused`, `Deep-Concepts`).
  - Automatically inserts **10-minute cognitive decompression breaks** after every ~45–50 minutes of deep work and reserves a **30-minute screen-free wind-down ritual** before an **8-hour protected sleep window**.
- **Chronological Evening Timeline**:
  - Visualizes the exact proportion of focused study vs. time saved from deferred exercises, alongside a time-blocked schedule from start time to bedtime.
- **Deep-Work Focus Session & Derivation Scratchpad**:
  - Launch a dedicated countdown timer for any selected exercise with its triage rationale, tactical study tip, and a built-in scratchpad for equations and proof outlines.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, native hardware-accelerated CSS animations
- **Backend**: Node.js, Express, Vite middleware (full-stack single-port server on port `3000`)
- **AI Integration**: `@google/genai` SDK (`gemini-4-hydrogen` with structured JSON schemas and multimodal document/image parsing)
- **Testing**: Node.js native test runner (`node:test` + `node:assert/strict` via `tsx`)

---

## Project Structure

```text
├── server.ts                         # Express + Vite server & Gemini API routes
├── index.html                        # HTML entry point & typography setup
├── src/
│   ├── main.tsx                      # React root & error boundary
│   ├── App.tsx                       # Main single-column workspace & state management
│   ├── index.css                     # Tailwind v4 setup & CSS keyframe animations
│   ├── types.ts                      # Core TypeScript interfaces
│   ├── components/
│   │   ├── AddExerciseModal.tsx      # File upload, single item, and bulk text import modal
│   │   ├── EveningTimeline.tsx       # Chronological study-rest schedule & proportion bar
│   │   └── FocusSessionModal.tsx     # Deep-work countdown timer & derivation scratchpad
│   └── utils/
│       ├── triageEngine.ts           # Deterministic pedagogical scoring & schedule builder
│       ├── fileParser.ts             # Client-side CSV, JSON, and text assignment parser
│       └── triageEngine.test.ts      # Unit test suite for triage, schedule, and file parsing
└── package.json
```

---

## Supported File Formats

Equilibrio supports both unstructured documents (parsed via multimodal AI with local fallback) and structured data files:

### 1. CSV Format (`.csv`)
```csv
title,course,topic,estimatedMinutes,complexity,examRelevance,exerciseType
"Prove uniform convergence of Fourier series",Real Analysis,Fourier Analysis,45,5,Critical,Proof
"Routine matrix multiplication drill 1-20",Linear Algebra,Matrix Operations,50,2,Low,Drill
"Derive Bellman optimality equation for MDP",Reinforcement Learning,Dynamic Programming,40,5,Critical,Proof
```

### 2. JSON Format (`.json`)
```json
[
  {
    "title": "Prove uniform convergence of Fourier series",
    "course": "Real Analysis",
    "topic": "Fourier Analysis",
    "estimatedMinutes": 45,
    "complexity": 5,
    "examRelevance": "Critical",
    "exerciseType": "Proof"
  }
]
```

### 3. PDF, Images, Markdown & Plain Text (`.pdf`, `.png`, `.jpg`, `.md`, `.txt`)
Uploaded PDFs, photos/screenshots of problem sheets, and text files are analyzed to extract individual exercises, estimate completion time, and infer complexity and exam relevance.

---

## Getting Started

### Prerequisites
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`
- A **Gemini API Key** (optional; the application automatically falls back to its built-in deterministic pedagogical engine and local file parser if no key is provided).

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd equilibrio
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

### 3. Run in Development Mode
Starts the Express backend and Vite frontend together on `http://localhost:3000`:
```bash
npm run dev
```

### 4. Run Unit Tests
Executes the test suite covering time calculations, pedagogical scoring, redundancy penalties, schedule generation, and file parsing:
```bash
npx tsx --test src/utils/triageEngine.test.ts
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/triage` | Evaluates an array of exercises against the student's `StudentBudget` using `gemini-4-hydrogen` and returns ranked triage decisions, rationales, and study tips. |
| `POST` | `/api/parse-file` | Extracts structured university exercises from uploaded PDFs, images (`base64Data`), or text documents (`textContent`). |
| `POST` | `/api/parse-assignment` | Parses raw pasted assignment or syllabus text into structured exercises with estimated duration and complexity. |

---

## License

Apache-2.0
