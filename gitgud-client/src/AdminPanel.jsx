// AdminPanel.jsx
// Drop into: gitgud-client/src/AdminPanel.jsx
//
// Access: only users with isAdmin: true in their Firestore users/{uid} doc can see this page.
// Route: /admin
//
// To make someone an admin:
//   Firebase Console → Firestore → users → {their uid} → add field isAdmin = true (boolean)
//
// Gherkin:
//   Given a user with isAdmin: true navigates to /admin
//   When the page loads
//   Then all pending (approved: false, flagged: false) userQuizzes are shown
//   And each card shows the video title, game, question, creator name, and an embedded preview
//
//   Given an admin clicks Approve
//   When the action completes
//   Then approved is set to true on that document
//   And the card is removed from the pending queue
//
//   Given an admin clicks Reject
//   When the action completes
//   Then flagged is set to true and approved stays false
//   And the card is removed from the pending queue
//
//   Given a non-admin user navigates to /admin
//   When the page loads
//   Then an access denied message is shown

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./AdminPanel.css";

// ── YouTube IFrame loader ─────────────────────────────────────────────────────
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
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytApiCallbacks.forEach((cb) => cb());
        ytApiCallbacks = [];
      };
    }
  });
}

// Small inline preview
function MiniPlayer({ videoId }) {
  const divRef = useRef(null);
  const playerRef = useRef(null);
  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    loadYouTubeApi().then(() => {
      if (!alive || !divRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} }
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
      });
    });
    return () => {
      alive = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
    };
  }, [videoId]);
  return (
    <div className="ap-player-wrap">
      <div ref={divRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

const GAME_LABELS = { valorant: "Valorant", cs2: "Counter-Strike 2", other: "Other" };

export default function AdminPanel({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isAdmin,  setIsAdmin]  = useState(null); // null = checking
  const [pending,  setPending]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(null); // docId being acted on
  const [expanded, setExpanded] = useState(null); // docId with open preview

  // ── Check admin role ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setIsAdmin(false); setLoading(false); return; }
    async function check() {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", user.uid))
        );
        if (!snap.empty && snap.docs[0].data().isAdmin === true) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Admin check failed:", err);
        setIsAdmin(false);
        setLoading(false);
      }
    }
    check();
  }, [user?.uid]);

  // ── Fetch pending quizzes ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    async function fetchPending() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "userQuizzes"),
            where("approved", "==", false),
            where("flagged",  "==", false)
          )
        );
        setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load pending quizzes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPending();
  }, [isAdmin]);

  const handleApprove = async (quizId) => {
    setActing(quizId);
    try {
      await updateDoc(doc(db, "userQuizzes", quizId), { approved: true });
      setPending((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Failed to approve. Try again.");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (quizId) => {
    if (!window.confirm("Reject this quiz? The creator will see it as Rejected.")) return;
    setActing(quizId);
    try {
      await updateDoc(doc(db, "userQuizzes", quizId), { flagged: true });
      setPending((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err) {
      console.error("Reject failed:", err);
      alert("Failed to reject. Try again.");
    } finally {
      setActing(null);
    }
  };

  // ── Access denied ───────────────────────────────────────────────────────────
  if (isAdmin === false) {
    return (
      <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="ap-denied">
          <span className="ap-denied-icon">🚫</span>
          <h2>Access Denied</h2>
          <p>You don't have admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isAdmin === null || loading) {
    return (
      <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <p style={{ color: "var(--qc-subtext)" }}>Loading…</p>
      </div>
    );
  }

  // ── Admin UI ────────────────────────────────────────────────────────────────
  return (
    <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <div className="ap-header">
        <h1 className="ap-title">Admin: Quiz Moderation</h1>
        <p className="ap-sub">
          Review user-submitted quizzes before they go live. Watch the clip, check it matches the selected game, and approve or reject.
        </p>
        <div className="ap-underline" />
      </div>

      {pending.length === 0 ? (
        <div className="ap-empty">
          <span className="ap-empty-icon">✓</span>
          <h2>All caught up!</h2>
          <p>No quizzes are waiting for review right now.</p>
        </div>
      ) : (
        <>
          <p className="ap-count">{pending.length} quiz{pending.length !== 1 ? "zes" : ""} awaiting review</p>
          <div className="ap-list">
            {pending.map((quiz) => (
              <div key={quiz.id} className="ap-card">
                {/* Card header */}
                <div className="ap-card-top">
                  <div className="ap-card-meta">
                    <span className="ap-game-tag">{GAME_LABELS[quiz.game] ?? quiz.game}</span>
                    <span className="ap-creator">by {quiz.createdByName || "Unknown"}</span>
                  </div>
                  <button
                    className="ap-preview-toggle"
                    onClick={() => setExpanded(expanded === quiz.id ? null : quiz.id)}
                  >
                    {expanded === quiz.id ? "▲ Hide Preview" : "▶ Watch Clip"}
                  </button>
                </div>

                {/* Video title from oEmbed */}
                {quiz.videoTitle && (
                  <p className="ap-video-title">📹 {quiz.videoTitle}</p>
                )}

                {/* Expandable player */}
                {expanded === quiz.id && (
                  <MiniPlayer videoId={quiz.videoId} />
                )}

                {/* Quiz content */}
                <div className="ap-card-content">
                  <div className="ap-field">
                    <span className="ap-field-label">Question</span>
                    <span className="ap-field-value">{quiz.question}</span>
                  </div>
                  <div className="ap-field">
                    <span className="ap-field-label">Pause at</span>
                    <span className="ap-field-value">{quiz.pauseAt}s</span>
                  </div>
                  <div className="ap-field">
                    <span className="ap-field-label">Correct Answer</span>
                    <span className="ap-field-value ap-correct">{quiz.choices?.[quiz.correctIndex]}</span>
                  </div>
                  <div className="ap-field">
                    <span className="ap-field-label">Other Options</span>
                    <span className="ap-field-value">
                      {quiz.choices?.filter((_, i) => i !== quiz.correctIndex).join(" · ")}
                    </span>
                  </div>
                  <div className="ap-field">
                    <span className="ap-field-label">Explanation</span>
                    <span className="ap-field-value">{quiz.reason}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="ap-actions">
                  <button
                    className="ap-approve-btn"
                    onClick={() => handleApprove(quiz.id)}
                    disabled={acting === quiz.id}
                  >
                    {acting === quiz.id ? "…" : "✓ Approve: Go Live"}
                  </button>
                  <button
                    className="ap-reject-btn"
                    onClick={() => handleReject(quiz.id)}
                    disabled={acting === quiz.id}
                  >
                    {acting === quiz.id ? "…" : "✗ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
