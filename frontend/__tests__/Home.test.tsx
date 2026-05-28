import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Home } from "../components/Home";
import { createMockWord, createMockMistake } from "./helpers";
import type { Word, MistakeRecord, PausedTest } from "../types";

function renderHome({
  words = [],
  mistakes = [],
  onStartTest = vi.fn(),
  onNavigateManage = vi.fn(),
  onNavigateErrorBook = vi.fn(),
  pausedTest = null,
  onResumeTest = vi.fn(),
  isAdmin = false,
} = {}) {
  return render(
    <Home
      words={words}
      mistakes={mistakes}
      onStartTest={onStartTest}
      onNavigateManage={onNavigateManage}
      onNavigateErrorBook={onNavigateErrorBook}
      pausedTest={pausedTest}
      onResumeTest={onResumeTest}
      isAdmin={isAdmin}
    />,
  );
}

describe("Home", () => {
  it("shows empty state when no words", () => {
    renderHome();
    expect(screen.getByText(/No words/i)).toBeInTheDocument();
  });

  it("renders word count per unit for admin", () => {
    const words = [
      createMockWord({ unit: "Unit 1" }),
      createMockWord({ id: "w2", unit: "Unit 1", word: "world" }),
      createMockWord({ id: "w3", unit: "Unit 2", word: "foo" }),
    ];
    renderHome({ words, isAdmin: true });

    expect(screen.getByText("Unit 1")).toBeInTheDocument();
    expect(screen.getByText("Unit 2")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows smart review card for non-admin when due reviews exist", () => {
    const words = [createMockWord()];
    const mistakes = [createMockMistake({ nextReviewDate: Date.now() - 1000 })];
    renderHome({ words, mistakes });

    expect(screen.getByText(/Smart Review/i)).toBeInTheDocument();
  });

  it("shows due review count", () => {
    const words = [createMockWord()];
    const mistakes = [createMockMistake({ nextReviewDate: Date.now() - 1000 })];
    renderHome({ words, mistakes });

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows total mistakes count", () => {
    const words = [createMockWord(), createMockWord({ id: "w2", word: "world" })];
    const mistakes = [
      createMockMistake({ wordId: "w1" }),
      createMockMistake({ wordId: "w2" }),
    ];
    renderHome({ words, mistakes });

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows resume card when paused test exists", () => {
    const pausedTest: PausedTest = {
      config: { mode: "unit", unitName: "Unit 1", words: [createMockWord()] },
      questions: [createMockWord()],
      currentIndex: 2,
      answers: {},
    };
    renderHome({ pausedTest, words: [createMockWord()] });

    expect(screen.getByText(/Resume/i)).toBeInTheDocument();
  });

  it("calls onResumeTest when resume clicked", () => {
    const onResumeTest = vi.fn();
    const pausedTest: PausedTest = {
      config: { mode: "unit", unitName: "Unit 1", words: [createMockWord()] },
      questions: [createMockWord()],
      currentIndex: 2,
      answers: {},
    };
    renderHome({ pausedTest, onResumeTest, words: [createMockWord()] });

    fireEvent.click(screen.getByText(/Resume/i));
    expect(onResumeTest).toHaveBeenCalledOnce();
  });

  it("starts unit test on unit click when words <= 100", () => {
    const onStartTest = vi.fn();
    const words = [createMockWord({ unit: "Unit A" })];
    renderHome({ words, onStartTest });

    fireEvent.click(screen.getByText("Unit A"));

    expect(onStartTest).toHaveBeenCalledWith({
      mode: "unit",
      unitName: "Unit A",
      words,
    });
  });

  it("starts review test", () => {
    const onStartTest = vi.fn();
    const word = createMockWord();
    const mistake = createMockMistake({ nextReviewDate: Date.now() - 1000 });
    renderHome({ words: [word], mistakes: [mistake], onStartTest });

    fireEvent.click(screen.getByText("Start Review"));

    expect(onStartTest).toHaveBeenCalledWith({
      mode: "review",
      words: [word],
    });
  });

  it("shows word count modal for units with > 100 words", () => {
    const words: Word[] = Array.from({ length: 105 }, (_, i) =>
      createMockWord({ id: `w${i}`, unit: "Big Unit", word: `word${i}` }),
    );
    const onStartTest = vi.fn();
    renderHome({ words, onStartTest });

    fireEvent.click(screen.getByText("Big Unit"));

    expect(screen.getByText(/words/)).toBeInTheDocument();
  });

  it("navigates to manage page when Manage button clicked", () => {
    const onNavigateManage = vi.fn();
    const words = [createMockWord()];
    renderHome({ words, isAdmin: true, onNavigateManage });

    expect(screen.getByText("Manage Vocabulary")).toBeInTheDocument();
  });

  it("shows filter button when metadata exists", () => {
    const words = [
      createMockWord({ publisher: "Cambridge" }),
      createMockWord({ id: "w2", word: "test", publisher: "Cambridge" }),
    ];
    renderHome({ words });

    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("opens filter panel when filter button clicked and shows filter options", () => {
    const words = [
      createMockWord({ publisher: "Cambridge", grade: 3, semester: "S1" }),
    ];
    renderHome({ words });

    fireEvent.click(screen.getByText("Filter"));
    expect(screen.getByText("Publisher")).toBeInTheDocument();
  });
});
