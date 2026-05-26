// adminQuizUtils.test.js
// TDD unit tests for the Admin Quiz utility layer.
// Run with: npm test
//
// Follows the same TDD/Gherkin conventions already used in critiqueUtils.test.js.
//
// Covers (SOLID — each describe block tests one responsibility):
//   S – extractYouTubeId     (URL parsing, Single Responsibility)
//   S – normaliseValueAnswer (value normalisation)
//   S – isValueAnswerCorrect (enter_value answer checking)
//   S – isRankingCorrect     (rank answer checking)
//   S – validateAdminQuizForm (full form validation)
//   S – calculateScore        (score computation)

import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  normaliseValueAnswer,
  extractNumbers,
  isValueAnswerCorrect,
  isRankingCorrect,
  validateAdminQuizForm,
  calculateScore,
  makeMultiChoiceQuestion,
  makeRankQuestion,
  makeEnterValueQuestion,
  QUESTION_TYPES,
} from "../adminQuizUtils";

// ─────────────────────────────────────────────────────────────────────────────
// extractYouTubeId
// ─────────────────────────────────────────────────────────────────────────────
describe("extractYouTubeId", () => {
  it("extracts ID from a standard watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts ID from a shortened youtu.be URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts ID from an embed URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("accepts a raw 11-character video ID", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for an invalid URL", () => {
    expect(extractYouTubeId("https://www.google.com")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(extractYouTubeId("")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(extractYouTubeId(null)).toBeNull();
  });
  it("trims whitespace before parsing", () => {
    expect(extractYouTubeId("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normaliseValueAnswer
// ─────────────────────────────────────────────────────────────────────────────
describe("normaliseValueAnswer", () => {
  it("strips a dollar sign", () => {
    expect(normaliseValueAnswer("$4000")).toBe("4000");
  });
  it("strips a pound sign", () => {
    expect(normaliseValueAnswer("£4000")).toBe("4000");
  });
  it("strips commas from numbers", () => {
    expect(normaliseValueAnswer("4,000")).toBe("4000");
  });
  it("lowercases text", () => {
    expect(normaliseValueAnswer("4 Grenades")).toBe("4 grenades");
  });
  it("handles empty string", () => {
    expect(normaliseValueAnswer("")).toBe("");
  });
  it("handles null", () => {
    expect(normaliseValueAnswer(null)).toBe("");
  });
  it("trims leading and trailing whitespace", () => {
    expect(normaliseValueAnswer("  4000  ")).toBe("4000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractNumbers
// ─────────────────────────────────────────────────────────────────────────────
describe("extractNumbers", () => {
  it("extracts digits from a plain number string", () => {
    expect(extractNumbers("4000")).toBe("4000");
  });
  it("extracts digits from a mixed string", () => {
    expect(extractNumbers("4 grenades")).toBe("4");
  });
  it("returns empty string when no digits present", () => {
    expect(extractNumbers("grenades")).toBe("");
  });
  it("concatenates multiple digit groups", () => {
    expect(extractNumbers("4 or 5")).toBe("45");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValueAnswerCorrect
// ─────────────────────────────────────────────────────────────────────────────
describe("isValueAnswerCorrect", () => {
  it("matches identical plain numbers", () => {
    expect(isValueAnswerCorrect("4000", "4000")).toBe(true);
  });
  it("matches dollar sign vs plain number", () => {
    expect(isValueAnswerCorrect("$4000", "4000")).toBe(true);
  });
  it("matches plain number vs dollar sign", () => {
    expect(isValueAnswerCorrect("4000", "$4000")).toBe(true);
  });
  it("matches number with text vs plain number", () => {
    expect(isValueAnswerCorrect("4 grenades", "4")).toBe(true);
  });
  it("matches plain number vs number with text", () => {
    expect(isValueAnswerCorrect("4", "4 grenades")).toBe(true);
  });
  it("rejects incorrect number", () => {
    expect(isValueAnswerCorrect("5000", "4000")).toBe(false);
  });
  it("handles comma-formatted numbers", () => {
    expect(isValueAnswerCorrect("4,000", "$4000")).toBe(true);
  });
  it("is case-insensitive for text comparison", () => {
    expect(isValueAnswerCorrect("Blaze", "blaze")).toBe(true);
  });
  it("returns false for empty player answer", () => {
    expect(isValueAnswerCorrect("", "4000")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isRankingCorrect
// ─────────────────────────────────────────────────────────────────────────────
describe("isRankingCorrect", () => {
  it("returns true for matching orders", () => {
    expect(isRankingCorrect([0, 1, 2, 3], [0, 1, 2, 3])).toBe(true);
  });
  it("returns false for different orders", () => {
    expect(isRankingCorrect([1, 0, 2, 3], [0, 1, 2, 3])).toBe(false);
  });
  it("returns false for different lengths", () => {
    expect(isRankingCorrect([0, 1, 2], [0, 1, 2, 3])).toBe(false);
  });
  it("returns false for null input", () => {
    expect(isRankingCorrect(null, [0, 1, 2, 3])).toBe(false);
  });
  it("returns false for undefined input", () => {
    expect(isRankingCorrect(undefined, [0, 1, 2, 3])).toBe(false);
  });
  it("handles a two-item ranking", () => {
    expect(isRankingCorrect([1, 0], [1, 0])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAdminQuizForm
// ─────────────────────────────────────────────────────────────────────────────
describe("validateAdminQuizForm", () => {
  function validMultiQ() {
    return {
      type: QUESTION_TYPES.MULTI_CHOICE,
      question: "What is the best play here?",
      choices: ["Peek", "Retreat", "Wait", "Full eco"],
      correctIndex: 0,
      reason: "Peeking catches them off guard.",
    };
  }

  function validForm() {
    return { title: "Valorant Basics", game: "valorant", questions: [validMultiQ()] };
  }

  it("returns no errors for a fully valid form", () => {
    expect(validateAdminQuizForm(validForm())).toEqual({});
  });

  it("requires a title", () => {
    const f = { ...validForm(), title: "" };
    expect(validateAdminQuizForm(f).title).toBeDefined();
  });

  it("requires a valid game", () => {
    const f = { ...validForm(), game: "fortnite" };
    expect(validateAdminQuizForm(f).game).toBeDefined();
  });

  it("accepts cs2 as a valid game", () => {
    const f = { ...validForm(), game: "cs2" };
    expect(validateAdminQuizForm(f).game).toBeUndefined();
  });

  it("accepts other as a valid game", () => {
    const f = { ...validForm(), game: "other" };
    expect(validateAdminQuizForm(f).game).toBeUndefined();
  });

  it("requires at least one question", () => {
    const f = { ...validForm(), questions: [] };
    expect(validateAdminQuizForm(f).questions).toBeDefined();
  });

  it("rejects a video_mc question with no videoId", () => {
    const q = {
      type: QUESTION_TYPES.VIDEO_MC,
      ytUrl: "not-a-url", videoId: null, pauseAt: "8",
      question: "What is the best play?", choices: ["A","B","C","D"],
      correctIndex: 0, reason: "Because A."
    };
    expect(validateAdminQuizForm({ title: "T", game: "valorant", questions: [q] }).q0_ytUrl).toBeDefined();
  });

  it("rejects a video_mc question with no pauseAt", () => {
    const q = {
      type: QUESTION_TYPES.VIDEO_MC,
      ytUrl: "https://youtu.be/dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ", pauseAt: "",
      question: "What is the best play?", choices: ["A","B","C","D"],
      correctIndex: 0, reason: "Because A."
    };
    expect(validateAdminQuizForm({ title: "T", game: "valorant", questions: [q] }).q0_pauseAt).toBeDefined();
  });

  it("rejects a multi_choice question with empty question text", () => {
    const f = validForm();
    f.questions[0].question = "";
    expect(validateAdminQuizForm(f).q0_question).toBeDefined();
  });

  it("rejects a multi_choice question with no correct index", () => {
    const f = validForm();
    f.questions[0].correctIndex = null;
    expect(validateAdminQuizForm(f).q0_correctIndex).toBeDefined();
  });

  it("rejects a multi_choice question with a blank choice", () => {
    const f = validForm();
    f.questions[0].choices[2] = "";
    expect(validateAdminQuizForm(f).q0_choices).toBeDefined();
  });

  it("rejects a rank question with missing item labels", () => {
    const f = validForm();
    f.questions[0] = {
      ...makeRankQuestion(),
      question: "Rank these guns",
      correctOrder: [0, 1, 2, 3],
      reason: "Best to worst.",
    };
    f.questions[0].items[0].label = "";
    expect(validateAdminQuizForm(f).q0_items).toBeDefined();
  });

  it("rejects a rank question with images enabled but missing imageUrl", () => {
    const q = makeRankQuestion();
    q.question = "Rank these agents";
    q.useImages = true;
    q.items = [
      { label: "Jett",   imageUrl: "" },
      { label: "Reyna",  imageUrl: "https://example.com/reyna.jpg" },
      { label: "Phoenix",imageUrl: "https://example.com/phoenix.jpg" },
      { label: "Sage",   imageUrl: "https://example.com/sage.jpg" },
    ];
    q.correctOrder = [0, 1, 2, 3];
    q.reason = "Explanation.";
    expect(validateAdminQuizForm({ title: "T", game: "valorant", questions: [q] }).q0_images).toBeDefined();
  });

  it("rejects an enter_value question with no correct answer", () => {
    const q = makeEnterValueQuestion();
    q.question = "How much does the Phantom cost?";
    q.reason = "It costs $2900.";
    q.correctAnswer = "";
    expect(validateAdminQuizForm({ title: "T", game: "valorant", questions: [q] }).q0_correctAnswer).toBeDefined();
  });

  it("flags unknown question types", () => {
    const f = validForm();
    f.questions[0].type = "mystery";
    expect(validateAdminQuizForm(f).q0_type).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateScore
// ─────────────────────────────────────────────────────────────────────────────
describe("calculateScore", () => {
  it("returns 0 correct for an empty answers array", () => {
    expect(calculateScore([])).toEqual({ correct: 0, total: 0, points: 0 });
  });

  it("scores a correct multi_choice answer", () => {
    const answers = [{ type: QUESTION_TYPES.MULTI_CHOICE, playerAnswer: 2, correctIndex: 2 }];
    expect(calculateScore(answers).correct).toBe(1);
  });

  it("does not score an incorrect multi_choice answer", () => {
    const answers = [{ type: QUESTION_TYPES.MULTI_CHOICE, playerAnswer: 1, correctIndex: 2 }];
    expect(calculateScore(answers).correct).toBe(0);
  });

  it("scores a correct enter_value answer with dollar sign", () => {
    const answers = [{ type: QUESTION_TYPES.ENTER_VALUE, playerAnswer: "$4000", correctAnswer: "4000" }];
    expect(calculateScore(answers).correct).toBe(1);
  });

  it("scores a correct ranking answer", () => {
    const answers = [{ type: QUESTION_TYPES.RANK, playerAnswer: [0, 1, 2, 3], correctOrder: [0, 1, 2, 3] }];
    expect(calculateScore(answers).correct).toBe(1);
  });

  it("does not score an incorrect ranking", () => {
    const answers = [{ type: QUESTION_TYPES.RANK, playerAnswer: [1, 0, 2, 3], correctOrder: [0, 1, 2, 3] }];
    expect(calculateScore(answers).correct).toBe(0);
  });

  it("calculates points as correct * 10", () => {
    const answers = [
      { type: QUESTION_TYPES.MULTI_CHOICE, playerAnswer: 0, correctIndex: 0 },
      { type: QUESTION_TYPES.MULTI_CHOICE, playerAnswer: 1, correctIndex: 0 },
      { type: QUESTION_TYPES.MULTI_CHOICE, playerAnswer: 2, correctIndex: 2 },
    ];
    const result = calculateScore(answers);
    expect(result.correct).toBe(2);
    expect(result.points).toBe(20);
    expect(result.total).toBe(3);
  });
});
