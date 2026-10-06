/**
 * Reviews display + own-review form (M4). Russian UI strings.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { submitMediaReview } from "../../api/endpoints";
import type { ApiId, MediaDetail, ReviewResponse } from "../../api/types";
import { Badge, Button, EmptyState, RatingStars, Spinner } from "../../design/primitives";
import {
  buildReviewPayload,
  isValidReviewScore,
  REVIEW_SCORE_MAX,
  REVIEW_SCORE_MIN,
  resolveOwnReview,
} from "./reviewHelpers";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU");
}

/** One review row: score stars + numeric score + text + date. */
export function ReviewItem({
  review,
  isOwn = false,
}: {
  review: ReviewResponse;
  isOwn?: boolean;
}) {
  return (
    <article className="review-item">
      <header className="review-item-header">
        <RatingStars value={review.score} />
        <span className="review-score-text">{review.score} / 10</span>
        {isOwn ? <Badge tone="accent">Ваш отзыв</Badge> : null}
        <time className="review-date" dateTime={review.updated_at || review.created_at}>
          {formatDate(review.updated_at || review.created_at)}
        </time>
      </header>
      {review.review ? <p className="review-text">{review.review}</p> : null}
    </article>
  );
}

/** Scrollable list of reviews with loading / empty / error states. */
export function ReviewList({
  reviews,
  loading,
  error,
  onRetry,
  detail,
  currentUserId,
}: {
  reviews: ReviewResponse[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  detail?: Pick<MediaDetail, "user_review"> | null;
  currentUserId?: ApiId | null;
}) {
  if (loading) {
    return <Spinner label="Загрузка отзывов…" />;
  }
  if (error) {
    return (
      <div className="state state-error" role="alert">
        <strong>Не удалось загрузить отзывы</strong>
        <p>{error}</p>
        {onRetry ? (
          <div className="state-actions">
            <Button variant="secondary" onClick={onRetry}>
              Повторить
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Отзывов пока нет"
        description="Станьте первым, кто оценит этот фильм."
      />
    );
  }

  const own = resolveOwnReview(detail, reviews, currentUserId);
  return (
    <div className="review-list">
      {reviews.map((review) => (
        <ReviewItem
          key={String(review.id)}
          review={review}
          isOwn={own !== null && String(own.id) === String(review.id)}
        />
      ))}
    </div>
  );
}

/** 1–10 score picker + optional comment + submit. */
export function ReviewForm({
  mediaId,
  detail,
  reviews,
  currentUserId,
  onSubmitted,
}: {
  mediaId: string | number;
  detail: Pick<MediaDetail, "user_review"> | null;
  reviews: ReviewResponse[];
  currentUserId?: ApiId | null;
  /** Called after a successful PUT so the parent can refresh. */
  onSubmitted?: (review: ReviewResponse) => void;
}) {
  const own = resolveOwnReview(detail, reviews, currentUserId);
  const [score, setScore] = useState<number | null>(own?.score ?? null);
  const [text, setText] = useState(own?.review ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    if (score === null || !isValidReviewScore(score)) {
      setFormError("Выберите оценку от 1 до 10.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildReviewPayload(score, text);
      const savedReview = await submitMediaReview(mediaId, payload);
      setSaved(true);
      onSubmitted?.(savedReview);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Не удалось сохранить оценку.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel review-form" onSubmit={handleSubmit}>
      <h2 className="review-form-title">
        {own ? "Уже оценили" : "Ваша оценка"}
      </h2>
      {own ? (
        <p className="hint">Вы уже оценили этот фильм. Можно обновить оценку и отзыв.</p>
      ) : null}

      <fieldset className="score-fieldset" disabled={submitting}>
        <legend>Оценка (1–10)</legend>
        <div className="score-picker" role="radiogroup" aria-label="Оценка от 1 до 10">
          {Array.from({ length: REVIEW_SCORE_MAX }, (_, i) => i + REVIEW_SCORE_MIN).map(
            (value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={score === value}
                className={score === value ? "score-btn score-btn-active" : "score-btn"}
                onClick={() => setScore(value)}
                disabled={submitting}
              >
                {value}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <label className="input-field" htmlFor="review-text">
        <span className="input-label">Отзыв (необязательно)</span>
        <textarea
          id="review-text"
          className="input review-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={2000}
          disabled={submitting}
          placeholder="Несколько слов о фильме…"
        />
      </label>

      {formError ? (
        <p className="input-error" role="alert">
          {formError}
        </p>
      ) : null}
      {saved && !formError ? (
        <p className="hint" role="status">
          Оценка сохранена.
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={submitting || score === null}>
        {submitting ? "Сохранение…" : own ? "Обновить оценку" : "Оценить"}
      </Button>
    </form>
  );
}
