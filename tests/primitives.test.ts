/**
 * Primitive smoke tests (M3). Renders each primitive to static markup in Node —
 * no DOM environment required.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PosterCard,
  ProgressBar,
  RatingStars,
  Row,
  Spinner,
} from "../src/design/primitives";

function render(node: ReactNode): string {
  return renderToStaticMarkup(createElement("div", null, node));
}

describe("primitives smoke", () => {
  it("Button renders with variant classes", () => {
    const html = render(createElement(Button, { variant: "primary" }, "OK"));
    expect(html).toContain("btn-primary");
    expect(html).toContain("OK");
  });

  it("Button marks disabled state", () => {
    const html = render(createElement(Button, { disabled: true }, "Nope"));
    expect(html).toContain("disabled");
  });

  it("Input renders label, hint and error", () => {
    const html = render(
      createElement(Input, {
        label: "Имя",
        hint: "подсказка",
        placeholder: "введите",
      }),
    );
    expect(html).toContain("Имя");
    expect(html).toContain("подсказка");

    const err = render(createElement(Input, { error: "ошибка" }));
    expect(err).toContain("ошибка");
    expect(err).toContain("input-invalid");
  });

  it("Badge renders tones", () => {
    const html = render(createElement(Badge, { tone: "accent" }, "HD"));
    expect(html).toContain("badge-accent");
    expect(html).toContain("HD");
  });

  it("Spinner renders with an optional label", () => {
    const html = render(createElement(Spinner, { label: "Загрузка…" }));
    expect(html).toContain("spinner");
    expect(html).toContain("Загрузка…");
  });

  it("ProgressBar exposes aria values", () => {
    const html = render(createElement(ProgressBar, { value: 25, label: "Прогресс" }));
    expect(html).toContain("progressbar");
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("Прогресс");
  });

  it("EmptyState and ErrorState render Russian defaults", () => {
    const empty = render(createElement(EmptyState, null));
    expect(empty).toContain("Пусто");

    const error = render(createElement(ErrorState, { onRetry: () => {} }));
    expect(error).toContain("Повторить");
    expect(error).toContain("state-error");
  });

  it("Modal renders nothing when closed", () => {
    const html = render(createElement(Modal, { open: false, title: "T", onClose: () => {} }, "body"));
    expect(html).not.toContain("modal-overlay");
  });

  it("Modal renders dialog chrome when open", () => {
    const html = render(
      createElement(Modal, { open: true, title: "Заголовок", onClose: () => {} }, "body"),
    );
    expect(html).toContain("modal-overlay");
    expect(html).toContain("Заголовок");
    expect(html).toContain("Закрыть");
  });

  it("RatingStars renders 5 stars and a null-safe label", () => {
    const html = render(createElement(RatingStars, { value: 8 }));
    expect(html).toContain("rating");
    expect(html).toContain("Оценка");

    const none = render(createElement(RatingStars, { value: null }));
    expect(none).toContain("Нет оценки");
  });

  it("PosterCard renders title and fallback art without a poster", () => {
    const html = render(createElement(PosterCard, { title: "Дюна", rating: 8.1 }));
    expect(html).toContain("Дюна");
    expect(html).toContain("poster-card");
    expect(html).toContain("poster-fallback");
  });

  it("PosterCard renders an anchor when href is set", () => {
    const html = render(createElement(PosterCard, { title: "X", href: "#/media/1" }));
    expect(html).toContain('href="#/media/1"');
  });

  it("Row renders title, subtitle and trailing content", () => {
    const html = render(
      createElement(
        Row,
        {
          title: "Имя файла",
          subtitle: "сезон 1",
          trailing: createElement(Badge, null, "HD"),
          onClick: () => {},
        },
      ),
    );
    expect(html).toContain("Имя файла");
    expect(html).toContain("сезон 1");
    expect(html).toContain("HD");
    expect(html).toContain("row");
  });
});
