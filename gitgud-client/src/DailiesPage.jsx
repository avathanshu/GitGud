// DailiesPage.jsx
// Full daily quests feature page.
// - Shows 3 daily quests with live progress bars
// - Links directly to the relevant activity for each quest
// - Shows a daily summary header (X/3 complete, total XP available)
// - Resets daily (date-keyed in Firestore via useDailies hook)

import { useTheme } from "./context/ThemeContext"
import { useDailies } from "./useDailies"
import { Link } from "react-router-dom"

// Maps quest type to a destination route and a short action label
const TYPE_META = {
  aim:      { to: "/practice/aim",      action: "Go to Aim Trainer"      },
  quiz:     { to: "/quiz",              action: "Go to Quiz"              },
  reaction: { to: "/practice/reaction", action: "Go to Reaction Trainer"  },
}

// Maps quest type to a display label used in the card header
const TYPE_LABEL = {
  aim:      "AIM TRAINER",
  quiz:     "QUIZ",
  reaction: "REACTION TRAINER",
}

export default function DailiesPage({ user }) {
  const { theme }           = useTheme()
  const { quests, loading } = useDailies(user?.uid)
  const dark                = theme === "dark"

  const accent      = dark ? "#ff6a00"                : "#0066cc"
  const accentGlow  = dark ? "rgba(255,106,0,0.18)"   : "rgba(0,102,204,0.12)"
  const textPri     = dark ? "#f0f0f0"                : "#111"
  const textSub     = dark ? "#666"                   : "#888"
  const cardBg      = dark ? "#141414"                : "#ffffff"
  const pageBg      = dark ? "#0d0d0d"                : "#f4f6f9"
  const border      = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"
  const barBg       = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const doneBg      = dark ? "rgba(34,197,94,0.08)"   : "rgba(34,197,94,0.07)"
  const doneBorder  = "#22c55e"
  const tagBg       = dark ? "rgba(255,106,0,0.12)"   : "rgba(0,102,204,0.09)"

  const doneCount = quests.filter(q => q.done).length
  const totalXP   = quests.reduce((sum, q) => sum + q.xpReward, 0)
  const earnedXP  = quests.filter(q => q.done).reduce((sum, q) => sum + q.xpReward, 0)
  const allDone   = quests.length > 0 && doneCount === quests.length

  return (
    <div style={{
      minHeight:  "100vh",
      background: pageBg,
      padding:    "40px 24px 60px",
      boxSizing:  "border-box",
      fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{
            color: accent, fontWeight: 800, fontSize: 11,
            letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 6px",
          }}>
            Daily Quests
          </p>
          <h1 style={{
            margin: "0 0 8px",
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            fontWeight: 800, color: textPri, letterSpacing: "-0.03em", lineHeight: 1.1,
          }}>
            {allDone ? "All done for today." : "What's on today?"}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: textSub }}>
            3 new challenges every day — resets at midnight
          </p>
        </div>

        {/* Summary bar */}
        {!loading && quests.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            background: cardBg,
            border: `1.5px solid ${allDone ? doneBorder : border}`,
            borderRadius: 14, padding: "14px 20px", marginBottom: 24,
            boxShadow: allDone ? "0 0 16px rgba(34,197,94,0.15)" : "none",
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          }}>
            {/* Completion dots */}
            <div style={{ display: "flex", gap: 6 }}>
              {quests.map((q, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: q.done ? doneBorder : barBg,
                  border: `1.5px solid ${q.done ? doneBorder : border}`,
                  transition: "background 0.3s ease",
                }} />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                {doneCount} / {quests.length} complete
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>
                {earnedXP} / {totalXP} XP
              </span>
              <p style={{ margin: 0, fontSize: 11, color: textSub }}>earned today</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 110, background: cardBg,
                border: `1.5px solid ${border}`, borderRadius: 14, opacity: 0.5,
              }} />
            ))}
          </div>
        )}

        {/* Empty / error state */}
        {!loading && quests.length === 0 && (
          <div style={{
            background: cardBg, border: `1.5px solid ${border}`,
            borderRadius: 14, padding: "32px 24px", textAlign: "center",
          }}>
            <p style={{ color: textPri, fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>
              Could not load quests
            </p>
            <p style={{ color: textSub, fontSize: 13, margin: 0 }}>
              Try refreshing the page. If this keeps happening, check your connection.
            </p>
          </div>
        )}

        {/* Quest cards */}
        {!loading && quests.map((q) => {
          const pct  = Math.min(100, Math.round((q.progress / q.required) * 100))
          const done = q.done
          const meta = TYPE_META[q.type]

          return (
            <div key={q.id} style={{
              background:   done ? doneBg : cardBg,
              border:       `1.5px solid ${done ? doneBorder : border}`,
              borderRadius: 14,
              padding:      "20px 22px",
              marginBottom: 12,
              transition:   "border-color 0.3s ease, box-shadow 0.3s ease",
              boxShadow:    done ? "0 0 12px rgba(34,197,94,0.1)" : "none",
            }}>

              {/* Type tag + XP badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color:      done ? doneBorder : accent,
                  background: done ? "rgba(34,197,94,0.1)" : tagBg,
                  padding: "3px 9px", borderRadius: 99,
                }}>
                  {TYPE_LABEL[q.type]}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: done ? doneBorder : accent }}>
                  {done ? "COMPLETE" : `+${q.xpReward} XP`}
                </span>
              </div>

              {/* Quest description */}
              <p style={{
                margin: "0 0 14px", fontSize: 15, fontWeight: 600,
                color: done ? doneBorder : textPri, lineHeight: 1.4,
              }}>
                {q.label}
              </p>

              {/* Progress bar */}
              <div style={{ height: 5, background: barBg, borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  width:        `${pct}%`,
                  height:       "100%",
                  background:   done
                    ? doneBorder
                    : dark
                      ? "linear-gradient(90deg, #ff6a00, #ffaa00)"
                      : "linear-gradient(90deg, #0066cc, #00aaff)",
                  borderRadius: 99,
                  transition:   "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                }} />
              </div>

              {/* Progress count + action link */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: textSub }}>
                  {done ? "XP awarded" : `${q.progress} / ${q.required}`}
                </span>
                {!done && (
                  <Link to={meta.to} style={{
                    fontSize: 11, fontWeight: 700, color: accent,
                    textDecoration: "none", letterSpacing: "0.05em",
                    padding: "4px 10px",
                    border: `1px solid ${accentGlow}`,
                    borderRadius: 6, background: accentGlow,
                  }}>
                    {meta.action} →
                  </Link>
                )}
              </div>

            </div>
          )
        })}

        {/* All done banner */}
        {!loading && allDone && (
          <div style={{
            marginTop: 20, padding: "18px 22px",
            background: doneBg, border: `1.5px solid ${doneBorder}`,
            borderRadius: 14, textAlign: "center",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: doneBorder }}>
              All daily quests complete
            </p>
            <p style={{ margin: 0, fontSize: 13, color: textSub }}>
              Come back tomorrow for a new set. Total earned: {earnedXP} XP.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}