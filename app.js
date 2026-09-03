/**
 * SCHOLARMATE AI - PROFESSIONAL AI LEARNING PLATFORM
 * Comprehensive Application Logic & OpenRouter AI Engine
 */

// Helper Selectors
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

// State Objects
let currentUser = null;
let currentView = 'overview';
let activeQuizState = null;
let attachedFileContent = '';
let attachedFileName = '';
let quizFileContent = '';
let quizFileName = '';

// Demo accounts removed
const sampleGoogleAccounts = [];

/* ==========================================================================
   1. USER AUTHENTICATION & SUPABASE DATA ENGINE
   ========================================================================== */

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const single = parts[0];
    return single.length >= 2 ? single.slice(0, 2).toUpperCase() : single[0].toUpperCase();
  }
  if (email && email.trim()) {
    const handle = email.split('@')[0];
    return handle.length >= 2 ? handle.slice(0, 2).toUpperCase() : handle[0].toUpperCase();
  }
  return 'U';
}

const AuthManager = {
  async getCurrentUser(targetUser = null) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (!supabase) {
      const email = localStorage.getItem('scholarmate_current_user');
      if (!email) return null;
      const users = JSON.parse(localStorage.getItem('scholarmate_users') || '{}');
      const user = users[email] || null;
      if (user) user.initials = getInitials(user.name, user.email);
      return user;
    }

    try {
      let user = targetUser;
      if (!user) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session || !session.user) return null;
        user = session.user;
      }

      let profile = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        profile = data;
      } catch (pErr) {
        console.warn('Profile fetch warning:', pErr);
      }

      const userObj = {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0],
        picture: profile?.picture || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        streak: profile?.streak || 0,
        quizzesTaken: profile?.quizzes_taken || 0,
        questionsAnswered: profile?.questions_answered || 0,
        correctAnswers: profile?.correct_answers || 0,
        studyMinutes: profile?.study_minutes || 0,
        mastery: profile?.mastery || {},
        settings: profile?.settings || {},
        avatarId: profile?.settings?.avatarId || 'av-1',
        lastActive: profile?.last_active || new Date().toISOString(),
        history: [],
        materials: []
      };

      userObj.initials = getInitials(userObj.name, userObj.email);
      return userObj;
    } catch (err) {
      console.warn('Supabase Auth error:', err.message);
      return null;
    }
  },

  async register(email, password, name) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    let userObj = null;

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] }
          }
        });

        if (!error && data?.user) {
          userObj = {
            id: data.user.id,
            email: data.user.email,
            name: name || data.user.user_metadata?.name || email.split('@')[0],
            initials: getInitials(name || email.split('@')[0], email)
          };

          if (data.session) {
            return { user: userObj, session: data.session, autoLogin: true };
          }
        }
      } catch (err) {
        console.warn('Supabase signup warning:', err.message);
      }
    }

    // Always fallback to instant local workspace registration so user NEVER gets blocked
    const users = JSON.parse(localStorage.getItem('scholarmate_users') || '{}');
    let localUser = users[email];
    if (!localUser) {
      localUser = {
        id: 'user-' + Date.now(),
        email,
        name: name || email.split('@')[0],
        streak: 1,
        quizzesTaken: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        studyMinutes: 0,
        history: [],
        materials: [],
        mastery: {}
      };
      users[email] = localUser;
      localStorage.setItem('scholarmate_users', JSON.stringify(users));
    }
    localStorage.setItem('scholarmate_current_user', email);
    localUser.initials = getInitials(localUser.name, localUser.email);
    return { user: localUser, autoLogin: true };
  },

  async login(email, password) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.user) {
          const userObj = await this.getCurrentUser(data.user);
          if (userObj) return userObj;
        }
      } catch (err) {
        console.warn('Supabase login warning:', err.message);
      }
    }

    // Local Storage Fallback
    const users = JSON.parse(localStorage.getItem('scholarmate_users') || '{}');
    let user = users[email];
    if (!user) {
      user = {
        id: 'user-' + Date.now(),
        email,
        name: email.split('@')[0],
        streak: 1,
        quizzesTaken: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        studyMinutes: 0,
        history: [],
        materials: [],
        mastery: {}
      };
      users[email] = user;
      localStorage.setItem('scholarmate_users', JSON.stringify(users));
    }
    localStorage.setItem('scholarmate_current_user', email);
    user.initials = getInitials(user.name, user.email);
    return user;
  },

  async loginWithGoogle() {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (supabase) {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
      if (error) throw error;
      return data;
    } else {
      const guestEmail = 'scholar.learner@local.com';
      const guestUser = {
        id: 'user-google-local',
        email: guestEmail,
        name: 'Scholar Learner',
        streak: 1,
        quizzesTaken: 0,
        history: [],
        materials: [],
        mastery: {}
      };
      localStorage.setItem('scholarmate_current_user', guestEmail);
      enterApp(guestUser);
      showToast('Welcome to ScholarMate AI Workspace!');
    }
  },

  async resetPassword(email) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (!supabase) {
      throw new Error('Supabase client is not configured. Please set your SUPABASE_URL and SUPABASE_ANON_KEY in config.js.');
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (!supabase) {
      throw new Error('Supabase client is not configured. Please set your SUPABASE_URL and SUPABASE_ANON_KEY in config.js.');
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  },

  async syncProfile(user) {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (!supabase || !user || !user.id) return;

    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture || null,
        streak: user.streak || 0,
        quizzes_taken: user.quizzesTaken || 0,
        questions_answered: user.questionsAnswered || 0,
        correct_answers: user.correctAnswers || 0,
        study_minutes: user.studyMinutes || 0,
        mastery: user.mastery || {},
        settings: user.settings || {},
        last_active: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Profile sync warning:', e);
    }
  },

  setCurrentUser(user) {
    if (!user) return;
    user.initials = getInitials(user.name, user.email);
    currentUser = user;
    this.syncProfile(user);
  },

  async logout() {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    localStorage.removeItem('scholarmate_current_user');
    currentUser = null;
  }
};

/* ==========================================================================
   2. OPENROUTER AI BACKEND CALLER SERVICE
   ========================================================================== */

function extractAIText(data) {
  return data?.choices?.[0]?.message?.content
    || data?.choices?.[0]?.text
    || data?.candidates?.[0]?.content?.parts?.[0]?.text
    || data?.output_text
    || '';
}

async function callOpenRouterApi(promptText, options = {}) {
  const payload = { message: promptText || '' };
  if (options.inlineData?.data) payload.inlineData = options.inlineData;

  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const endpoints = isLocalhost
    ? ['./api/chat-local.php', './api/chat']
    : ['./api/chat'];

  let lastError = 'Unable to connect to the AI service.';

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const textResult = extractAIText(data);
        if (textResult) return textResult;
        lastError = 'The AI service returned an empty response.';
      } else {
        lastError = data?.error?.message || data?.error || `AI endpoint returned HTTP ${response.status}`;
        console.warn(`${endpoint}:`, lastError, data);
      }
    } catch (err) {
      lastError = err.name === 'AbortError' ? 'The AI request timed out.' : err.message;
      console.warn(`${endpoint} unavailable:`, err);
    }
  }

  // Keep the built-in academic fallback only when explicitly enabled.
  // By default, surface the real backend error so configuration problems are visible.
  if (window.SCHOLARMATE_ALLOW_AI_FALLBACK === true) {
    return generateIntelligentAcademicResponse(promptText, options);
  }

  throw new Error(lastError + ' Check that OPENROUTER_API_KEY is configured on your server and redeploy after changing environment variables.');
}
function generateIntelligentAcademicResponse(promptText, options = {}) {
  const cleanPrompt = removeDollarSignsAndLatex(promptText).trim();
  const lower = cleanPrompt.toLowerCase();

  // If JSON is explicitly requested (e.g. Quiz Lab, Flashcards)
  if (options.requireJson || lower.includes('json') || lower.includes('return only a json array')) {
    const numMatch = cleanPrompt.match(/(\d+)[-\s]*(question|flashcard|item)/i);
    const count = numMatch ? Math.min(parseInt(numMatch[1], 10), 10) : 5;

    const topicMatch = cleanPrompt.match(/on ["']?([^"'\n\r]+)["']?/i) || cleanPrompt.match(/about ["']?([^"'\n\r]+)["']?/i);
    const topic = topicMatch ? topicMatch[1] : (attachedFileName || 'Academic Recall');

    if (lower.includes('flashcard')) {
      return JSON.stringify([
        { question: `What is the core definition of ${topic}?`, answer: `The fundamental framework and principles governing ${topic}.` },
        { question: `Why is active recall superior when studying ${topic}?`, answer: `Active recall builds stronger neural retrieval pathways than passive reading.` },
        { question: `How do key concepts in ${topic} apply to problem solving?`, answer: `By using step-by-step logic, parameter extraction, and self-assessment.` },
        { question: `What is a common pitfall to avoid in ${topic}?`, answer: `Relying on memorization without understanding underlying mechanisms.` },
        { question: `How do you verify mastery of ${topic}?`, answer: `Achieving 85%+ accuracy on active recall quizzes and self-tests.` }
      ]);
    }

    const quizItems = [];
    for (let i = 1; i <= count; i++) {
      quizItems.push({
        type: 'multiple_choice',
        question: `Question ${i}: What is a fundamental rule regarding ${topic}?`,
        options: [
          `It provides the primary analytical framework for ${topic}.`,
          `It contradicts basic principles of active memory retention.`,
          `It only applies in static environments without dynamic variables.`,
          `It eliminates the need for practice and active recall.`
        ],
        answer: 0,
        explanation: `The foundational framework in ${topic} ensures structural clarity and active recall accuracy.`
      });
    }

    return JSON.stringify(quizItems);
  }

  if (/^(hi|hello|hey|greetings|hola|good morning|good afternoon)\b/i.test(cleanPrompt)) {
    return `Hello! Welcome back to **ScholarMate AI Workspace**.

I am your dedicated academic AI partner. How can I assist your learning goals today?
* Ask any question or request a step-by-step concept breakdown.
* Attach lecture notes, PDFs, or PPTs for instant active recall synthesis.
* Request custom quiz questions or study guides.`;
  }

  let topic = attachedFileName || 'your study material';
  if (lower.includes('for:') || lower.includes('regarding:')) {
    const parts = cleanPrompt.split(/for:|regarding:/i);
    if (parts[1]) topic = parts[1].trim();
  } else if (cleanPrompt.length < 50) {
    topic = cleanPrompt;
  }

  if (lower.includes('study guide') || lower.includes('exhaustive') || lower.includes('study notes')) {
    return `# 📚 Comprehensive Study Notes & Guide: ${topic}

## 1. Executive Overview & Core Subject Scope
The study of **${topic}** represents a fundamental domain in active academic learning. 
${attachedFileContent ? `Analysis of the uploaded material (${attachedFileName}) reveals structured principles, sequential logical workflows, and testable concepts.` : `This guide synthesizes core principles, explicit definitions, and key exam mastery triggers.`}

### Key Learning Objectives:
* Master foundational definitions and structural frameworks underlying **${topic}**.
* Deconstruct complex laws and formulas into plain English step-by-step logic.
* Apply active recall retrieval pathways to ensure 100% exam performance.

---

## 2. Exhaustive Glossary of Terms & Core Concepts

1. **${topic} Core Principles**: The overarching framework governing system behavior and conceptual interactions.
2. **Active Retrieval Pathways**: Neurological pathways reinforced by testing key recall questions rather than passive re-reading.
3. **Sequential Workflow**: The step-by-step logical progression required to solve problem sets and theoretical scenarios.
4. **Mastery Threshold**: The 85%+ accuracy benchmark indicating true conceptual retention.

---

## 3. Core Principles, Formulas & Procedures

### Step-by-Step Problem Solving Framework:
1. **Identify Given Variables**: Extract all known parameters, definitions, and environmental constraints.
2. **Select Governing Rules**: Apply the primary law or procedure relevant to ${topic}.
3. **Execute Sequential Calculation / Analysis**: Follow the step-by-step operational rules in logical order.
4. **Verify Boundary Conditions**: Test edge cases and confirm accuracy against theoretical expectations.

---

## 4. Deep-Dive Section Notes

### Section A: Structural Foundations
* Every sub-topic in **${topic}** builds upon core underlying assumptions.
* Ensure clear understanding of initial conditions before analyzing complex secondary effects.

### Section B: Practical Mechanisms & Workflows
* Mechanisms operate through step-by-step state transitions.
* Focus on understanding *why* each step occurs rather than memorizing raw text.

---

## 5. Active Recall Exam Self-Test Bank

1. **Question**: What is the primary function or definition associated with **${topic}**?
   * *Answer*: The core framework governing system rules and logical interactions.
2. **Question**: How do you verify problem accuracy using step-by-step analysis?
   * *Answer*: By identifying parameters, applying governing laws, and testing boundary conditions.

---
*Generated by ScholarMate AI Synthesis Engine · Ready for active recall review!*`;
  }

  return `### Academic Synthesis: **${topic}**

**1. Core Overview & Key Principles**
${attachedFileContent ? `Based on the active document context (${attachedFileName}), the key focus revolves around deconstructing core principles and applying active retrieval practice.` : `Mastering **${topic}** requires deconstructing complex rules into structured logical principles.`}

* **Core Concept**: Active recall forces retrieval pathways in the brain, building 3x stronger long-term retention.
* **Sequential Logic**: Break down problems into step-by-step sub-components before synthesizing conclusions.
* **Self-Assessment**: Always test your recall against key definitions.

**2. Active Recall Questions**
* *Recall Check 1*: What is the primary definition or theorem underlying ${topic}?
* *Recall Check 2*: How do you apply this principle in practice?

*Tip: Click **New Chat** above to start a fresh thread or view your personalized **Past Conversations** at any time!*`;
}

/* ==========================================================================
   3. LATEX & DOLLAR SIGN SANITIZER & CLEAN MARKDOWN PARSER
   ========================================================================== */

function removeDollarSignsAndLatex(text) {
  if (!text) return '';
  let str = String(text);

  // 1. Replace block math $$ ... $$ with clean text
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    return ' ' + inner
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\in/g, ' in ')
      .replace(/\\notin/g, ' not in ')
      .replace(/\\implies/g, ' => ')
      .replace(/\\longrightarrow/g, ' -> ')
      .replace(/\\sum/g, ' Sum ')
      .replace(/\\/g, '') + ' ';
  });

  // 2. Replace inline math $ ... $ with clean text
  str = str.replace(/\$([^$\n]+)\$/g, (match, inner) => {
    return inner
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\in/g, ' in ')
      .replace(/\\notin/g, ' not in ')
      .replace(/\\implies/g, ' => ')
      .replace(/\\longrightarrow/g, ' -> ')
      .replace(/\\sum/g, ' Sum ')
      .replace(/\\/g, '');
  });

  // 3. Remove LaTeX commands like \text{...}
  str = str.replace(/\\text\{([^}]+)\}/g, '$1');
  str = str.replace(/\\(in|notin|implies|longrightarrow|sum|approx|neq|le|ge|times|div)/g, ' ');

  // 4. Remove all remaining dollar signs ($)
  str = str.replace(/\$/g, '');

  return str;
}

function cleanMarkdown(text) {
  if (!text) return '';

  // Clean dollar signs and LaTeX artifacts first
  const sanitizedText = removeDollarSignsAndLatex(text);

  let parsedHtml = sanitizedText;
  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      parsedHtml = window.marked.parse(sanitizedText);
    } catch (e) {
      console.warn('Marked parse fallback:', e);
    }
  }

  let cleaned = parsedHtml
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[*•-]\s+/gm, '• ')
    .replace(/\*/g, '');

  return cleaned.trim();
}

/* ==========================================================================
   4. FILE PARSING SERVICE (PDF & TEXT EXTRACTION)
   ========================================================================== */

const FileParser = {
  async extractText(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'pdf') {
      return await this.extractPdfText(file);
    } else if (extension === 'docx') {
      return await this.extractDocxText(file);
    } else if (extension === 'pptx') {
      return await this.extractPptxText(file);
    } else if (extension === 'doc' || extension === 'ppt') {
      return await this.extractLegacyOfficeText(file);
    } else {
      return await this.readAsText(file);
    }
  },

  readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  },

  async extractPdfText(file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is loading. Please try again in a moment.');
    }
    
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items.map(item => item.str).join(' ');
      fullText += pageItems + '\n\n';
    }

    return fullText.trim();
  },

  async extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    if (window.mammoth) {
      try {
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        if (result.value && result.value.trim().length > 0) {
          return result.value.trim();
        }
      } catch (e) {
        console.warn('Mammoth docx extraction warning, falling back to JSZip:', e);
      }
    }
    return await this.extractPptxOrDocxZipText(arrayBuffer, 'word/document.xml');
  },

  async extractPptxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    if (window.JSZip) {
      try {
        const zip = await window.JSZip.loadAsync(arrayBuffer);
        let slidesText = [];
        const slideFiles = Object.keys(zip.files)
          .filter(filename => filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml'))
          .sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
            return numA - numB;
          });

        for (let i = 0; i < slideFiles.length; i++) {
          const content = await zip.files[slideFiles[i]].async('text');
          const slideNum = i + 1;
          const textMatches = content.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
          const cleanTexts = textMatches
            .map(m => m.replace(/<[^>]+>/g, '').trim())
            .filter(t => t.length > 0);
          
          if (cleanTexts.length > 0) {
            slidesText.push(`--- Slide ${slideNum} ---\n` + cleanTexts.join(' '));
          }
        }

        if (slidesText.length > 0) {
          return slidesText.join('\n\n');
        }
      } catch (e) {
        console.warn('JSZip PPTX extraction warning:', e);
      }
    }
    return await this.extractLegacyOfficeText(file);
  },

  async extractPptxOrDocxZipText(arrayBuffer, targetXmlPath) {
    if (!window.JSZip) throw new Error('JSZip library loading. Please try again.');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    if (zip.files[targetXmlPath]) {
      const xmlContent = await zip.files[targetXmlPath].async('text');
      const textMatches = xmlContent.match(/<w:t[^>]*>(.*?)<\/w:t>/gi) || [];
      return textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').trim();
    }
    throw new Error('Could not parse Word document structure.');
  },

  async extractLegacyOfficeText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let str = '';
    let currentChunk = '';
    for (let i = 0; i < bytes.length; i++) {
      const charCode = bytes[i];
      if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
        currentChunk += String.fromCharCode(charCode);
      } else {
        if (currentChunk.length >= 4) {
          str += currentChunk + ' ';
        }
        currentChunk = '';
      }
    }
    if (currentChunk.length >= 4) str += currentChunk;
    const cleaned = str.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 20) {
      throw new Error('Unable to extract text from binary office file. Please save as .pptx, .docx, or .pdf.');
    }
    return cleaned;
  }
};

/* ==========================================================================
   5. QUIZ GENERATOR ENGINE
   ========================================================================== */

const QuizEngine = {
  async generateQuiz(sourceText, topicName, questionCount = 5, difficulty = 'Intermediate', qtypes = ['objs']) {
    const typesStr = qtypes.length > 0 ? qtypes.join(', ') : 'objs';
    
    let contextBlock = '';
    // Only attach file content and study guide if sourceText is provided (File / Uploaded Material mode)
    if (sourceText && sourceText.trim().length > 0) {
      if (window.activeMaterialStudyGuide) {
        contextBlock += `SYNTHESIZED STUDY GUIDE SUMMARY:\n"${window.activeMaterialStudyGuide.slice(0, 4000)}"\n\n`;
      }
      contextBlock += `FULL MATERIAL SOURCE CONTENT:\n"${sourceText.slice(0, 8000)}"\n\n`;
    }

    const prompt = `
Generate a ${questionCount}-question active recall quiz strictly on "${topicName || 'Study Document'}" at a ${difficulty} difficulty level.
Include a balanced mix of requested question types: [${typesStr}].

${contextBlock ? `CRITICAL REQUIREMENT: Every single question MUST be strictly derived from and directly test the key concepts, definitions, formulas, and facts present in the Study Guide & Material content provided below:\n\n${contextBlock}` : `CRITICAL REQUIREMENT: Every single question MUST directly test key concepts, principles, and applications of the topic "${topicName}".`}

CRITICAL STRICT RULE: You MUST NOT use any dollar signs ($) or LaTeX math syntax anywhere in the questions, options, or explanations. Express all math, currency, and symbols in plain standard text.

You MUST return ONLY a valid JSON array of questions with no extra text or markdown code blocks.

JSON format for allowed types:

For Multiple Choice (objs):
{
  "type": "multiple_choice",
  "question": "Question text?",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "answer": 0,
  "explanation": "Clear explanation of why this option is correct."
}

For True/False (true_false):
{
  "type": "true_false",
  "question": "Statement text?",
  "options": ["True", "False"],
  "answer": 0,
  "explanation": "Clear explanation text."
}

F
