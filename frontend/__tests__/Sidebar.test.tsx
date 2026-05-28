import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeftSidebar, RightSidebar } from "../components/Sidebar";
import { createMockUser, createMockStats } from "./helpers";

describe("LeftSidebar", () => {
  it("renders username and role", () => {
    const user = createMockUser();
    const stats = createMockStats();
    render(<LeftSidebar user={user} stats={stats} />);

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("shows initial letter fallback in avatar", () => {
    const user = createMockUser({ username: "Alice" });
    const stats = createMockStats();
    render(<LeftSidebar user={user} stats={stats} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows level and XP", () => {
    const user = createMockUser();
    const stats = createMockStats({ xp: 500, level: 3 });
    render(<LeftSidebar user={user} stats={stats} />);

    expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it("shows streak count", () => {
    const user = createMockUser();
    const stats = createMockStats({ streakCount: 7 });
    render(<LeftSidebar user={user} stats={stats} />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows today's stats", () => {
    const user = createMockUser();
    const stats = createMockStats({ totalCorrect: 80, totalWrong: 20, totalReviewsCompleted: 15 });
    render(<LeftSidebar user={user} stats={stats} />);

    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("handles null stats", () => {
    const user = createMockUser();
    render(<LeftSidebar user={user} stats={null} />);

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("RightSidebar", () => {
  it("renders overview card with word count", () => {
    render(
      <RightSidebar
        view="home"
        totalWords={500}
        totalMistakes={10}
        dueReviews={3}
        publishersCount={2}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows Review Now button when due reviews > 0", () => {
    render(
      <RightSidebar
        view="home"
        totalWords={500}
        totalMistakes={10}
        dueReviews={3}
        publishersCount={2}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Review Now")).toBeInTheDocument();
  });

  it("hides Review Now button when no due reviews", () => {
    render(
      <RightSidebar
        view="home"
        totalWords={500}
        totalMistakes={0}
        dueReviews={0}
        publishersCount={1}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.queryByText("Review Now")).not.toBeInTheDocument();
  });

  it("shows a daily quote", () => {
    render(
      <RightSidebar
        view="home"
        totalWords={500}
        totalMistakes={5}
        dueReviews={1}
        publishersCount={1}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Daily Motivation")).toBeInTheDocument();
  });

  it("returns null during test view", () => {
    const { container } = render(
      <RightSidebar
        view="test"
        totalWords={500}
        totalMistakes={5}
        dueReviews={1}
        publishersCount={1}
        onStartReview={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
