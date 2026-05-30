import {
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

import { db } from "./firebase";

/* =========================
   HELPERS
========================= */

async function getUserData(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  return {
    userRef,
    data: snap.data() || {},
  };
}

/* =========================
   AIM TRAINER
========================= */
export async function updateAimStats(
  uid,
  hits,
  accuracy
) {

  console.log("updateAimStats called");
  console.log("Updating UID:", uid);
  try {
    const { userRef, data } =
      await getUserData(uid);

    const bestHits =
      data?.stats?.aim?.bestHits || 0;

    const bestAccuracy =
      data?.stats?.aim?.bestAccuracy || 0;

    const roundedAccuracy =
      Number(accuracy.toFixed(2));

    const updates = {
      "stats.aim.totalHits":
        increment(hits),

      "stats.aim.totalSessions":
        increment(1),
    };

    console.log("Updates:", updates);

    if (hits > bestHits) {
      updates["stats.aim.bestHits"] =
        hits;
    }

    if (roundedAccuracy > bestAccuracy) {
      updates["stats.aim.bestAccuracy"] =
        roundedAccuracy;
    }

    await updateDoc(userRef, updates);
    console.log("Update successful");
  }
  catch (err) {
    console.error(
      "Failed to update aim stats:",
      err
    );
  }
}

/* =========================
   REACTION TRAINER
========================= */

export async function updateReactionStats(
  uid,
  bestReaction,
  averageReaction
) {
  try {
    const { userRef, data } =
      await getUserData(uid);

    const currentBestReaction =
      data?.stats?.reaction?.bestReaction ??
      9999;

    const currentBestAverage =
      data?.stats?.reaction?.bestAverage ??
      9999;

    const updates = {
      "stats.reaction.totalSessions":
        increment(1),
    };

    // lower is better

    if (
      bestReaction <
      currentBestReaction
    ) {
      updates[
        "stats.reaction.bestReaction"
      ] = bestReaction;
    }

    if (
      averageReaction <
      currentBestAverage
    ) {
      updates[
        "stats.reaction.bestAverage"
      ] = averageReaction;
    }

    await updateDoc(userRef, updates);
  }
  catch (err) {
    console.error(
      "Failed to update reaction stats:",
      err
    );
  }
}

/* =========================
   QUIZZES
========================= */

export async function updateQuizStats(
  uid,
  correctAnswers,
  totalQuestions
) {
  try {
    const { userRef, data } =
      await getUserData(uid);

    const bestScore =
      data?.stats?.quiz?.bestScore || 0;

    const score =
      totalQuestions > 0
        ? Math.round(
            (correctAnswers /
              totalQuestions) *
              100
          )
        : 0;

    const updates = {
      "stats.quiz.quizzesCompleted":
        increment(1),

      "stats.quiz.questionsCorrect":
        increment(correctAnswers),
    };

    if (score === 100) {
      updates[
        "stats.quiz.perfectScores"
      ] = increment(1);
    }

    if (score > bestScore) {
      updates["stats.quiz.bestScore"] =
        score;
    }

    await updateDoc(userRef, updates);
  }
  catch (err) {
    console.error(
      "Failed to update quiz stats:",
      err
    );
  }
}

/* =========================
   DAILIES
========================= */

export async function updateDailyStats(
  uid,
  currentStreak
) {
  console.log(
    "updateDailyStats called",
    uid,
    currentStreak
  );

  try {
    const { userRef, data } =
      await getUserData(uid);

    console.log("Current data:", data);

    const longestStreak =
      data?.stats?.dailies?.longestStreak || 0;

    const updates = {
      "stats.dailies.completed":
        increment(1),

      "stats.dailies.currentStreak":
        currentStreak,
    };

    if (
      currentStreak >
      longestStreak
    ) {
      updates[
        "stats.dailies.longestStreak"
      ] = currentStreak;
    }

    console.log("Writing:", updates);

    await updateDoc(userRef, updates);

    console.log("Daily stats updated!");
  }
  catch (err) {
    console.error(
      "Failed to update daily stats:",
      err
    );
  }
}