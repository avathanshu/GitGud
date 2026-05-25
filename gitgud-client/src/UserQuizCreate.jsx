// UserQuizCreate.jsx
// Rewritten to support 4 question types per question slot:
//   video_mc   — YouTube embed, pauses at a second, 4-option multiple choice (original)
//   text_mc    — Plain text question with 4-option multiple choice, no video
//   rank       — Drag-and-drop ranking (text items only, no image uploads for users)
//   enter_value — Free-text answer with flexible numeric/text matching
//
// INVEST / SOLID:
//   S – Each question type editor is its own function
//   O – New types added by registering in USER_Q_TYPE_META + USER_Q_EDITORS
//   L – All editors share (question, index, onChange, errors) props
//   D – Firebase write isolated to handleSubmit
//
// Gherkin:
//   Given the user navigates to /user-quiz/create
//   When Step 1 loads
//   Then they see 4 question type pills to choose from
//
//   Given the user picks "YouTube Video" type
//   When they enter a valid YouTube URL
//   Then a live preview is shown and pauseAt field appears
//
//   Given the user picks "Rank Items" type
//   When they add items
//   Then they can drag to set the correct order
//
//   Given the user picks "Enter Value" type
//   When they set the correct answer to "$4000"
//   Then players who answer "4000" or "4,000" are also marked correct

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./UserQuizCreate.css";

// ── Supported games ────────────────────────────────────────────────────────────
const GAMES = [
  { id: "valorant", label: "Valorant" },
  { id: "cs2",     label: "Counter-Strike 2" },
  { id: "other",   label: "Other" },
];

// ── Question type metadata ─────────────────────────────────────────────────────
export const USER_Q_TYPES = {
  VIDEO_MC:    "video_mc",
  TEXT_MC:     "text_mc",
  RANK:        "rank",
  ENTER_VALUE: "enter_value",
};

const USER_Q_TYPE_META = {
  [USER_Q_TYPES.VIDEO_MC]:    { label: "YouTube Video",  hint: "Embed a clip — video pauses at a moment, players choose A B C D" },
  [USER_Q_TYPES.TEXT_MC]:     { label: "Multiple Choice", hint: "Text question with 4 answer options, no video needed" },
  [USER_Q_TYPES.RANK]:        { label: "Rank Items",      hint: "Players drag text cards into the correct order" },
  [USER_Q_TYPES.ENTER_VALUE]: { label: "Enter the Value", hint: "Players type a number or text answer" },
};

// ── Default question factories ─────────────────────────────────────────────────
function makeVideoMcQuestion() {
  return { type: USER_Q_TYPES.VIDEO_MC, ytUrl: "", videoId: null, videoTitle: "", pauseAt: "", question: "", correctAnswer: "", fakeAnswers: ["", "", ""], reason: "" };
}
function makeTextMcQuestion() {
  return { type: USER_Q_TYPES.TEXT_MC, question: "", correctAnswer: "", fakeAnswers: ["", "", ""], reason: "" };
}
function makeRankQuestion() {
  return { type: USER_Q_TYPES.RANK, question: "", items: ["", "", "", ""], correctOrder: [0, 1, 2, 3], reason: "" };
}
function makeEnterValueQuestion() {
  return { type: USER_Q_TYPES.ENTER_VALUE, question: "", correctAnswer: "", reason: "" };
}

const QUESTION_FACTORIES = {
  [USER_Q_TYPES.VIDEO_MC]:    makeVideoMcQuestion,
  [USER_Q_TYPES.TEXT_MC]:     makeTextMcQuestion,
  [USER_Q_TYPES.RANK]:        makeRankQuestion,
  [USER_Q_TYPES.ENTER_VALUE]: makeEnterValueQuestion,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = String(url).trim().match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch { return null; }
}

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="uqc-tooltip-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onClick={() => setVisible(v => !v)}>
      <span className="uqc-tooltip-icon">?</span>
      {visible && <span className="uqc-tooltip-box">{text}</span>}
    </span>
  );
}

// ── YouTube IFrame loader ──────────────────────────────────────────────────────
let ytApiReady = false;
let ytApiCallbacks = [];
function loadYouTubeApi() {
  if (ytApiReady || (window.YT && window.YT.Player)) { ytApiReady = true; return Promise.resolve(); }
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => { ytApiReady = true; ytApiCallbacks.forEach(cb => cb()); ytApiCallbacks = []; };
    }
  });
}

function VideoPreview({ videoId }) {
  const divRef = useRef(null);
  const playerRef = useRef(null);
  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    loadYouTubeApi().then(() => {
      if (!alive || !divRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} }
      playerRef.current = new window.YT.Player(divRef.current, { videoId, playerVars: { autoplay: 0, rel: 0, modestbranding: 1 } });
    });
    return () => { alive = false; if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; } };
  }, [videoId]);
  return <div className="uqc-preview-wrap"><div ref={divRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} /></div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Question editors ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// Shared MC answer fields (used by both video_mc and text_mc)
function McAnswerFields({ q, onChange, errors, prefix }) {
  return (
    <>
      <label className="uqc-label" style={{ marginTop: 16 }}>
        Correct Answer <Tooltip text="The one right answer. Be specific." />
      </label>
      <input className={`uqc-input ${errors[`${prefix}_correct`] ? "error" : ""}`}
        placeholder="e.g. Peek with blastpack"
        value={q.correctAnswer}
        onChange={e => onChange({ ...q, correctAnswer: e.target.value })} />
      {errors[`${prefix}_correct`] && <p className="uqc-error">{errors[`${prefix}_correct`]}</p>}

      <label className="uqc-label" style={{ marginTop: 14 }}>
        3 Wrong Answers <Tooltip text="Three believable but incorrect options. Make them plausible." />
      </label>
      {q.fakeAnswers.map((fa, i) => (
        <input key={i}
          className={`uqc-input uqc-fake-input ${errors[`${prefix}_fakes`] ? "error" : ""}`}
          placeholder={`Wrong answer ${i + 1}`}
          value={fa}
          onChange={e => { const u = [...q.fakeAnswers]; u[i] = e.target.value; onChange({ ...q, fakeAnswers: u }); }} />
      ))}
      {errors[`${prefix}_fakes`] && <p className="uqc-error">{errors[`${prefix}_fakes`]}</p>}

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Explanation <Tooltip text="Shown after players answer. Explain the reasoning." />
      </label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={3} placeholder="Why is the correct answer right?"
        value={q.reason}
        onChange={e => onChange({ ...q, reason: e.target.value })} />
      {errors[`${prefix}_reason`] && <p className="uqc-error">{errors[`${prefix}_reason`]}</p>}
    </>
  );
}

// Video MC editor
function VideoMcEditor({ question: q, index, onChange, errors }) {
  const prefix = `q${index}`;
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = extractYouTubeId(q.ytUrl);
    if (id && id !== q.videoId) {
      onChange({ ...q, videoId: id });
      setChecking(true);
      fetchVideoTitle(id).then(t => { onChange(prev => ({ ...prev, videoTitle: t ?? "" })); setChecking(false); });
    } else if (!id && q.videoId) {
      onChange({ ...q, videoId: null, videoTitle: "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.ytUrl]);

  return (
    <div className="uqc-qeditor">
      <label className="uqc-label">YouTube URL or Video ID <Tooltip text="Paste the full YouTube link or raw video ID." /></label>
      <input className={`uqc-input ${errors[`${prefix}_ytUrl`] ? "error" : ""}`}
        placeholder="https://youtube.com/watch?v=..."
        value={q.ytUrl}
        onChange={e => onChange({ ...q, ytUrl: e.target.value })} />
      {errors[`${prefix}_ytUrl`] && <p className="uqc-error">{errors[`${prefix}_ytUrl`]}</p>}
      {checking && <p className="uqc-hint">Checking video...</p>}
      {q.videoTitle && !checking && <p className="uqc-hint uqc-hint-success">Found: {q.videoTitle}</p>}
      {q.videoId && <VideoPreview videoId={q.videoId} />}

      <label className="uqc-label" style={{ marginTop: q.videoId ? 8 : 16 }}>
        Pause Point (seconds) <Tooltip text="The video pauses here and the question appears. Max 30s." />
      </label>
      <input className={`uqc-input uqc-input-sm ${errors[`${prefix}_pauseAt`] ? "error" : ""}`}
        type="number" min={1} max={30} placeholder="e.g. 8"
        value={q.pauseAt}
        onChange={e => onChange({ ...q, pauseAt: e.target.value })} />
      {errors[`${prefix}_pauseAt`] && <p className="uqc-error">{errors[`${prefix}_pauseAt`]}</p>}
      <p className="uqc-hint">Max 30 seconds</p>

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Question <Tooltip text="What should players decide at the paused moment?" />
      </label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={3} placeholder="e.g. What is the best play here?"
        value={q.question}
        onChange={e => onChange({ ...q, question: e.target.value })} />
      {errors[`${prefix}_question`] && <p className="uqc-error">{errors[`${prefix}_question`]}</p>}

      <McAnswerFields q={q} onChange={onChange} errors={errors} prefix={prefix} />
    </div>
  );
}

// Text MC editor
function TextMcEditor({ question: q, index, onChange, errors }) {
  const prefix = `q${index}`;
  return (
    <div className="uqc-qeditor">
      <label className="uqc-label">Question <Tooltip text="Ask a game knowledge question with 4 possible answers." /></label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={3} placeholder="e.g. What does the Phantom cost?"
        value={q.question}
        onChange={e => onChange({ ...q, question: e.target.value })} />
      {errors[`${prefix}_question`] && <p className="uqc-error">{errors[`${prefix}_question`]}</p>}
      <McAnswerFields q={q} onChange={onChange} errors={errors} prefix={prefix} />
    </div>
  );
}

// Rank editor (text only — no image uploads for users)
function RankEditor({ question: q, index, onChange, errors }) {
  const prefix = `q${index}`;
  const dragRef = useRef(null);

  const correctOrder = q.correctOrder ?? q.items.map((_, i) => i);

  const handleDragStart = (e, pos) => { dragRef.current = pos; e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e, pos) => {
    e.preventDefault();
    if (dragRef.current === null || dragRef.current === pos) return;
    const updated = [...correctOrder];
    const [moved] = updated.splice(dragRef.current, 1);
    updated.splice(pos, 0, moved);
    onChange({ ...q, correctOrder: updated });
    dragRef.current = null;
  };

  return (
    <div className="uqc-qeditor">
      <label className="uqc-label">Question <Tooltip text="Tell players what they are ranking. e.g. 'Rank these rifles from most accurate to least'" /></label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={2} placeholder="e.g. Rank these rifles from best to worst."
        value={q.question}
        onChange={e => onChange({ ...q, question: e.target.value })} />
      {errors[`${prefix}_question`] && <p className="uqc-error">{errors[`${prefix}_question`]}</p>}

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Items (2–6) <Tooltip text="Enter the items players will rank." />
      </label>
      {q.items.map((item, i) => (
        <div key={i} className="uqc-rank-item-row">
          <span className="uqc-rank-num">{i + 1}</span>
          <input className={`uqc-input ${errors[`${prefix}_items`] ? "error" : ""}`}
            placeholder={`Item ${i + 1}`}
            value={item}
            onChange={e => { const u = [...q.items]; u[i] = e.target.value; onChange({ ...q, items: u }); }} />
        </div>
      ))}
      {errors[`${prefix}_items`] && <p className="uqc-error">{errors[`${prefix}_items`]}</p>}

      <div className="uqc-rank-btns">
        {q.items.length < 6 && (
          <button className="uqc-btn-sm"
            onClick={() => onChange({ ...q, items: [...q.items, ""], correctOrder: [...correctOrder, q.items.length] })}>
            + Add Item
          </button>
        )}
        {q.items.length > 2 && (
          <button className="uqc-btn-sm danger"
            onClick={() => {
              const last = q.items.length - 1;
              const newItems = q.items.slice(0, last);
              const newOrder = correctOrder.filter(i => i !== last).map(i => i > last ? i - 1 : i);
              onChange({ ...q, items: newItems, correctOrder: newOrder });
            }}>
            - Remove Last
          </button>
        )}
      </div>

      <label className="uqc-label" style={{ marginTop: 16 }}>
        Correct Order (drag to set) <Tooltip text="Drag the cards below so top = 1st place, bottom = last. This is the answer players must match." />
      </label>
      <div className="uqc-rank-order-list">
        {correctOrder.map((itemIdx, pos) => (
          <div key={`ord-${pos}`} className="uqc-order-card"
            draggable
            onDragStart={e => handleDragStart(e, pos)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, pos)}>
            <span className="uqc-order-rank">{pos + 1}</span>
            <span className="uqc-order-label">{q.items[itemIdx] || `Item ${itemIdx + 1}`}</span>
            <span className="uqc-drag-handle">drag</span>
          </div>
        ))}
      </div>
      {errors[`${prefix}_correctOrder`] && <p className="uqc-error">{errors[`${prefix}_correctOrder`]}</p>}

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Explanation <Tooltip text="Explain the correct ranking after players submit." />
      </label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2} placeholder="Why is this the correct order?"
        value={q.reason}
        onChange={e => onChange({ ...q, reason: e.target.value })} />
      {errors[`${prefix}_reason`] && <p className="uqc-error">{errors[`${prefix}_reason`]}</p>}
    </div>
  );
}

// Enter value editor
function EnterValueEditor({ question: q, index, onChange, errors }) {
  const prefix = `q${index}`;
  return (
    <div className="uqc-qeditor">
      <label className="uqc-label">Question <Tooltip text="Ask something with a specific number or text answer." /></label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={2} placeholder="e.g. How many grenades does the player have?"
        value={q.question}
        onChange={e => onChange({ ...q, question: e.target.value })} />
      {errors[`${prefix}_question`] && <p className="uqc-error">{errors[`${prefix}_question`]}</p>}

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Correct Answer <Tooltip text="Players can answer with '$4000', '4000', '4,000', or '4 credits' — the number is matched flexibly." />
      </label>
      <input className={`uqc-input ${errors[`${prefix}_correct`] ? "error" : ""}`}
        placeholder="e.g. 4 or $2900 or 4 grenades"
        value={q.correctAnswer}
        onChange={e => onChange({ ...q, correctAnswer: e.target.value })} />
      {errors[`${prefix}_correct`] && <p className="uqc-error">{errors[`${prefix}_correct`]}</p>}
      <p className="uqc-hint">Numbers matched flexibly — "$2900", "2900", and "2,900" all accepted.</p>

      <label className="uqc-label" style={{ marginTop: 14 }}>
        Explanation <Tooltip text="Tell players the correct value and why it matters." />
      </label>
      <textarea className={`uqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2} placeholder="e.g. The Phantom costs $2900."
        value={q.reason}
        onChange={e => onChange({ ...q, reason: e.target.value })} />
      {errors[`${prefix}_reason`] && <p className="uqc-error">{errors[`${prefix}_reason`]}</p>}
    </div>
  );
}

// Dispatch map (Open/Closed)
const USER_Q_EDITORS = {
  [USER_Q_TYPES.VIDEO_MC]:    VideoMcEditor,
  [USER_Q_TYPES.TEXT_MC]:     TextMcEditor,
  [USER_Q_TYPES.RANK]:        RankEditor,
  [USER_Q_TYPES.ENTER_VALUE]: EnterValueEditor,
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Validation ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function validateQuestions(questions) {
  const errs = {};
  if (!questions.length) { errs.questions = "Add at least one question."; return errs; }

  questions.forEach((q, i) => {
    const p = `q${i}`;
    if (q.type === USER_Q_TYPES.VIDEO_MC) {
      if (!q.videoId) errs[`${p}_ytUrl`] = "Valid YouTube URL required.";
      const pa = Number(q.pauseAt);
      if (!q.pauseAt || isNaN(pa) || pa <= 0) errs[`${p}_pauseAt`] = "Enter a positive number of seconds.";
      if (pa > 30) errs[`${p}_pauseAt`] = "Pause point must be within the first 30 seconds.";
      if (!q.question?.trim() || q.question.trim().length < 10) errs[`${p}_question`] = "Question too short.";
      if (!q.correctAnswer?.trim()) errs[`${p}_correct`] = "Correct answer required.";
      if (q.fakeAnswers?.some(f => !f.trim())) errs[`${p}_fakes`] = "All 3 wrong answers required.";
      if (!q.reason?.trim()) errs[`${p}_reason`] = "Explanation required.";
    }
    if (q.type === USER_Q_TYPES.TEXT_MC) {
      if (!q.question?.trim() || q.question.trim().length < 5) errs[`${p}_question`] = "Question too short.";
      if (!q.correctAnswer?.trim()) errs[`${p}_correct`] = "Correct answer required.";
      if (q.fakeAnswers?.some(f => !f.trim())) errs[`${p}_fakes`] = "All 3 wrong answers required.";
      if (!q.reason?.trim()) errs[`${p}_reason`] = "Explanation required.";
    }
    if (q.type === USER_Q_TYPES.RANK) {
      if (!q.question?.trim()) errs[`${p}_question`] = "Question required.";
      if (q.items?.some(item => !item?.trim())) errs[`${p}_items`] = "All item labels required.";
      if (!q.reason?.trim()) errs[`${p}_reason`] = "Explanation required.";
    }
    if (q.type === USER_Q_TYPES.ENTER_VALUE) {
      if (!q.question?.trim()) errs[`${p}_question`] = "Question required.";
      if (!q.correctAnswer?.trim()) errs[`${p}_correct`] = "Correct answer required.";
      if (!q.reason?.trim()) errs[`${p}_reason`] = "Explanation required.";
    }
  });
  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Steps ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["Questions", "Game", "Review"];

// ─────────────────────────────────────────────────────────────────────────────
// ── Main component ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function UserQuizCreate({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [step,       setStep]       = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [errors,     setErrors]     = useState({});
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([makeVideoMcQuestion()]);
  const [game,      setGame]      = useState("valorant");

  const updateQuestion = (i, updated) =>
    setQuestions(prev => prev.map((q, qi) => qi === i ? (typeof updated === "function" ? updated(q) : updated) : q));

  const removeQuestion = (i) =>
    setQuestions(prev => prev.filter((_, qi) => qi !== i));

  const addQuestion = (type) => {
    setQuestions(prev => [...prev, QUESTION_FACTORIES[type]()]);
    setShowAddMenu(false);
  };

  const switchType = (i, newType) => {
    const existing = questions[i];
    const fresh = QUESTION_FACTORIES[newType]();
    setQuestions(prev => prev.map((q, qi) => qi === i ? { ...fresh, question: q.question ?? "" } : q));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  function next() {
    let errs = {};
    if (step === 0) errs = validateQuestions(questions);
    if (step === 1 && !game) errs.game = "Select a game.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  }
  function back() { setErrors({}); setStep(s => s - 1); }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Serialise each question into a Firestore-safe shape
      const serialised = questions.map(q => {
        if (q.type === USER_Q_TYPES.VIDEO_MC || q.type === USER_Q_TYPES.TEXT_MC) {
          const allChoices = [q.correctAnswer.trim(), ...q.fakeAnswers.map(f => f.trim())];
          const shuffled = fisherYatesShuffle(allChoices);
          return {
            type: q.type,
            ...(q.type === USER_Q_TYPES.VIDEO_MC ? { videoId: q.videoId, videoTitle: q.videoTitle, ytUrl: q.ytUrl, pauseAt: Number(q.pauseAt) } : {}),
            question: q.question.trim(),
            choices: shuffled,
            correctIndex: shuffled.indexOf(q.correctAnswer.trim()),
            reason: q.reason.trim(),
          };
        }
        if (q.type === USER_Q_TYPES.RANK) {
          return { type: q.type, question: q.question.trim(), items: q.items.map(i => i.trim()), correctOrder: q.correctOrder, reason: q.reason.trim() };
        }
        if (q.type === USER_Q_TYPES.ENTER_VALUE) {
          return { type: q.type, question: q.question.trim(), correctAnswer: q.correctAnswer.trim(), reason: q.reason.trim() };
        }
        return q;
      });

      // Legacy shape for backwards compat: if first question is video_mc,
      // also write the top-level fields the existing UserQuizCarousel expects
      const first = serialised[0];
      const legacyFields = first?.type === USER_Q_TYPES.VIDEO_MC
        ? { videoId: first.videoId, videoTitle: first.videoTitle, ytUrl: first.ytUrl, pauseAt: first.pauseAt, question: first.question, choices: first.choices, correctIndex: first.correctIndex, reason: first.reason }
        : { videoId: null, question: first?.question ?? "", choices: first?.choices ?? [], correctIndex: first?.correctIndex ?? 0, reason: first?.reason ?? "" };

      await addDoc(collection(db, "userQuizzes"), {
        ...legacyFields,
        questions: serialised,
        questionCount: serialised.length,
        game,
        createdBy: user?.uid ?? "anonymous",
        createdByName: user?.displayName ?? "Anonymous",
        createdAt: serverTimestamp(),
        approved: false,
        flagged: false,
      });
      setDone(true);
    } catch (err) {
      console.error("Failed to save quiz:", err);
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className={`uqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="uqc-done">
          <div className="uqc-done-icon">Submitted</div>
          <h2>Quiz Submitted!</h2>
          <p>Your quiz is <strong>pending review</strong>. Once approved it will appear in User Quizzes.</p>
          <div className="uqc-done-actions">
            <button className="uqc-btn-primary" onClick={() => navigate("/user-quiz")}>Back to User Quizzes</button>
            <button className="uqc-btn-secondary" onClick={() => { setDone(false); setStep(0); setQuestions([makeVideoMcQuestion()]); setGame("valorant"); setErrors({}); }}>
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review helpers ─────────────────────────────────────────────────────────
  const typeLabel = (t) => USER_Q_TYPE_META[t]?.label ?? t;

  return (
    <div className={`uqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <h1 className="uqc-page-title">Create a Quiz</h1>

      {/* Step bar */}
      <div className="uqc-stepbar">
        {STEPS.map((label, i) => (
          <div key={i} className={`uqc-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            <div className="uqc-step-circle">{i < step ? "done" : i + 1}</div>
            <div className="uqc-step-label">{label}</div>
            {i < STEPS.length - 1 && <div className="uqc-step-line" />}
          </div>
        ))}
      </div>

      <div className="uqc-card">

        {/* ── Step 0: Questions ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Your Questions ({questions.length})</h2>
            {errors.questions && <p className="uqc-error">{errors.questions}</p>}

            {questions.map((q, i) => {
              const Editor = USER_Q_EDITORS[q.type];
              return (
                <div key={i} className="uqc-question-block">
                  {/* Type switcher */}
                  <div className="uqc-question-header">
                    <span className="uqc-q-num">Q{i + 1}</span>
                    <div className="uqc-type-switcher">
                      {Object.entries(USER_Q_TYPE_META).map(([type, meta]) => (
                        <button key={type}
                          className={`uqc-type-pill ${q.type === type ? "active" : ""}`}
                          onClick={() => switchType(i, type)}
                          title={meta.hint}>
                          {meta.label}
                        </button>
                      ))}
                    </div>
                    {questions.length > 1 && (
                      <button className="uqc-remove-q" onClick={() => removeQuestion(i)}>Remove</button>
                    )}
                  </div>

                  {Editor
                    ? <Editor question={q} index={i} onChange={updated => updateQuestion(i, updated)} errors={errors} />
                    : <p className="uqc-error">Unknown type: {q.type}</p>
                  }
                </div>
              );
            })}

            {/* Add question */}
            <div className="uqc-add-q-wrap">
              <button className="uqc-add-q-btn" onClick={() => setShowAddMenu(v => !v)}>
                + Add Question
              </button>
              {showAddMenu && (
                <div className="uqc-add-menu">
                  {Object.entries(USER_Q_TYPE_META).map(([type, meta]) => (
                    <button key={type} className="uqc-add-menu-item" onClick={() => addQuestion(type)}>
                      <span className="uqc-add-menu-label">{meta.label}</span>
                      <span className="uqc-add-menu-hint">{meta.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Moderation notice */}
            <div className="uqc-moderation-notice" style={{ marginTop: 20 }}>
              <div>
                <strong>Moderation notice</strong>
                <p>All user quizzes are reviewed before going live. Clips must be real gameplay from the selected game.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Game ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Choose Your Game</h2>
            <div className="uqc-game-btns">
              {GAMES.map(g => (
                <button key={g.id} className={`uqc-game-btn ${game === g.id ? "selected" : ""}`} onClick={() => setGame(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            {errors.game && <p className="uqc-error">{errors.game}</p>}
          </div>
        )}

        {/* ── Step 2: Review ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Review and Submit</h2>
            <div className="uqc-review-grid">
              <div className="uqc-review-row">
                <span className="uqc-review-label">Game</span>
                <span className="uqc-review-value">{GAMES.find(g => g.id === game)?.label}</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Questions</span>
                <span className="uqc-review-value">{questions.length}</span>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="uqc-review-row">
                  <span className="uqc-review-label">Q{i + 1} ({typeLabel(q.type)})</span>
                  <span className="uqc-review-value">
                    {(q.question?.length > 60 ? q.question.slice(0, 60) + "..." : q.question) || "(no question text)"}
                  </span>
                </div>
              ))}
            </div>
            {errors.submit && <p className="uqc-error" style={{ marginTop: 12 }}>{errors.submit}</p>}
            <p className="uqc-hint" style={{ marginTop: 16 }}>
              By submitting you confirm this is appropriate game-related content.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="uqc-nav">
          {step > 0 && <button className="uqc-btn-secondary" onClick={back} disabled={submitting}>Back</button>}
          {step < STEPS.length - 1 && <button className="uqc-btn-primary" onClick={next}>Next</button>}
          {step === STEPS.length - 1 && (
            <button className="uqc-btn-primary uqc-btn-finish" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
