import React, { useState, useRef, useEffect } from 'react';
import {
  ComplexityLevel,
  ExamRelevance,
  Exercise,
  ExerciseType,
} from '../types';
import { parseStructuredExerciseFile } from '../utils/fileParser';
import { X, Plus, FileText, ListPlus, Upload, FileUp, Check } from 'lucide-react';

interface AddExerciseModalProps {
  isOpen: boolean;
  initialTab?: 'file' | 'single' | 'paste';
  onClose: () => void;
  onAddExercise: (
    ex: Omit<
      Exercise,
      'id' | 'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'
    >
  ) => void;
  onBulkAddExercises: (
    list: Omit<
      Exercise,
      'id' | 'triageStatus' | 'priorityRank' | 'pedagogicalScore' | 'rationale' | 'studyTip'
    >[]
  ) => void;
}

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  isOpen,
  initialTab = 'file',
  onClose,
  onAddExercise,
  onBulkAddExercises,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'single' | 'paste'>(initialTab);

  // Sync active tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMsg('');
    }
  }, [isOpen, initialTab]);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCourse, setFileCourse] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Single form state
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(35);
  const [complexity, setComplexity] = useState<ComplexityLevel>(4);
  const [examRelevance, setExamRelevance] = useState<ExamRelevance>('High');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('Problem Set');
  const [dueDate, setDueDate] = useState('');
  const [conceptsInput, setConceptsInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Bulk paste state
  const [rawPasteText, setRawPasteText] = useState('');
  const [pasteCourse, setPasteCourse] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  if (!isOpen) return null;

  const formatServerExercises = (items: any[], fallbackCourse: string) =>
    items.map((item: any) => ({
      title: String(item.title || 'Untitled Exercise'),
      course: String(item.course || fallbackCourse.trim() || 'Course Assignment'),
      topic: String(item.topic || 'General'),
      description: String(item.description || ''),
      estimatedMinutes: Math.min(180, Math.max(10, Number(item.estimatedMinutes) || 35)),
      complexity: (Math.min(5, Math.max(1, Number(item.complexity) || 3)) as ComplexityLevel),
      examRelevance: (['Low', 'Medium', 'High', 'Critical'].includes(item.examRelevance)
        ? item.examRelevance
        : 'High') as ExamRelevance,
      exerciseType: ([
        'Proof',
        'Problem Set',
        'Coding Lab',
        'Case Study',
        'Drill',
        'Past Exam',
      ].includes(item.exerciseType)
        ? item.exerciseType
        : 'Problem Set') as ExerciseType,
      dueDate: String(item.dueDate || 'Upcoming'),
      completed: false,
      keyConcepts: Array.isArray(item.keyConcepts) && item.keyConcepts.length > 0
        ? item.keyConcepts.map(String)
        : ['Core Concept'],
    }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSelectedFile(f);
    setErrorMsg('');
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a file (.pdf, .csv, .json, .txt, .md, or image) to upload.');
      return;
    }

    setErrorMsg('');
    setIsUploadingFile(true);

    const fileName = selectedFile.name;
    const lowerName = fileName.toLowerCase();
    const isTextFormat =
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      selectedFile.type.startsWith('text/') ||
      selectedFile.type === 'application/json';

    try {
      if (isTextFormat) {
        const textContent = await selectedFile.text();
        if (!textContent.trim()) {
          setErrorMsg('The uploaded file is empty.');
          setIsUploadingFile(false);
          return;
        }

        const localParsed = parseStructuredExerciseFile(
          textContent,
          fileName,
          fileCourse.trim() || 'Course Assignment'
        );

        if ((lowerName.endsWith('.csv') || lowerName.endsWith('.json')) && localParsed.length > 0) {
          onBulkAddExercises(localParsed);
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setFileCourse('');
          setIsUploadingFile(false);
          onClose();
          return;
        }

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 25000);
          const response = await fetch('/api/parse-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              mimeType: selectedFile.type || 'text/plain',
              textContent,
              defaultCourse: fileCourse.trim() || 'Course Assignment',
            }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          const data = await response.json();
          if (
            response.ok &&
            data.mode === 'gemini' &&
            Array.isArray(data.exercises) &&
            data.exercises.length > 0
          ) {
            onBulkAddExercises(
              formatServerExercises(data.exercises, fileCourse.trim() || 'Course Assignment')
            );
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setFileCourse('');
            setIsUploadingFile(false);
            onClose();
            return;
          }
        } catch {
          // Fall back to deterministic localParsed
        }

        if (localParsed.length > 0) {
          onBulkAddExercises(localParsed);
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setFileCourse('');
          setIsUploadingFile(false);
          onClose();
          return;
        }

        setErrorMsg('No valid exercises could be found in the file.');
        setIsUploadingFile(false);
      } else {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || '');
            const commaIdx = result.indexOf(',');
            resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(selectedFile);
        });

        const inferredMimeType =
          selectedFile.type ||
          (lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : lowerName.endsWith('.png')
            ? 'image/png'
            : lowerName.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg');

        let extractedFromServer: any[] | null = null;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 25000);
          const response = await fetch('/api/parse-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              mimeType: inferredMimeType,
              base64Data,
              defaultCourse: fileCourse.trim() || 'Course Assignment',
            }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          const data = await response.json();
          if (response.ok && Array.isArray(data.exercises) && data.exercises.length > 0) {
            extractedFromServer = data.exercises;
          }
        } catch {
          // Fall through to deterministic document import fallback
        }

        if (extractedFromServer) {
          onBulkAddExercises(
            formatServerExercises(extractedFromServer, fileCourse.trim() || 'Course Assignment')
          );
        } else {
          const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          onBulkAddExercises([
            {
              title: cleanTitle || 'Uploaded Problem Set',
              course: fileCourse.trim() || 'Course Assignment',
              topic: 'Uploaded Document',
              description: `Imported from ${fileName}`,
              estimatedMinutes: 45,
              complexity: 4,
              examRelevance: 'High',
              exerciseType: 'Problem Set',
              dueDate: 'Upcoming',
              completed: false,
              keyConcepts: [cleanTitle || 'Problem Set'],
            },
          ]);
        }

        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFileCourse('');
        setIsUploadingFile(false);
        onClose();
      }
    } catch {
      setErrorMsg('Failed to process the uploaded file.');
      setIsUploadingFile(false);
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter an exercise title.');
      return;
    }
    if (!course.trim()) {
      setErrorMsg('Please enter the course name.');
      return;
    }

    const parsedConcepts = conceptsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onAddExercise({
      title: title.trim(),
      course: course.trim(),
      topic: topic.trim() || 'General',
      description: description.trim(),
      estimatedMinutes: Number(estimatedMinutes) || 35,
      complexity,
      examRelevance,
      exerciseType,
      dueDate: dueDate.trim() || 'Upcoming',
      completed: false,
      keyConcepts:
        parsedConcepts.length > 0 ? parsedConcepts : [topic.trim() || 'Core Concept'],
    });

    setTitle('');
    setCourse('');
    setTopic('');
    setDescription('');
    setDueDate('');
    setConceptsInput('');
    setErrorMsg('');
    onClose();
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPasteText.trim()) {
      setErrorMsg('Please paste one or more exercises from your assignment sheet.');
      return;
    }
    setErrorMsg('');
    setIsParsing(true);

    const fallbackCourseName = pasteCourse.trim() || 'Course Assignment';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const response = await fetch('/api/parse-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawPasteText,
          defaultCourse: fallbackCourseName,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await response.json();
      if (response.ok && Array.isArray(data.exercises) && data.exercises.length > 0) {
        onBulkAddExercises(formatServerExercises(data.exercises, fallbackCourseName));
        setRawPasteText('');
        setPasteCourse('');
        setIsParsing(false);
        onClose();
        return;
      }
    } catch {
      // Fall back to deterministic parser below
    }

    const localExtracted = parseStructuredExerciseFile(
      rawPasteText,
      'pasted.txt',
      fallbackCourseName
    );
    if (localExtracted.length > 0) {
      onBulkAddExercises(localExtracted);
      setRawPasteText('');
      setPasteCourse('');
      setIsParsing(false);
      onClose();
      return;
    }

    setErrorMsg('Could not extract exercises from the text provided.');
    setIsParsing(false);
  };

  return (
    <div
      className="animate-eq-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-exercise-modal-title"
    >
      <div className="animate-eq-modal w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden">
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2
              id="add-exercise-modal-title"
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              Add Exercises
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Upload an assignment file, enter a single item, or paste text.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="px-6 pb-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'file', label: 'Upload File', icon: Upload },
                { id: 'single', label: 'Single Item', icon: ListPlus },
                { id: 'paste', label: 'Paste Text', icon: FileText },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setErrorMsg('');
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs scale-[1.01]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="animate-eq-fade-up mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700"
          >
            {errorMsg}
          </div>
        )}

        {activeTab === 'file' && (
          <form
            onSubmit={handleFileSubmit}
            className="animate-eq-fade-up space-y-4 p-6 pt-4"
          >
            <div>
              <label
                htmlFor="file-course-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Course Name (optional)
              </label>
              <input
                id="file-course-input"
                type="text"
                value={fileCourse}
                onChange={(e) => setFileCourse(e.target.value)}
                placeholder="Course name for uploaded exercises"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="exercise-file-upload"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Assignment File *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) {
                    setSelectedFile(dropped);
                    setErrorMsg('');
                  }
                }}
                className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center cursor-pointer transition-all duration-200 ${
                  selectedFile
                    ? 'border-teal-600/60 bg-teal-50/20'
                    : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="exercise-file-upload"
                  data-testid="exercise-file-input"
                  type="file"
                  accept=".pdf,.csv,.json,.txt,.md,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                {selectedFile ? (
                  <div className="animate-eq-fade-up flex flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                    <p
                      data-testid="selected-file-name"
                      className="mt-2.5 text-xs font-semibold text-slate-900"
                    >
                      {selectedFile.name}
                    </p>
                    <p className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Click to replace
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200/70 text-slate-600">
                      <FileUp className="h-4 w-4" />
                    </div>
                    <p className="mt-2.5 text-xs font-medium text-slate-900">
                      Click to select a file or drag and drop
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Supports PDF, CSV, JSON, TXT, Markdown, or Image (.png, .jpg)
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingFile}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                {isUploadingFile ? 'Importing File...' : 'Import from File'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'single' && (
          <form
            onSubmit={handleSingleSubmit}
            className="animate-eq-fade-up space-y-4 p-6 pt-4"
          >
            <div>
              <label
                htmlFor="ex-title-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Exercise Title *
              </label>
              <input
                id="ex-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter exercise title"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ex-course-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Course *
                </label>
                <input
                  id="ex-course-input"
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="Course name or code"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="ex-topic-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Topic
                </label>
                <input
                  id="ex-topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Specific topic"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="ex-minutes-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Minutes
                </label>
                <input
                  id="ex-minutes-input"
                  type="number"
                  min={10}
                  max={180}
                  step={5}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="ex-complexity-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Complexity
                </label>
                <select
                  id="ex-complexity-select"
                  value={complexity}
                  onChange={(e) => setComplexity(Number(e.target.value) as ComplexityLevel)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value={1}>1 / 5</option>
                  <option value={2}>2 / 5</option>
                  <option value={3}>3 / 5</option>
                  <option value={4}>4 / 5</option>
                  <option value={5}>5 / 5</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ex-relevance-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Exam Weight
                </label>
                <select
                  id="ex-relevance-select"
                  value={examRelevance}
                  onChange={(e) => setExamRelevance(e.target.value as ExamRelevance)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ex-type-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Format
                </label>
                <select
                  id="ex-type-select"
                  value={exerciseType}
                  onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="Proof">Proof</option>
                  <option value="Problem Set">Problem Set</option>
                  <option value="Past Exam">Past Exam</option>
                  <option value="Coding Lab">Coding Lab</option>
                  <option value="Case Study">Case Study</option>
                  <option value="Drill">Drill</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ex-description-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Notes (optional)
              </label>
              <textarea
                id="ex-description-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief problem description or requirements"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Exercise
              </button>
            </div>
          </form>
        )}

        {activeTab === 'paste' && (
          <form
            onSubmit={handleBulkSubmit}
            className="animate-eq-fade-up space-y-4 p-6 pt-4"
          >
            <div>
              <label
                htmlFor="paste-course-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Course Name
              </label>
              <input
                id="paste-course-input"
                type="text"
                value={pasteCourse}
                onChange={(e) => setPasteCourse(e.target.value)}
                placeholder="Course name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="paste-raw-textarea"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Assignment Text *
              </label>
              <textarea
                id="paste-raw-textarea"
                rows={5}
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder="Paste one exercise per line..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isParsing}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5" />
                {isParsing ? 'Extracting...' : 'Extract & Triage'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
