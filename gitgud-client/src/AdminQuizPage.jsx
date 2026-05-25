// AdminQuizPage.jsx
// Game landing page for admin-created quizzes.
//
// Layout per game:
//   - Splash art (same images as Category.jsx)
//   - "Play Quiz" button → dropdown of all admin quizzes for that game
//   - "Create Quiz" button → /admin-quiz/create (admin only)
//
// Also hosts the full quiz player (AdminQuizPlayer) which handles:
//   multi_choice  — standard ABCD selection
//   rank          — drag-and-drop cards top=1st bottom=last
//   enter_value   — text input with flexible numeric matching
//
// The existing 5-question Valorant demo quiz (hardcoded in QuizCarousel.jsx)
// is preserved at /quiz/valorant — this page is an ADDITIONAL entry point
// under /admin-quiz/:gameId.
//
// SOLID:
//   S – AdminQuizLanding and AdminQuizPlayer are separate components
//   O – New question play renderers are registered in PLAYER_RENDERERS
//   L – All player renderers share (question, answer, onAnswer, submitted) props
//   I – AdminQuizPage only imports what it needs
//   D – Firestore queries are in one place (loadQuizList / loadQuiz)
//
// Gherkin:
//   Given a user navigates to /admin-quiz/valorant
//   When the page loads
//   Then the Valorant splash art is shown with "Play Quiz" and "Create Quiz" buttons
//
//   Given the user clicks "Play Quiz"
//   When at least one admin quiz exists for that game
//   Then a dropdown of quiz titles is shown
//   And selecting one starts the quiz
//
//   Given the quiz contains a rank question
//   When the player drags the cards
//   Then the order updates in real time and top = 1st
//
//   Given the quiz contains an enter_value question
//   When the player types "$4000"
//   Then it is matched correctly against the stored answer "4000"

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection, getDocs, query, where, doc, getDoc, deleteDoc, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import {
  QUESTION_TYPES,
  isValueAnswerCorrect,
  isRankingCorrect,
  calculateScore,
} from "./adminQuizUtils";
import { awardPoints } from "./usePoints";
import "./AdminQuizPage.css";

// ── Game metadata ─────────────────────────────────────────────────────────────
const GAME_META = {
  valorant: {
    name:        "Valorant",
    image:       "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg",
    accent:      "#ff4655",
    description: "Test your Valorant game sense",
  },
  cs2: {
    name:        "Counter-Strike 2",
    image:       "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185626/CS2Spalsh_sg4smz.jpg",
    accent:      "#eeb02a",
    description: "Master your CS2 knowledge",
  },
  other: {
    name:        "Other Games",
    image:       "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop",
    accent:      "#a855f7",
    description: "Test your knowledge across titles",
  },
};

// ── Rank Question Player ──────────────────────────────────────────────────────
function RankPlayer({ question, answer, onAnswer, submitted }) {
  // answer is an array of item indices representing the player's current order
  const initial = question.items.map((_, i) => i);
  const order = answer ?? initial;

  const dragRef = useRef(null);

  const handleDragStart = (e, pos) => {
    if (submitted) return;
    dragRef.current = pos;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, pos) => {
    e.preventDefault();
    if (submitted || dragRef.current === null || dragRef.current === pos) return;
    const updated = [...order];
    const [moved] = updated.splice(dragRef.current, 1);
    updated.splice(pos, 0, moved);
    onAnswer(updated);
    dragRef.current = null;
  };

  const isCorrect = submitted && isRankingCorrect(order, question.correctOrder);
  const correctLabels = question.correctOrder.map((idx) => question.items[idx]);

  return (
    <div className="aqp-rank-player">
      <p className="aqp-rank-instruction">
        Drag cards into the correct order — top is 1st, bottom is last.
      </p>
      <div className="aqp-rank-list">
        {order.map((itemIdx, pos) => {
          const item = question.items[itemIdx];
          let cardClass = "aqp-rank-card";
          if (submitted) {
            cardClass += order[pos] === question.correctOrder[pos] ? " correct-pos" : " wrong-pos";
          }
          return (
            <div
              key={`rank-${pos}`}
              className={cardClass}
              draggable={!submitted}
              onDragStart={(e) => handleDragStart(e, pos)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, pos)}
            >
              <span className="aqp-rank-pos">{pos + 1}</span>
              {question.useImages && item?.imageUrl && (
                <img src={item.imageUrl} alt={item.label} className="aqp-rank-img" />
              )}
              <span className="aqp-rank-text">{item?.label || `Item ${itemIdx + 1}`}</span>
              {!submitted && <span className="aqp-drag-handle">drag</span>}
            </div>
          );
        })}
      </div>

      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct ranking! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect ranking</p>
              <div className="aqp-correct-order">
                <p className="aqp-co-label">Correct order:</p>
                {correctLabels.map((item, i) => (
                  <div key={i} className="aqp-co-row">
                    <span className="aqp-co-num">{i + 1}</span>
                    {question.useImages && item?.imageUrl && (
                      <img src={item.imageUrl} alt={item.label} className="aqp-co-img" />
                    )}
                    <span>{item?.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Enter Value Player ────────────────────────────────────────────────────────
function EnterValuePlayer({ question, answer, onAnswer, submitted }) {
  const isCorrect = submitted && isValueAnswerCorrect(answer ?? "", question.correctAnswer);

  return (
    <div className="aqp-value-player">
      <input
        className={`aqp-value-input ${submitted ? (isCorrect ? "correct" : "wrong") : ""}`}
        placeholder="Type your answer here..."
        value={answer ?? ""}
        onChange={(e) => !submitted && onAnswer(e.target.value)}
        disabled={submitted}
      />
      <p className="aqp-value-hint">
        Numbers are matched flexibly. You can include or omit the dollar sign, commas, or units.
      </p>

      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect</p>
              <p className="aqp-chosen">
                You answered: <strong>{answer || "(no answer)"}</strong>
                &nbsp;— correct answer: <strong>{question.correctAnswer}</strong>
              </p>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Multi Choice Player ───────────────────────────────────────────────────────
function MultiChoicePlayer({ question, answer, onAnswer, submitted }) {
  const LABELS = ["A", "B", "C", "D", "E", "F"];
  const isCorrect = submitted && answer === question.correctIndex;

  return (
    <div className="aqp-mc-player">
      <div className="aqp-choices">
        {question.choices.map((choice, idx) => {
          let cls = "aqp-choice-btn";
          if (submitted) {
            cls += " locked";
            if (idx === question.correctIndex) cls += " correct";
            else if (idx === answer) cls += " wrong";
          } else if (answer === idx) {
            cls += " selected";
          }
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => !submitted && onAnswer(idx)}
              disabled={submitted}
            >
              <span className="aqp-choice-label">{LABELS[idx]}</span>
              <span className="aqp-choice-text">{choice}</span>
              {submitted && idx === question.correctIndex && <span className="aqp-choice-icon">correct</span>}
              {submitted && idx === answer && idx !== question.correctIndex && <span className="aqp-choice-icon wrong">wrong</span>}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect</p>
              <p className="aqp-chosen">
                You chose: <strong>{question.choices[answer]}</strong>
                &nbsp;— correct answer: <strong>{question.choices[question.correctIndex]}</strong>
              </p>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Player renderer dispatch (Open/Closed) ────────────────────────────────────
const PLAYER_RENDERERS = {
  [QUESTION_TYPES.MULTI_CHOICE]: MultiChoicePlayer,
  [QUESTION_TYPES.RANK]:         RankPlayer,
  [QUESTION_TYPES.ENTER_VALUE]:  EnterValuePlayer,
};

// ── Quiz Player ───────────────────────────────────────────────────────────────
function AdminQuizPlayer({ quiz, user, onBack }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const questions = quiz.questions ?? [];
  const total = questions.length;

  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState(Array(total).fill(null));
  const [submitted, setSubmitted] = useState(Array(total).fill(false));
  const [showComplete, setShowComplete] = useState(false);

  const q          = questions[current];
  const isSubmitted = submitted[current];
  const currAnswer  = answers[current];

  const Renderer = q ? PLAYER_RENDERERS[q.type] : null;

  const handleAnswer = (val) => {
    setAnswers((prev) => prev.map((a, i) => (i === current ? val : a)));
  };

  const canSubmit = () => {
    if (isSubmitted) return false;
    if (q?.type === QUESTION_TYPES.RANK) return true; // always has a default order
    return currAnswer !== null && currAnswer !== undefined && currAnswer !== "";
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    const updatedSubmitted = submitted.map((s, i) => (i === current ? true : s));
    setSubmitted(updatedSubmitted);

    const allDone = updatedSubmitted.every(Boolean);

    // Award points for correct answer
    const answerObj = { type: q.type };
    if (q.type === QUESTION_TYPES.MULTI_CHOICE) {
      answerObj.playerAnswer = currAnswer;
      answerObj.correctIndex = q.correctIndex;
    } else if (q.type === QUESTION_TYPES.ENTER_VALUE) {
      answerObj.playerAnswer = currAnswer ?? "";
      answerObj.correctAnswer = q.correctAnswer;
    } else if (q.type === QUESTION_TYPES.RANK) {
      answerObj.playerAnswer = currAnswer ?? q.items.map((_, i) => i);
      answerObj.correctOrder = q.correctOrder;
    }

    const { correct } = calculateScore([answerObj]);
    if (correct && user?.uid) {
      awardPoints(user.uid, 10).catch((err) => console.error("awardPoints failed:", err));
    }

    if (allDone && current === total - 1) {
      setTimeout(() => setShowComplete(true), 800);
    }
  };

  const goNext = () => {
    if (current < total - 1) setCurrent((c) => c + 1);
    else setShowComplete(true);
  };
  const goPrev = () => { if (current > 0) setCurrent((c) => c - 1); };

  // Build score for complete screen
  const scoreAnswers = questions.map((question, i) => {
    const a = { type: question.type };
    if (question.type === QUESTION_TYPES.MULTI_CHOICE) {
      a.playerAnswer = answers[i]; a.correctIndex = question.correctIndex;
    } else if (question.type === QUESTION_TYPES.ENTER_VALUE) {
      a.playerAnswer = answers[i] ?? ""; a.correctAnswer = question.correctAnswer;
    } else if (question.type === QUESTION_TYPES.RANK) {
      a.playerAnswer = answers[i] ?? question.items.map((_, idx) => idx);
      a.correctOrder = question.correctOrder;
    }
    return a;
  });
  const score = calculateScore(scoreAnswers);

  if (showComplete) {
    const pct = Math.round((score.correct / score.total) * 100);
    const getRank = () => {
      if (pct === 100) return { label: "Perfect Score!", color: "#f59e0b" };
      if (pct >= 80)   return { label: "Great Work!",    color: "#22c55e" };
      if (pct >= 60)   return { label: "Not Bad!",       color: "#3b82f6" };
      return               { label: "Keep Practising",   color: "#ef4444" };
    };
    const rank = getRank();

    return (
      <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
        <div className="aqp-complete-card">
          <h2 className="aqp-complete-title">Quiz Complete!</h2>
          <p className="aqp-complete-rank" style={{ color: rank.color }}>{rank.label}</p>
          <div className="aqp-score-wrap">
            <div className="aqp-score-label">
              <span>Score</span>
              <span className="aqp-fraction">{score.correct} / {score.total}</span>
            </div>
            <div className="aqp-score-track">
              <div className="aqp-score-fill" style={{ width: `${pct}%`, background: rank.color }} />
            </div>
            <div className="aqp-score-pct">{pct}%</div>
          </div>
          <p className="aqp-points-earned">+{score.points} points earned</p>
          <div className="aqp-complete-actions">
            <button className="aqc-btn-primary" onClick={() => {
              setShowComplete(false); setCurrent(0);
              setAnswers(Array(total).fill(null));
              setSubmitted(Array(total).fill(false));
            }}>Try Again</button>
            <button className="aqc-btn-secondary" onClick={onBack}>Back to Quizzes</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
      <div className="aqp-header">
        <button className="aqp-back-btn" onClick={onBack}>Back</button>
        <h2 className="aqp-quiz-title">{quiz.title}</h2>
      </div>

      <div className="aqp-progress-row">
        {questions.map((_, i) => (
          <span key={i} className={`aqp-dot ${i === current ? "active" : ""} ${submitted[i] ? "done" : ""}`} />
        ))}
        <span className="aqp-counter">{current + 1} / {total}</span>
      </div>

      <div className="aqp-question-card">
        <div className="aqp-q-header">
          <span className="aqp-q-badge">Q{current + 1}</span>
          <span className="aqp-q-type">{q?.type?.replace("_", " ")}</span>
        </div>
        <p className="aqp-q-text">{q?.question}</p>

        {Renderer ? (
          <Renderer
            question={q}
            answer={currAnswer}
            onAnswer={handleAnswer}
            submitted={isSubmitted}
          />
        ) : (
          <p>Unknown question type.</p>
        )}

        <div className="aqp-question-nav">
          <button className="aqc-btn-secondary" onClick={goPrev} disabled={current === 0}>
            Prev
          </button>
          {!isSubmitted ? (
            <button
              className="aqc-btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit()}
            >
              Submit Answer
            </button>
          ) : current < total - 1 ? (
            <button className="aqc-btn-primary" onClick={goNext}>
              Next Question
            </button>
          ) : (
            <button className="aqc-btn-primary" onClick={() => setShowComplete(true)}>
              See Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline quiz editor (title, questions list, basic field editing) ───────────
// Reuses AdminQuizCreate's logic but loads an existing quiz and calls updateDoc.
// Admins can: rename the quiz, edit question text / choices / answers, delete
// individual questions, and save back to Firestore in one click.
function AdminQuizEdit({ quiz, isDark, onSave, onCancel }) {
  const [title,     setTitle]     = useState(quiz.title ?? "");
  const [questions, setQuestions] = useState(quiz.questions ?? []);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const LABELS = ["A", "B", "C", "D", "E", "F"];

  const updateQ = (i, patch) =>
    setQuestions((prev) => prev.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));

  const removeQ = (i) => setQuestions((prev) => prev.filter((_, qi) => qi !== i));

  const handleSave = async () => {
    if (!title.trim()) { setError("Quiz title cannot be empty."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "adminQuizzes", quiz.id), { title: title.trim(), questions });
      onSave({ ...quiz, title: title.trim(), questions });
    } catch (err) {
      console.error("Failed to save quiz:", err);
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
      <div className="aqp-edit-wrap">
        <div className="aqp-edit-header">
          <h2 className="aqp-edit-title">Edit Quiz</h2>
          <button className="aqp-back-btn" onClick={onCancel}>Cancel</button>
        </div>

        {/* Title */}
        <label className="aqp-edit-label">Quiz Title</label>
        <input
          className="aqp-edit-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title"
        />

        {/* Questions */}
        {questions.map((q, i) => (
          <div key={i} className="aqp-edit-qblock">
            <div className="aqp-edit-qheader">
              <span className="aqp-edit-qnum">Q{i + 1}</span>
              <span className="aqp-edit-qtype">{q.type?.replace("_", " ")}</span>
              {questions.length > 1 && (
                <button className="aqp-admin-btn delete" onClick={() => removeQ(i)}>Remove</button>
              )}
            </div>

            {/* Question text — common to all types */}
            <label className="aqp-edit-label">Question</label>
            <textarea
              className="aqp-edit-textarea"
              rows={2}
              value={q.question ?? ""}
              onChange={(e) => updateQ(i, { question: e.target.value })}
            />

            {/* Multi choice specifics */}
            {q.type === "multi_choice" && (
              <>
                <label className="aqp-edit-label">Choices — click a letter to mark as correct</label>
                {(q.choices ?? []).map((choice, ci) => (
                  <div key={ci} className="aqp-edit-choice-row">
                    <button
                      className={`aqp-edit-radio ${q.correctIndex === ci ? "correct" : ""}`}
                      onClick={() => updateQ(i, { correctIndex: ci })}
                    >
                      {LABELS[ci]}
                    </button>
                    <input
                      className="aqp-edit-input"
                      value={choice}
                      onChange={(e) => {
                        const updated = [...(q.choices ?? [])];
                        updated[ci] = e.target.value;
                        updateQ(i, { choices: updated });
                      }}
                    />
                  </div>
                ))}
                <label className="aqp-edit-label">Explanation</label>
                <textarea
                  className="aqp-edit-textarea"
                  rows={2}
                  value={q.reason ?? ""}
                  onChange={(e) => updateQ(i, { reason: e.target.value })}
                />
              </>
            )}

            {/* Enter value specifics */}
            {q.type === "enter_value" && (
              <>
                <label className="aqp-edit-label">Correct Answer</label>
                <input
                  className="aqp-edit-input"
                  value={q.correctAnswer ?? ""}
                  onChange={(e) => updateQ(i, { correctAnswer: e.target.value })}
                />
                <label className="aqp-edit-label">Explanation</label>
                <textarea
                  className="aqp-edit-textarea"
                  rows={2}
                  value={q.reason ?? ""}
                  onChange={(e) => updateQ(i, { reason: e.target.value })}
                />
              </>
            )}

            {/* Rank specifics — item labels and explanation */}
            {q.type === "rank" && (
              <>
                <label className="aqp-edit-label">Item Labels</label>
                {(q.items ?? []).map((item, ii) => (
                  <div key={ii} className="aqp-edit-choice-row">
                    <span className="aqp-edit-rank-num">{ii + 1}</span>
                    <input
                      className="aqp-edit-input"
                      value={item.label ?? ""}
                      onChange={(e) => {
                        const updated = [...(q.items ?? [])];
                        updated[ii] = { ...updated[ii], label: e.target.value };
                        updateQ(i, { items: updated });
                      }}
                    />
                  </div>
                ))}
                <label className="aqp-edit-label">Explanation</label>
                <textarea
                  className="aqp-edit-textarea"
                  rows={2}
                  value={q.reason ?? ""}
                  onChange={(e) => updateQ(i, { reason: e.target.value })}
                />
              </>
            )}
          </div>
        ))}

        {error && <p className="aqp-edit-error">{error}</p>}

        <div className="aqp-edit-actions">
          <button className="aqp-action-btn play" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button className="aqp-action-btn classic" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function AdminQuizPage({ user }) {
  const { gameId } = useParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const game = GAME_META[gameId] ?? GAME_META.other;

  const [quizList,     setQuizList]     = useState([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeQuiz,   setActiveQuiz]   = useState(null);

  const [isAdmin,      setIsAdmin]      = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);
  const [editingQuiz,  setEditingQuiz]  = useState(null); // quiz object being edited
  const [confirmId,    setConfirmId]    = useState(null); // quiz id awaiting delete confirm

  // Check admin status from Firestore (source of truth)
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => { if (snap.exists()) setIsAdmin(snap.data().isAdmin === true); })
      .catch(() => {});
  }, [user?.uid]);

  // Load all admin quizzes for this game
  useEffect(() => {
    async function load() {
      setLoadingList(true);
      try {
        const snap = await getDocs(
          query(collection(db, "adminQuizzes"), where("game", "==", gameId), where("approved", "==", true))
        );
        setQuizList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load admin quizzes:", err);
      } finally {
        setLoadingList(false);
      }
    }
    load();
  }, [gameId]);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async (quizId) => {
    setDeletingId(quizId);
    try {
      await deleteDoc(doc(db, "adminQuizzes", quizId));
      setQuizList((prev) => prev.filter((q) => q.id !== quizId));
      setConfirmId(null);
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (activeQuiz) {
    return (
      <AdminQuizPlayer
        quiz={activeQuiz}
        user={user}
        onBack={() => setActiveQuiz(null)}
      />
    );
  }

  // ── Inline edit modal ──────────────────────────────────────────────────────
  if (editingQuiz) {
    return (
      <AdminQuizEdit
        quiz={editingQuiz}
        isDark={isDark}
        onSave={(updated) => {
          setQuizList((prev) => prev.map((q) => q.id === updated.id ? updated : q));
          setEditingQuiz(null);
        }}
        onCancel={() => setEditingQuiz(null)}
      />
    );
  }

  return (
    <div className={`aqp-landing ${isDark ? "dark" : "light"}`}>
      {/* Splash banner */}
      <div className="aqp-splash" style={{ backgroundImage: `url(${game.image})` }}>
        <div className="aqp-splash-overlay" />
        <div className="aqp-splash-content">
          <h1 className="aqp-splash-title" style={{ color: game.accent }}>{game.name}</h1>
          <p className="aqp-splash-desc">{game.description}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="aqp-actions-row">
        {/* Play Quiz */}
        <div className="aqp-play-wrap">
          <button
            className="aqp-action-btn play"
            onClick={() => setShowDropdown((v) => !v)}
            disabled={loadingList}
          >
            {loadingList ? "Loading..." : "Play Quiz"}
          </button>
          {showDropdown && (
            <div className="aqp-quiz-dropdown">
              {quizList.length === 0 ? (
                <div className="aqp-dropdown-empty">
                  No quizzes yet for {game.name}.
                </div>
              ) : (
                quizList.map((quiz) => (
                  <div key={quiz.id} className="aqp-dropdown-row">
                    <button
                      className="aqp-dropdown-item"
                      onClick={() => { setActiveQuiz(quiz); setShowDropdown(false); }}
                    >
                      <span className="aqp-dropdown-title">{quiz.title}</span>
                      <span className="aqp-dropdown-count">{quiz.questions?.length ?? 0} questions</span>
                    </button>
                    {isAdmin && (
                      <div className="aqp-dropdown-admin-btns">
                        <button
                          className="aqp-admin-btn edit"
                          onClick={(e) => { e.stopPropagation(); setShowDropdown(false); setEditingQuiz(quiz); }}
                          title="Edit this quiz"
                        >
                          Edit
                        </button>
                        <button
                          className="aqp-admin-btn delete"
                          onClick={(e) => { e.stopPropagation(); setConfirmId(quiz.id); }}
                          disabled={deletingId === quiz.id}
                          title="Delete this quiz"
                        >
                          {deletingId === quiz.id ? "..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Classic Demo (preserved for Valorant) */}
        {gameId === "valorant" && (
          <button
            className="aqp-action-btn classic"
            onClick={() => navigate("/quiz/valorant")}
          >
            Classic Demo Quiz
          </button>
        )}

        {/* Create Quiz (admin only) */}
        {isAdmin && (
          <button
            className="aqp-action-btn create"
            onClick={() => navigate("/admin-quiz/create")}
          >
            Create Quiz
          </button>
        )}
      </div>

      {/* Quiz grid cards */}
      {!loadingList && quizList.length > 0 && (
        <div className={`aqp-quiz-grid ${isDark ? "dark" : "light"}`}>
          <h2 className="aqp-grid-title">Available Quizzes</h2>
          <div className="aqp-grid">
            {quizList.map((quiz) => (
              <div key={quiz.id} className="aqp-quiz-card-wrap">
                <button
                  className="aqp-quiz-card"
                  onClick={() => setActiveQuiz(quiz)}
                >
                  <span className="aqp-qcard-title">{quiz.title}</span>
                  <span className="aqp-qcard-meta">{quiz.questions?.length ?? 0} questions</span>
                </button>
                {isAdmin && (
                  <div className="aqp-card-admin-row">
                    <button
                      className="aqp-admin-btn edit"
                      onClick={() => setEditingQuiz(quiz)}
                    >
                      Edit
                    </button>
                    <button
                      className="aqp-admin-btn delete"
                      onClick={() => setConfirmId(quiz.id)}
                      disabled={deletingId === quiz.id}
                    >
                      {deletingId === quiz.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmId && (
        <div className="aqp-confirm-overlay" onClick={() => setConfirmId(null)}>
          <div className="aqp-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="aqp-confirm-title">Delete Quiz?</h3>
            <p className="aqp-confirm-msg">
              This will permanently remove the quiz for all players. This cannot be undone.
            </p>
            <div className="aqp-confirm-actions">
              <button
                className="aqp-admin-btn delete"
                onClick={() => handleDelete(confirmId)}
                disabled={!!deletingId}
              >
                {deletingId ? "Deleting..." : "Yes, Delete"}
              </button>
              <button className="aqp-admin-btn edit" onClick={() => setConfirmId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
