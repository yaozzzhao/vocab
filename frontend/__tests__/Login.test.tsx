import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../components/Login";
import { createMockUser } from "./helpers";

vi.mock("../db", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getSecurityQuestions: vi.fn().mockResolvedValue([
    "What is your mother's maiden name?",
    "What was the name of your first pet?",
  ]),
  getSecurityQuestionForUser: vi.fn(),
  resetPassword: vi.fn(),
}));

import * as db from "../db";

describe("Login", () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login form", () => {
    it("renders login form by default", () => {
      render(<Login onLogin={onLogin} />);
      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("shows forgot password link", () => {
      render(<Login onLogin={onLogin} />);
      expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    });

    it("calls onLogin on successful login", async () => {
      const user = createMockUser();
      vi.mocked(db.login).mockResolvedValue({ user, token: "test-token" });

      render(<Login onLogin={onLogin} />);
      await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
      await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
      fireEvent.click(screen.getByText("Sign In"));

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith(user, "test-token");
      });
    });

    it("shows error on failed login", async () => {
      vi.mocked(db.login).mockRejectedValue(new Error("Invalid credentials"));

      render(<Login onLogin={onLogin} />);
      await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
      await userEvent.type(screen.getByPlaceholderText("Password"), "wrong");
      fireEvent.click(screen.getByText("Sign In"));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("shows loading state during login", async () => {
      vi.mocked(db.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: createMockUser(), token: "t" }), 500)),
      );

      render(<Login onLogin={onLogin} />);
      await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
      await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
      fireEvent.click(screen.getByText("Sign In"));

      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });
  });

  describe("register form", () => {
    beforeEach(() => {
      render(<Login onLogin={onLogin} />);
      fireEvent.click(screen.getByText("Register"));
    });

    it("switches to register form", () => {
      expect(screen.getByText("Create Account")).toBeInTheDocument();
    });

    it("shows security question select", () => {
      expect(screen.getByText("Security Question")).toBeInTheDocument();
    });

    it("shows CAPTCHA question", () => {
      expect(screen.getByText(/What is/)).toBeInTheDocument();
    });

    it("validates password minimum length", async () => {
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Username"), "newuser");
      await user.type(screen.getByPlaceholderText(/Password/), "12345");
      fireEvent.click(screen.getByText("Create Account"));

      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/)).toBeInTheDocument();
      });
    });

    it("calls register on successful registration", async () => {
      const user = createMockUser();
      vi.mocked(db.register).mockResolvedValue({ user, token: "new-token" });

      await userEvent.type(screen.getByPlaceholderText("Username"), "newuser");
      await userEvent.type(screen.getAllByPlaceholderText(/Password/)[0], "password123");
      fireEvent.change(screen.getAllByRole("combobox")[0], {
        target: { value: "What was the name of your first pet?" },
      });
      await userEvent.type(screen.getByPlaceholderText("Your answer"), "fluffy");
      await userEvent.type(screen.getByPlaceholderText("Answer"), "10");
      fireEvent.click(screen.getByText("Create Account"));

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith(user, "new-token");
      });
    });
  });

  describe("forgot password flow", () => {
    beforeEach(() => {
      render(<Login onLogin={onLogin} />);
      fireEvent.click(screen.getByText("Forgot password?"));
    });

    it("shows forgot password step 1 (username)", () => {
      expect(screen.getByText("Reset Password")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    });

    it("looks up security question on username submit", async () => {
      vi.mocked(db.getSecurityQuestionForUser).mockResolvedValue({
        userId: 1,
        question: "What was the name of your first pet?",
      });

      await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("What was the name of your first pet?")).toBeInTheDocument();
      });
    });

    it("shows error for unknown username", async () => {
      vi.mocked(db.getSecurityQuestionForUser).mockRejectedValue(new Error("User not found"));

      await userEvent.type(screen.getByPlaceholderText("Username"), "unknown");
      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("User not found")).toBeInTheDocument();
      });
    });

    it("completes full reset flow", async () => {
      vi.mocked(db.getSecurityQuestionForUser).mockResolvedValue({
        userId: 1,
        question: "What was the name of your first pet?",
      });
      vi.mocked(db.resetPassword).mockResolvedValue(undefined);

      await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Your answer")).toBeInTheDocument();
      });

      await userEvent.type(screen.getByPlaceholderText("Your answer"), "fluffy");
      fireEvent.click(screen.getByText("Next Step"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByPlaceholderText(/new password/i), "newpass123");
      fireEvent.click(screen.getByText("Reset Password"));

      await waitFor(() => {
        expect(db.resetPassword).toHaveBeenCalledWith(1, "fluffy", "newpass123");
      });

      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("navigates between login and register", () => {
      render(<Login onLogin={onLogin} />);

      fireEvent.click(screen.getByText("Register"));
      expect(screen.getByText("Create Account")).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Sign In/));
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("returns to login after forgot password completion", () => {
      render(<Login onLogin={onLogin} />);
      fireEvent.click(screen.getByText("Forgot password?"));
      fireEvent.click(screen.getByText("Back to Login"));
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("has back button from register", () => {
      render(<Login onLogin={onLogin} />);
      fireEvent.click(screen.getByText("Register"));
      fireEvent.click(screen.getByText("Back to Login"));
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });
  });
});
