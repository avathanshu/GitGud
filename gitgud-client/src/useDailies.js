// useDailies.js
// Central logic for the daily quests system.
// Stores dailies inside the existing users/{uid} document under a `dailies` field
// keyed by date — no new Firestore rules needed, no subcollections.
// Format: users/{uid}.dailies["YYYY-MM-DD"] = { quests: [...], date: "YYYY-MM-DD" }

import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "./firebase"
import { awardPoints } from "./usePoints"

// ─── Quest Pool (10 quests) ───────────────────────────────────────────────────
export const QUEST_POOL = [
  { id: "aim_acc_70",   type: "aim",      metric: "accuracy", threshold: 70, label: "Get ≥70% accuracy in Aim Trainer",     required: 1, xpReward: 30 },
  { id: "aim_acc_80",   type: "aim",      metric: "accuracy", threshold: 80, label: "Get ≥80% accuracy in Aim Trainer",     required: 1, xpReward: 50 },
  { id: "aim_sess_1",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete an Aim Trainer session",      required: 1, xpReward: 20 },
  { id: "aim_sess_2",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete 2 Aim Trainer sessions",      required: 2, xpReward: 40 },
  { id: "quiz_q_3",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 3 quiz questions correctly",    required: 3, xpReward: 30 },
  { id: "quiz_q_5",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 5 quiz questions correctly",    required: 5, xpReward: 50 },
  { id: "quiz_pass_60", type: "quiz",     metric: "passgame", threshold: 60, label: "Score ≥60% on a full quiz",            required: 1, xpReward: 40 },
  { id: "quiz_pass_80", type: "quiz",     metric: "passgame", threshold: 80, label: "Score ≥80% on a full quiz",            required: 1, xpReward: 60 },
  { id: "react_sess_1", type: "reaction", metric: "session",  threshold: 0,  label: "Complete a Reaction Trainer session",  required: 1, xpReward: 20 },
  { id: "react_sess_2", type: "reaction", metric: "session",  threshold: 0,  label: "Complete 2 Reaction Trainer sessions", required: 2, xpReward: 40 },
]

// ─── Pure: deterministic date-seeded pick ────────────────────────────────────
// Same date string always returns the same 3 quests for all users.
function hashDate(dateStr) {
  let h = 5381
  for (let i = 0; i < dateStr.length; i++) h = (h * 33) ^ dateStr.charCodeAt(i)
  return Math.abs(h)
}

export function pickDailyQuests(dateStr = todayKey()) {
  const seed = hashDate(dateStr)
  const pool = [...QUEST_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (seed * (i + 7919)) % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

export function isQuestComplete(quest) {
  return quest.progress >= quest.required
}

export function calcQuestXP(quest) {
  return isQuestComplete(quest) ? quest.xpReward : 0
}

export function applyProgress(quest, amount) {
  if (quest.done) return quest
  const newProgress = Math.min(quest.progress + amount, quest.required)
  return { ...quest, progress: newProgress, done: newProgress >= quest.required }
}

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Hook: useDailies ─────────────────────────────────────────────────────────
// Reads/writes users/{uid}.dailies[dateKey] — uses the existing user doc,
// so no new Firestore rules are required.

export function useDailies(uid) {
  const [quests, setQuests]   = useState([])
  const [loading, setLoading] = useState(true)
  const dateKey = todayKey()

  useEffect(() => {
    // No uid yet — stop loading so the page doesn't hang
    if (!uid) { setLoading(false); return }

    const ref = doc(db, "users", uid)

    getDoc(ref).then((snap) => {
      if (!snap.exists()) { setLoading(false); return }

      const data       = snap.data()
      const todayData  = data.dailies?.[dateKey]  // existing field, keyed by date

      if (todayData?.quests?.length) {
        // Already initialised today — load saved progress
        setQuests(todayData.quests)
      } else {
        // First visit today — pick 3 quests and write them into the user doc
        const fresh = pickDailyQuests(dateKey).map((q) => ({
          ...q, progress: 0, done: false, rewarded: false,
        }))
        // DAILIES: writes only to the nested dailies field — no other fields touched
        updateDoc(ref, { [`dailies.${dateKey}`]: { quests: fresh, date: dateKey } })
        setQuests(fresh)
      }
      setLoading(false)
    }).catch((err) => {
      console.error("useDailies: failed to load daily quests", err)
      setLoading(false)
    })
  }, [uid, dateKey])

  // Called by activity pages when a game event occurs.
  // type    : "aim" | "quiz" | "reaction"
  // payload : { accuracy?, correct?, passPct?, session? }
  const recordProgress = async (type, payload) => {
    if (!uid || quests.length === 0) return

    const ref = doc(db, "users", uid)

    const updated = await Promise.all(quests.map(async (q) => {
      if (q.type !== type || q.done) return q

      let increment = 0
      if (type === "aim") {
        if (q.metric === "session")                                    increment = 1
        if (q.metric === "accuracy" && payload.accuracy >= q.threshold) increment = 1
      }
      if (type === "quiz") {
        if (q.metric === "correct")                                          increment = payload.correct  ?? 0
        if (q.metric === "passgame" && (payload.passPct ?? 0) >= q.threshold) increment = 1
      }
      if (type === "reaction") {
        if (q.metric === "session") increment = 1
      }

      if (increment === 0) return q

      const next = applyProgress(q, increment)

      // Award XP exactly once when the quest first completes
      if (next.done && !q.rewarded) {
        await awardPoints(uid, next.xpReward)
        return { ...next, rewarded: true }
      }
      return next
    }))

    // DAILIES: writes only to the nested dailies field — no other fields touched
    updateDoc(ref, { [`dailies.${dateKey}`]: { quests: updated, date: dateKey } })
    setQuests(updated)
  }

  return { quests, loading, recordProgress }
}