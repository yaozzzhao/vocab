import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Manager } from "../components/Manager";

vi.mock("../db", () => ({
  addWords: vi.fn(),
}));

describe("Manager", () => {
  const onImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders import interface", () => {
    render(<Manager onImport={onImport} />);
    expect(screen.getByText(/Import Vocabulary/i)).toBeInTheDocument();
  });

  it("shows paste area", () => {
    render(<Manager onImport={onImport} />);
    const textarea = screen.getByPlaceholderText(/paste/i);
    expect(textarea).toBeInTheDocument();
  });

  it("shows file input for JSON/CSV", () => {
    render(<Manager onImport={onImport} />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", ".json,.csv");
  });

  it("renders column mapping wizard when TSV/CSV data pasted", async () => {
    render(<Manager onImport={onImport} />);

    const textarea = screen.getByPlaceholderText(/paste/i);
    fireEvent.change(textarea, {
      target: { value: "Word\tMeaning\tUnit\nhello\t你好\tUnit 1\nworld\t世界\tUnit 1" },
    });

    await waitFor(() => {
      expect(screen.getByText("Word")).toBeInTheDocument();
    });
  });

  it("renders mapping select dropdowns for each detected column", async () => {
    render(<Manager onImport={onImport} />);

    const textarea = screen.getByPlaceholderText(/paste/i);
    fireEvent.change(textarea, {
      target: { value: "Word\tMeaning\tUnit\nhello\t你好\tUnit 1" },
    });

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("imports valid JSON data", async () => {
    render(<Manager onImport={onImport} />);

    const textarea = screen.getByPlaceholderText(/paste/i);
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          { word: "hello", meaning: "你好", unit: "Unit 1" },
        ]),
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/parsed/i)).toBeInTheDocument();
    });
  });
});
