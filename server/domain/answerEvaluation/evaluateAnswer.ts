import {
  ANSWER_EVALUATION_ALGORITHM_VERSION,
  OPTION_IDS,
  AnswerEvaluationError,
  type AnswerEvaluationInput,
  type AnswerEvaluationResult,
  type AuthoritativeQuestionSnapshot,
  type OptionId,
} from "./types";

function isOptionId(value: unknown): value is OptionId {
  return typeof value === "string" &&
    (OPTION_IDS as readonly string[]).includes(value);
}

function assertQuestionSnapshot(
  question: AuthoritativeQuestionSnapshot,
): void {
  if (
    !question ||
    typeof question.questionId !== "string" ||
    question.questionId.trim().length === 0 ||
    typeof question.questionVersionId !== "string" ||
    question.questionVersionId.trim().length === 0 ||
    !question.options ||
    typeof question.options !== "object"
  ) {
    throw new AnswerEvaluationError(
      "INVALID_QUESTION_SNAPSHOT",
      "The authoritative question snapshot is incomplete.",
    );
  }

  if (question.status !== "verified") {
    throw new AnswerEvaluationError(
      "QUESTION_NOT_VERIFIED",
      "Only verified questions can be used for scored answer evaluation.",
    );
  }

  if (!isOptionId(question.correctOptionId)) {
    throw new AnswerEvaluationError(
      "INVALID_QUESTION_SNAPSHOT",
      "The authoritative question has an invalid answer key.",
    );
  }

  for (const optionId of OPTION_IDS) {
    const optionText = question.options[optionId];
    if (typeof optionText !== "string" || optionText.trim().length === 0) {
      throw new AnswerEvaluationError(
        "INVALID_QUESTION_SNAPSHOT",
        `The authoritative question is missing option ${optionId}.`,
      );
    }
  }
}

/**
 * Deterministically evaluates an answer against a server-loaded, immutable
 * question snapshot. Never pass a question object received from a client.
 *
 * This function does not award XP, update mastery, or persist learning state.
 */
export function evaluateAnswer(
  input: AnswerEvaluationInput,
): AnswerEvaluationResult {
  assertQuestionSnapshot(input.question);

  if (!isOptionId(input.submittedOptionId)) {
    throw new AnswerEvaluationError(
      "INVALID_SUBMITTED_OPTION",
      "submittedOptionId must be one of A, B, C or D.",
    );
  }

  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(evaluatedAt))) {
    throw new AnswerEvaluationError(
      "INVALID_EVALUATION_TIMESTAMP",
      "evaluatedAt must be a valid date-time string.",
    );
  }

  return {
    algorithmVersion: ANSWER_EVALUATION_ALGORITHM_VERSION,
    questionId: input.question.questionId,
    questionVersionId: input.question.questionVersionId,
    submittedOptionId: input.submittedOptionId,
    correctOptionId: input.question.correctOptionId,
    isCorrect: input.submittedOptionId === input.question.correctOptionId,
    evaluatedAt: new Date(evaluatedAt).toISOString(),
  };
}

/**
 * Safe feedback projection for a student-facing response.
 * The correct option is deliberately excluded to prevent leaking the answer
 * key before the product's configured explanation/reveal stage.
 */
export function toStudentAnswerFeedback(
  result: AnswerEvaluationResult,
): {
  questionId: string;
  questionVersionId: string;
  isCorrect: boolean;
  evaluatedAt: string;
} {
  return {
    questionId: result.questionId,
    questionVersionId: result.questionVersionId,
    isCorrect: result.isCorrect,
    evaluatedAt: result.evaluatedAt,
  };
}
