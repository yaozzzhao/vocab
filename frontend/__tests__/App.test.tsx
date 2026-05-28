import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { createMockUser, createMockStats } from "./helpers";

vi.mock("../db", () => ({
  getWords: vi.fn().mockResolvedValue([]),
  getMistakes: vi.fn().mockResolvedValue([]),
  getUserStats: vi.fn(),
  updateUserStats: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  getSecurityQuestions: vi.fn().mockResolvedValue(["Q1", "Q2"]),
  getSecurityQuestionForUser: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  updateAvatar: vi.fn(),
  clearSession: vi.fn(),
  addWords: vi.fn(),
  clearAllUserData: vi.fn(),
  addOrUpdateMistakes: vi.fn(),
  removeMistake: vi.fn(),
}));

vi.mock("../store", () => ({
  useAppStore: () => ({
    words: [],
    mistakes: [],
    isLoaded: true,
    addWords: vi.fn(),
    clearAllData: vi.fn(),
    addMistakes: vi.fn(),
    handleReviewResult: vi.fn(),
    removeMistake: vi.fn(),
  }),
}));

import * as db from "../db";

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(db.getUserStats).mockResolvedValue(createMockStats());
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders Login page when no user is logged in", () => {
    render(<App />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("renders main layout with user in sessionStorage", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("VocabMaster")).toBeInTheDocument();
    });
  });

  it("shows user avatar in top bar when logged in", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });
  });

  it("opens user dropdown when avatar clicked", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      const avatar = screen.getByText("T");
      fireEvent.click(avatar);
    });

    expect(screen.getByText("Sign Out")).toBeInTheDocument();
    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.getByText("Change Avatar")).toBeInTheDocument();
  });

  it("shows Change Password modal from dropdown", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    fireEvent.click(screen.getByText("Change Password"));

    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/New password/)).toBeInTheDocument();
  });

  it("shows Avatar Picker from dropdown", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    fireEvent.click(screen.getByText("Change Avatar"));

    expect(screen.getByText("Choose Avatar")).toBeInTheDocument();
    expect(screen.getByText("🦊")).toBeInTheDocument();
  });

  it("changes avatar and persists to sessionStorage", async () => {
    vi.mocked(db.updateAvatar).mockResolvedValue(undefined);

    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    fireEvent.click(screen.getByText("Change Avatar"));
    fireEvent.click(screen.getByText("🦊"));

    await waitFor(() => {
      expect(db.updateAvatar).toHaveBeenCalledWith("preset:fox");
    });

    const stored = JSON.parse(sessionStorage.getItem("currentUser")!);
    expect(stored.avatar).toBe("preset:fox");
  });

  it("shows admin menu items for admin users", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser({ role: "admin" })));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    expect(screen.getByText("Manage Vocab")).toBeInTheDocument();
    expect(screen.getByText("Word Library")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
  });

  it("navigates to Manage Vocab view for admin", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser({ role: "admin" })));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    fireEvent.click(screen.getByText("Manage Vocab"));

    expect(screen.getByText(/Import/i)).toBeInTheDocument();
  });

  it("shows Gamification Hub when trophy clicked", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      const trophy = screen.getByTestId("icon-Trophy");
      fireEvent.click(trophy);
    });

    expect(screen.getByText(/Progress/i)).toBeInTheDocument();
  });

  it("handles logout correctly", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    fireEvent.click(screen.getByText("Sign Out"));

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    expect(sessionStorage.getItem("currentUser")).toBeNull();
  });

  it("closes user dropdown when clicking overlay", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("T"));
    });

    expect(screen.getByText("Sign Out")).toBeInTheDocument();

    const overlay = document.querySelector(".fixed.inset-0");
    if (overlay) fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });
  });

  it("shows streaks and XP in top bar", async () => {
    sessionStorage.setItem("currentUser", JSON.stringify(createMockUser()));
    sessionStorage.setItem("authToken", "test-token");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });
});
