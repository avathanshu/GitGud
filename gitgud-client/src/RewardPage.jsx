import { useState, useEffect } from "react";
import { ACHIEVEMENTS } from "./achievement";
import "./RewardPage.css";
import { doc, getDoc, getDocs, collection, updateDoc } from "firebase/firestore";
import { db } from "./firebase";


export default function RewardPage({ user }) {
    const [activeTab, setActiveTab] = useState("achievements");
    const [stats, setStats] = useState({});
    const categories = ["aim", "reaction", "leaderboard", "daily", "quiz"];
    const [achievementCategory, setAchievementCategory] = useState("aim");
    const [rank, setRank] = useState(null);
    const [ selectedAchievement,setSelectedAchievement] = useState(null);
    const [equippedAchievement, setEquippedAchievement] = useState([]);

    async function loadStats() {
  if (!user?.uid) return;

  const snap =
    await getDoc(
      doc(db, "users", user.uid)
    );

  if (snap.exists()) {
    const data = snap.data();

    setStats( data.stats || {});

    setEquippedAchievement( data.equippedAchievement || []);
  }

  const usersSnap =
    await getDocs(
      collection(db, "users")
    );

    console.log("Users found: ", usersSnap.docs.length);

  const sortedUsers =
    usersSnap.docs
      .map(doc => ({ uid: doc.id, ...doc.data() })) .sort( (a, b) => (b.xp ?? 0) - (a.xp ?? 0));

      console.log("Sorted users: ", sortedUsers);

  const myRank =
    sortedUsers.findIndex(
      u => u.uid === user.uid
    ) + 1;

  console.log("My UID: ", user.uid);
  console.log("My Rank: ", myRank);
  setRank(myRank);
}

    useEffect(() => {
        loadStats();
    }, [user?.uid]);


 async function handleEquip(
  achievementId
) {

  let updated = [...equippedAchievement];

  // remove if already equipped
  if (updated.includes(
    achievementId
  )) {
    updated = updated.filter(
      id => id !== achievementId
    );
  }
  else {

    // max 3 equipped
    if (updated.length >= 3) {
      alert(
        "Maximum 3 achievements equipped."
      );
      return;
    }

    updated.push(achievementId);
  }

  await updateDoc(
    doc(db, "users", user.uid),
    {
      equippedAchievement:
        updated
    }
  );

  setEquippedAchievement(
    updated
  );
}   

    function isUnlocked(id) {
  switch (id) {

    case "first_blood":
      return (stats?.aim?.totalSessions || 0) >= 1;

    case "turbo_mode":
      return (stats?.reaction?.totalSessions || 0) >= 1;

    case "sharpshooter":
      return (stats?.aim?.bestAccuracy || 0) >= 90;

    case "cheetah":
      return (stats?.reaction?.bestAverage || 9999) < 220;

    case "lightning_hawk":
      return (stats?.reaction?.bestAverage || 9999) < 190;

    // QUIZ

    case "student":
      return (stats?.quiz?.quizzesCompleted || 0) >= 1;

    case "scholar":
      return (stats?.quiz?.perfectScores || 0) >= 5;

    case "quiz_master":
      return (stats?.quiz?.perfectScores || 0) >= 10;

    // DAILIES

    case "the_journey_begins":
      return (stats?.dailies?.completed || 0) >= 1;

    case "consistent":
      return (stats?.dailies?.longestStreak || 0) >= 3;

    case "dedicated":
      return (stats?.dailies?.longestStreak || 0) >= 7;

    case "unstoppable":
      return (stats?.dailies?.longestStreak || 0) >= 30;

    // LEADERBOARD
    case "leaderboard_gold":
      return rank !== null && rank === 1;

    case "leaderboard_silver":
      return rank !== null && rank === 2;

    case "leaderboard_bronze":
      return rank !== null && rank === 3;

    default:
      return false;
  }
}

    console.log("Current rank:", rank);

  const unlockedCount = ACHIEVEMENTS.filter(
    achievement => isUnlocked(achievement.id)
  ).length;

 return (
    <div className="rewards-container">
      <div className="rewards-card">

        <h1 className="rewards-title">
          🏆 Rewards
        </h1>

        <p className="rewards-progress">
          {unlockedCount} / {ACHIEVEMENTS.length} Achievements Unlocked
        </p>

        <div className="rewards-tabs">
          <button
            className={`tab-btn ${
              activeTab === "achievements" ? "active" : ""
            }`}
            onClick={() => setActiveTab("achievements")}
          >
            Achievements
          </button>

          <button
            className={`tab-btn ${
              activeTab === "frames" ? "active" : ""
            }`}
            onClick={() => setActiveTab("frames")}
          >
            Frames
          </button>

          <button
            className={`tab-btn ${
              activeTab === "titles" ? "active" : ""
            }`}
            onClick={() => setActiveTab("titles")}
          >
            Titles
          </button>
        </div>

        <hr className="divider" />

        <div className="reward-content">

          {activeTab === "achievements" && (
            <>
              <div className="rewards-header">
                <h2>Achievements</h2>
                <div style={{ textAlign: "center" }}>
  <p>
    Unlock achievements by Completing Challenges in the Aim Trainer,
    Reaction Trainer, Daily Quests, and Quiz sections!
  </p>

  <p>
    Each achievement you unlock will be displayed on your profile and
    may grant you special titles or frames!
  </p>
</div>
              </div>

              <div className="equipped-showcase">

  <h3>
    Equipped Achievements
    ({equippedAchievement.length}/3)
  </h3>

  <div className="equipped-grid">

    {equippedAchievement.length > 0
      ? equippedAchievement.map(id => {

          const achievement =
            ACHIEVEMENTS.find(
              a => a.id === id
            );

          if (!achievement) return null;

          return (
            <div
              key={id}
              className="equipped-slot"
            >
              {achievement.icon}
            </div>
          );
        })
      : (
        <p>
          No achievements equipped.
        </p>
      )}

  </div>

</div>

              <div className="achievement-category-tabs">

  <button
    className={`category-tab ${
      achievementCategory === "aim"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setAchievementCategory("aim")
    }
  >
    🎯 Aim
  </button>

  <button
    className={`category-tab ${
      achievementCategory === "reaction"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setAchievementCategory("reaction")
    }
  >
    ⚡ Reaction
  </button>

  <button
    className={`category-tab ${
      achievementCategory === "leaderboard"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setAchievementCategory("leaderboard")
    }
  >
    🏆 Leaderboard
  </button>

  <button
    className={`category-tab ${
      achievementCategory === "daily"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setAchievementCategory("daily")
    }
  >
    🔥 Dailies
  </button>

  <button
    className={`category-tab ${
      achievementCategory === "quiz"
        ? "active"
        : ""
    }`}
    onClick={() =>
      setAchievementCategory("quiz")
    }
  >
    🧠 Quiz
  </button>

</div>

<h3 className="category-heading">

  {achievementCategory === "aim" &&
    "🎯 Aim Trainer"}

  {achievementCategory === "reaction" &&
    "⚡ Reaction Trainer"}

  {achievementCategory === "leaderboard" &&
    "🏆 Leaderboard"}

  {achievementCategory === "daily" &&
    "🔥 Daily Quests"}

  {achievementCategory === "quiz" &&
    "🧠 Quiz Achievements"}

</h3>

<div className="achievement-grid">
  {ACHIEVEMENTS
    .filter(
      achievement =>
        achievement.category ===
        achievementCategory
    )
    .map((achievement) => {
                  const unlocked =
                    isUnlocked(achievement.id);

                  return (
<div
  key={achievement.id}
  className={`achievement-card ${
    unlocked ? "unlocked" : "locked"
  } ${
    selectedAchievement?.id === achievement.id
      ? "selected"
      : ""
  }`}
  onClick={() =>
    setSelectedAchievement(
      achievement
    )
  }
>
  <div className="achievement-icon">
    {achievement.icon}
  </div>

  <div className="achievement-info">
    <h3>{achievement.name}</h3>
    <p>{achievement.description}</p>
  </div>

  <div className="achievement-status">

    {unlocked ? (
      <>
        <span>
          {equippedAchievement.includes(
            achievement.id
          )
            ? "✅ Equipped"
            : "✅ Unlocked"}
        </span>

        {selectedAchievement?.id === achievement.id && (
          <button
            className="equip-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleEquip(
                achievement.id
              );
            }}
          >
            {equippedAchievement.includes(
              achievement.id
            )
              ? "Unequip"
              : "Equip"}
          </button>
        )}
      </>
    ) : (
      <span>🔒 Locked</span>
    )}

  </div>
</div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === "frames" && (
            <div className="coming-soon">
              <h2>Frames</h2>

              <div className="coming-soon-card">
                <div className="coming-soon-icon">
                  🖼️
                </div>

                <h3>Coming Soon</h3>

                <p>
                  Profile Frames will allow you to
                  customise the appearance of your
                  avatar border.
                </p>
              </div>
            </div>
          )}

          {activeTab === "titles" && (
            <div className="coming-soon">
              <h2>Titles</h2>

              <div className="coming-soon-card">
                <div className="coming-soon-icon">
                  🏷️
                </div>

                <h3>Coming Soon</h3>

                <p>
                  Titles will appear underneath your
                  username and can be earned through
                  achievements.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}