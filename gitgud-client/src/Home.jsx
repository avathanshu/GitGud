import { Navigate, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "./context/ThemeContext";
import { usePoints } from "./usePoints";

const defaultCards = [
  {
    to: "/quiz",
    label: "Quiz",
    tagline: "Think you know your agents?",
    category: "quiz",
    isDefault: true,
    desc: "Game sense. Map knowledge. Lore you definitely didn't skip.",
    preview: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg",
  },
  {
    to: "/practice/aim",
    label: "Aim Trainer",
    tagline: "Your aim isn't gonna fix itself.",
    category: "practice-aim",
    isDefault: true,
    desc: "Click heads. Build muscle memory. Blame your mouse anyway.",
    preview: null,
  },
  {
    to: "/leaderboard",
    label: "Leaderboard",
    tagline: "Glory or humiliation. Both are motivating.",
    category: "leaderboard",
    isDefault: true,
    desc: "Top 20 players ranked by XP. Where do you stand?",
    preview: null,
  },
  {
    to: null,
    label: "Profile",
    tagline: "You, but as a stat sheet.",
    category: "profile",
    isDefault: true,
    desc: "Track your XP, level up, and watch your progress compound.",
    preview: null,
    isProfile: true,
  },
];

const filterCards = [
  {
    to: "/messages",
    label: "Messages",
    category: "messages",
    tagline: "Your direct chats and inbox.",
    desc: "Keep up with conversations and replies.",
    preview: MessagesPreview,
  },
  {
    to: "/dailies",
    label: "Dailies",
    category: "dailies",
    tagline: "Your daily quests.",
    desc: "Check today’s challenges and earn rewards.",
    preview: DailiesPreview,
  },
  {
    to: "/user-quiz",
    label: "User Quizzes",
    category: "user-quiz",
    tagline: "Community clips and plays.",
    desc: "Try quizzes created by other players or create your own to share!",
    preview: UserQuizPreview,
  },
  {
    to: "/critique",
    label: "User Critique",
    category: "critique",
    tagline: "Post your clips for feedback.",
    desc: "Get advice and improve your gameplay.",
    preview: CritiquePreview,
  },
  {
    to: "/practice/reaction",
    label: "Reaction Trainer",
    category: "practice-reaction",
    tagline: "Test your reflexes.",
    desc: "Respond quickly to visual cues. Improve your reaction time.",
    preview: ReactionPreview,
  },
];

const filterOptions = [...defaultCards, ...filterCards];

const defaultFilterPreferences = {
  selectedLinks: defaultCards.map((card) => card.category),
};

function AimPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="80" cy="50" r="36" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
      <circle cx="80" cy="50" r="22" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6" />
      <circle cx="80" cy="50" r="10" fill="none" stroke={accent} strokeWidth="2" opacity="0.9" />
      <circle cx="80" cy="50" r="3" fill={accent} />
      <line x1="80" y1="14" x2="80" y2="30" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="80" y1="70" x2="80" y2="86" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="44" y1="50" x2="60" y2="50" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="100" y1="50" x2="116" y2="50" stroke={accent} strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function LeaderboardPreview({ accent, textSub }) {
  const bars = [72, 100, 55, 40, 30];
  const names = ["#1", "#2", "#3", "#4", "#5"];
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      {bars.map((h, i) => (
        <g key={i}>
          <rect x={12 + i * 30} y={90 - h * 0.7} width={18} height={h * 0.7} rx="3"
            fill={i === 0 ? accent : "rgba(128,128,128,0.25)"} opacity={i === 0 ? 1 : 0.7} />
          <text x={21 + i * 30} y={96} textAnchor="middle" fontSize="8" fill={textSub}>{names[i]}</text>
        </g>
      ))}
    </svg>
  );
}

function ProfilePreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="80" cy="34" r="18" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
      <circle cx="80" cy="34" r="7" fill={accent} opacity="0.5" />
      <path d="M44 88 Q44 66 80 66 Q116 66 116 88" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <rect x="30" y="76" width="30" height="4" rx="2" fill={accent} opacity="0.3" />
      <rect x="30" y="84" width="20" height="3" rx="1.5" fill={accent} opacity="0.2" />
      <rect x="100" y="76" width="30" height="4" rx="2" fill={accent} opacity="0.3" />
      <rect x="100" y="84" width="20" height="3" rx="1.5" fill={accent} opacity="0.2" />
    </svg>
  );
}

function MessagesPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <rect x="34" y="26" width="92" height="48" rx="10" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.7" />
      <path d="M58 74 L48 88 L82 74" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.5" />
      <circle cx="58" cy="50" r="4" fill={accent} opacity="0.8" />
      <circle cx="80" cy="50" r="4" fill={accent} opacity="0.55" />
      <circle cx="102" cy="50" r="4" fill={accent} opacity="0.35" />
    </svg>
  );
}

function DailiesPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <rect x="42" y="20" width="76" height="64" rx="8" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.65" />
      <line x1="58" y1="36" x2="102" y2="36" stroke={accent} strokeWidth="1.5" opacity="0.35" />
      <path d="M58 52 L66 60 L84 42" fill="none" stroke={accent} strokeWidth="2.4" opacity="0.85" />
      <path d="M58 70 L66 76 L86 56" fill="none" stroke={accent} strokeWidth="2.4" opacity="0.45" />
    </svg>
  );
}

function UserQuizPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="58" cy="34" r="12" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.6" />
      <circle cx="102" cy="34" r="12" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.6" />
      <path d="M38 76 Q38 58 58 58 Q78 58 78 76" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.45" />
      <path d="M82 76 Q82 58 102 58 Q122 58 122 76" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.45" />
      <text x="80" y="52" textAnchor="middle" fontSize="26" fontWeight="800" fill={accent} opacity="0.8">?</text>
    </svg>
  );
}

function CritiquePreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <rect x="34" y="24" width="92" height="52" rx="8" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.65" />
      <polygon points="72,40 72,62 94,51" fill={accent} opacity="0.55" />
      <path d="M42 84 L58 68" stroke={accent} strokeWidth="1.8" opacity="0.45" />
      <path d="M116 84 L102 68" stroke={accent} strokeWidth="1.8" opacity="0.45" />
    </svg>
  );
}

function ReactionPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="80" cy="50" r="24" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.55" />
      <path d="M80 50 L96 34" stroke={accent} strokeWidth="2.4" opacity="0.85" />
      <circle cx="80" cy="50" r="4" fill={accent} opacity="0.9" />
      <path d="M46 28 L34 16" stroke={accent} strokeWidth="1.6" opacity="0.45" />
      <path d="M114 28 L126 16" stroke={accent} strokeWidth="1.6" opacity="0.45" />
      <path d="M46 72 L34 84" stroke={accent} strokeWidth="1.6" opacity="0.45" />
      <path d="M114 72 L126 84" stroke={accent} strokeWidth="1.6" opacity="0.45" />
    </svg>
  );
}

// Main home/dashboard component

function Home({ user }) {
  const { theme } = useTheme();
  const { xp, level, pct, xpToNext, isMax } = usePoints(user?.uid);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState(defaultFilterPreferences);
  const [appliedPreferences, setAppliedPreferences] = useState(defaultFilterPreferences);

  useEffect(() => {
    if (!user?.uid) return;

    const savedPreferences = localStorage.getItem(`filterPreferences:${user.uid}`);

    const preferences = savedPreferences
      ? JSON.parse(savedPreferences)
      : user.filterPreferences || defaultFilterPreferences;

    setDraftPreferences(preferences);
    setAppliedPreferences(preferences);
    user.filterPreferences = preferences;
  }, [user]);

  // Compute visible cards based on applied filter preferences.
 const visibleCards = useMemo(() => {
  const allCards = [...defaultCards, ...filterCards];

  return allCards.filter((card) =>
    appliedPreferences.selectedLinks.includes(card.category)
  );
}, [appliedPreferences]);

  if (user === undefined) return <div style={{ color: "var(--qc-text)", padding: "2rem" }}>Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const dark = theme === "dark";
  const accent = dark ? "#ff6a00" : "#0066cc";
  const accentGlow = dark ? "rgba(255,106,0,0.5)" : "rgba(0,102,204,0.4)";
  const textSub = dark ? "#888" : "#777";
  const barBg = dark ? "rgba(255,106,0,0.12)" : "rgba(0,102,204,0.12)";

  const toggleFilterLink = (category) => {
    setDraftPreferences((current) => {
      const selected = current.selectedLinks.includes(category);

      return {
        ...current,
        selectedLinks: selected
          ? current.selectedLinks.filter((item) => item !== category)
          : [...current.selectedLinks, category],
      };
    });
  };

  const storeFilterPreferences = (preferences) => {
    user.filterPreferences = preferences;
    localStorage.setItem(`filterPreferences:${user.uid}`, JSON.stringify(preferences));
  };

  const applyFilters = () => {
    setAppliedPreferences(draftPreferences);
    storeFilterPreferences(draftPreferences);
    setIsFilterOpen(false);
  };

  const closeFilters = () => {
    storeFilterPreferences(draftPreferences);
    setIsFilterOpen(false);
  };

  // Layout logic for 2x2 grid: if there's an odd card out, center it in the bottom row.
const bottomRowCount = Math.ceil(visibleCards.length / 2);
const topRowCount = visibleCards.length - bottomRowCount;

// If there are 2 or fewer cards, just show them in one row. Otherwise, split into two rows.
const cardRows =
  visibleCards.length <= 2
    ? [visibleCards] : [
        visibleCards.slice(0, topRowCount),
        visibleCards.slice(topRowCount),
      ];
// Calculate the maximum number of cards in any row to determine grid layout.
const maxCardsInRow = Math.max(...cardRows.map((row) => row.length));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2.5rem 2rem 3rem",
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem", width: "100%", maxWidth: 680 }}>
        <p
          style={{
            color: accent,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: "0 0 6px",
            opacity: 0.85,
          }}
        >
          Welcome back
        </p>

        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 800,
            color: "var(--qc-text)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {user.displayName || user.email?.split("@")[0] || "Player"}
        </h1>

        {/* XP meter */}
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            background: dark ? "rgba(255,106,0,0.07)" : "rgba(0,102,204,0.06)",
            border: `1px solid ${dark ? "rgba(255,106,0,0.2)" : "rgba(0,102,204,0.2)"}`,
            borderRadius: 12,
            padding: "10px 20px",
            minWidth: 240,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <span style={{ color: accent, fontSize: 13, fontWeight: 800 }}>Level {level}</span>
            <span style={{ color: textSub, fontSize: 12 }}>{xp} xp</span>
          </div>

          <div style={{ width: "100%", height: 6, background: barBg, borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: accent,
                borderRadius: 99,
                boxShadow: `0 0 8px ${accentGlow}`,
                transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            />
          </div>

          <span style={{ color: textSub, fontSize: 11 }}>
            {isMax ? "MAX LEVEL" : `${xpToNext} xp to Level ${level + 1}`}
          </span>
        </div>
      </div>

      {/* Filter tab */}
      <div style={{ width: "100%", maxWidth: 740, marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          style={{
            border: `1.5px solid ${accent}`,
            background: "transparent",
            color: accent,
            borderRadius: 10,
            padding: "9px 14px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Filter
        </button>

        {isFilterOpen && (
          <div
            role="dialog"
            aria-label="Filter options"
            style={{
              marginTop: 12,
              padding: 16,
              background: "var(--qc-surface)",
              border: "1.5px solid rgba(128,128,128,0.16)",
              borderRadius: 12,
              boxShadow: `0 0 18px var(--qc-frame-glow)`,
            }}
          >
            <p style={{ margin: "0 0 10px", color: "var(--qc-text)", fontWeight: 800 }}>
              Filter links
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {filterOptions.map((option) => {
                const selected = draftPreferences.selectedLinks.includes(option.category);
                return (
                <button
                key={option.category}
                type="button"
                onClick={() => toggleFilterLink(option.category)}
                aria-pressed={selected}
                style={{
                  border: `1.5px solid ${selected ? accent : "rgba(128,128,128,0.22)"}`,
                  background: selected ? accent : "transparent",
                  color: selected ? "#fff" : "var(--qc-text)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: 800,
                  cursor: "pointer", }}
                  >
                    {option.label} 
                    </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={applyFilters}
                style={{
                  border: "none",
                  background: accent,
                  color: "#fff",
                  borderRadius: 10,
                  padding: "9px 14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Apply
              </button>

              <button
                type="button"
                onClick={closeFilters}
                style={{
                  border: "1.5px solid rgba(128,128,128,0.22)",
                  background: "transparent",
                  color: "var(--qc-text)",
                  borderRadius: 10,
                  padding: "9px 14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card rows */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "1.1rem",
    width: "100%",
    maxWidth: 940,
  }}
>
  {visibleCards.length === 0 ? (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      color: textSub,
      textAlign: "center",
      padding: "2rem",
      border: "1.5px solid rgba(128,128,128,0.16)",
      borderRadius: 14,
      background: "var(--qc-surface)",
      minHeight: 260,
    }}
  >
    <img
      src="./public/kek.png"
      alt="Kek dog"
      style={{
        width: 150,
        height: 150,
        objectFit: "contain",
        opacity: 0.95,
      }}
    />

    <p
      style={{
        margin: 0,
        color: "var(--qc-text)",
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      Hmm, no preferences? Pretty boring.
    </p>
  </div>
) : (
  cardRows.map((row, rowIndex) => (
    <div
      key={rowIndex}
      style={{
        display: "flex",
        gap: "1.1rem",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {row.map((card) => {
        const to = card.isProfile ? `/profile/${user.uid}` : card.to;

        return (
          <Link
            key={card.label}
            to={to}
            style={{
              textDecoration: "none",
              flex: "0 0 calc((100% - 2.2rem) / 3)",
              maxWidth: "calc((100% - 2.2rem) / 3)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                background: "var(--qc-surface)",
                border: "1.5px solid rgba(128,128,128,0.12)",
                borderRadius: 14,
                overflow: "hidden",
                height: "100%",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = accent;
                e.currentTarget.style.boxShadow = `0 0 18px var(--qc-frame-glow)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(128,128,128,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Preview */}
              <div
              style={{
                height: 140,
                background: dark ? "#111" : "#eef2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                }}
                >
                  {typeof card.preview === "string" ? (
                    <>
                    <img
                    src={card.preview}
                    alt={card.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: 0.7,
                    }}
                    />
                    <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                      "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
                    }}
                    />
                    </>
                    ) : card.preview ? (
                    <card.preview accent={accent} textSub={textSub} />
                  ) : card.label === "Aim Trainer" ? (
                  <AimPreview accent={accent} />
                ) : card.label === "Leaderboard" ? (
                <LeaderboardPreview accent={accent} textSub={textSub} />
              ) : (
              <ProfilePreview accent={accent} />
              )}
              </div>

              {/* Text */}
              <div style={{ padding: "16px 18px 18px" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  {card.label}
                </span>

                <p
                  style={{
                    margin: "0 0 5px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--qc-text)",
                    lineHeight: 1.3,
                  }}
                >
                  {card.tagline}
                </p>

                <p style={{ margin: 0, fontSize: 13, color: textSub, lineHeight: 1.5 }}>
                  {card.desc}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  ))
)}
</div>
    </div>
  );
}
export default Home;