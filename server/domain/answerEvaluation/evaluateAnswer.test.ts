import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnswerEvaluationError,
  type AuthoritativeQuestionSnapshot,
} from "./types";
import { evaluateAnswer, toStudentAnswerFeedback } from "./evaluateAnswer";

const verifiedQuestion: AuthoritativeQuestionSnapshot = {
  questionId: "MTH-E-1",
  questionVersionId: "MTH-E-1:v1",
  status: "verified",
  options: {
    A: "x = -2 or x = -3",
    B: "x = 2 or x = 3",
    C: "x = -2 or x = 3",
    D: "x = 2 or x = -3",
  },
  correctOptionId: "A",
};

test("evaluates a correct answer from the trusted answer key", () => {
  const result = evaluateAnswer({
    question: verifiedQuestion,
    submittedOptionId: "A",
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  });
  assert.equal(result.isCorrect, true);
  assert.equal(result.correctOptionId, "A");
  assert.equal(result.algorithmVersion, "answer-evaluation-v1");
});

test("evaluates an incorrect answer without trusting client correctness", () => {
  const result = evaluateAnswer({
    question: verifiedQuestion,
    submittedOptionId: "B",
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  });
  assert.equal(result.isCorrect, false);
  assert.equal(result.correctOptionId, "A");
});

test("rejects unverified questions", () => {
  assert.throws(
    () => evaluateAnswer({
      question: { ...verifiedQuestion, status: "ai-draft" },
      submittedOptionId: "A",
    }),
    (error: unknown) =>
      error instanceof AnswerEvaluationError &&
      error.code === "QUESTION_NOT_VERIFIED",
  );
});

test("rejects invalid answer option identifiers", () => {
  assert.throws(
    () => evaluateAnswer({
      question: verifiedQuestion,
      submittedOptionId: "E",
    }),
    (error: unknown) =>
      error instanceof AnswerEvaluationError &&
      error.code === "INVALID_SUBMITTED_OPTION",
  );
});

test("rejects an incomplete authoritative question snapshot", () => {
  assert.throws(
    () => evaluateAnswer({
      question: {
        ...verifiedQuestion,
        options: { ...verifiedQuestion.options, D: "" },
      },
      submittedOptionId: "A",
    }),
    (error: unknown) =>
      error instanceof AnswerEvaluationError &&
      error.code === "INVALID_QUESTION_SNAPSHOT",
  );
});

test("rejects invalid evaluation timestamps", () => {
  assert.throws(
    () => evaluateAnswer({
      question: verifiedQuestion,
      submittedOptionId: "A",
      evaluatedAt: "not-a-date",
    }),
    (error: unknown) =>
      error instanceof AnswerEvaluationError &&
      error.code === "INVALID_EVALUATION_TIMESTAMP",
  );
});

test("student feedback does not expose the correct option", () => {
  const result = evaluateAnswer({
    question: verifiedQuestion,
    submittedOptionId: "B",
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  });
  const feedback = toStudentAnswerFeedback(result);
  assert.equal(feedback.isCorrect, false);
  assert.equal("correctOptionId" in feedback, false);
});
