export const ANSWER_EVALUATION_ALGORITHM_VERSION = "answer-evaluation-v1" as const;

export const OPTION_IDS = ["A", "B", "C", "D"] as const;

export type OptionId = (typeof OPTION_IDS)[number];

export type EvaluatableQuestionStatus =
  | "verified"
  | "ai-draft"
  | "low-confidence"
  | "flagged";

export interface AuthoritativeQuestionSnapshot {
  /** Stable question identifier from the trusted question repository. */
  readonly questionId: string;
  /** Immutable version identifier for the exact question and answer key. */
  readonly questionVersionId: string;
  /** Only verified questions may be used for scored answer evaluation. */
  readonly status: EvaluatableQuestionStatus;
  readonly options: Readonly<Record<OptionId, string>>;
  /** Answer key loaded by the server; never accepted from the client. */
  readonly correctOptionId: OptionId;
}

export interface AnswerEvaluationInput {
  readonly question: AuthoritativeQuestionSnapshot;
  readonly submittedOptionId: string;
  readonly evaluatedAt?: string;
}

export interface AnswerEvaluationResult {
  readonly algorithmVersion: typeof ANSWER_EVALUATION_ALGORITHM_VERSION;
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly submittedOptionId: OptionId;
  readonly correctOptionId: OptionId;
  readonly isCorrect: boolean;
  readonly evaluatedAt: string;
}

export type AnswerEvaluationErrorCode =
  | "QUESTION_NOT_VERIFIED"
  | "INVALID_QUESTION_SNAPSHOT"
  | "INVALID_SUBMITTED_OPTION"
  | "INVALID_EVALUATION_TIMESTAMP";

export class AnswerEvaluationError extends Error {
  readonly code: AnswerEvaluationErrorCode;

  constructor(code: AnswerEvaluationErrorCode, message: string) {
    super(message);
    this.name = "AnswerEvaluationError";
    this.code = code;
  }
}
