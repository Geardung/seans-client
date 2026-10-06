/**
 * Credits rating popup (M8). Overlay over the player — does NOT pause.
 * Score 1–10 + optional comment; «Позже» / close dismisses for the session.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { submitMediaReview } from "../../api/endpoints";
import type { ApiId, ReviewResponse } from "../../api/types";
import { Button } from "../../design/primitives";
import {
  buildReviewPayload,
  isValidReviewScore,
  REVIEW_SCORE_MAX,
  REVIEW_SCORE_MIN,
} from "../reviews/reviewHelpers";

export type CreditsPopupProps = {
  mediaId: ApiId;
  /** Fired after a successful PUT so the parent can mark the popup as shown. */
  onSubmitted?: (review: ReviewResponse) => void;
  /** Dismiss without reviewing («Позже» / ×). */
  onDismiss: () => void;
};

export function CreditsPopup({
  mediaId,
  onSubmitted,
  onDismiss,
}: CreditsPopupProps) {
  const [score, setScore] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (score === null || !isValidReviewScore(score)) {
      setError("Выберите оценку от 1 до 10.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildReviewPayload(score, text);
      const saved = await submitMediaReview(mediaId, payload);
      onSubmitted?.(saved);
      onDismiss();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить оценку.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="credits-popup"
      role="dialog"
      aria-modal="false"
      aria-label="Оценка после титров"
    >
      <header className="credits-popup-header">
        <h2 className="credits-popup-title">Как вам фильм?</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Закрыть"
          disabled={submitting}
        >
          ×
        </Button>
      </header>

      <form className="credits-popup-form" onSubmit={handleSubmit}>
        <div
          className="score-picker"
          role="radiogroup"
          aria-label="Оценка от 1 до 10"
        >
          {Array.from(
            { length: REVIEW_SCORE_MAX },
            (_, i) => i + REVIEW_SCORE_MIN,
          ).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={score === value}
              className={
                score === value ? "score-btn score-btn-active" : "score-btn"
              }
              onClick={() => setScore(value)}
              disabled={submitting}
            >
              {value}
            </button>
          ))}
        </div>

        <textarea
          className="input review-textarea credits-popup-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          maxLength={2000}
          disabled={submitting}
          placeholder="Комментарий (необязательно)…"
          aria-label="Комментарий"
        />

        {error ? (
          <p className="input-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="credits-popup-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={submitting}
          >
            Позже
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting || score === null}
          >
            {submitting ? "Сохранение…" : "Оценить"}
          </Button>
        </div>
      </form>
    </div>
  );
}
