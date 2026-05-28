import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarDisplay, AvatarPicker } from "../components/Avatar";
import { createMockUser } from "./helpers";

describe("AvatarDisplay", () => {
  it("shows initial letter fallback when no avatar", () => {
    const user = createMockUser({ username: "Alice" });
    render(<AvatarDisplay user={user} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows emoji for preset avatar", () => {
    const user = createMockUser({ avatar: "preset:fox" });
    render(<AvatarDisplay user={user} size={40} />);
    expect(screen.getByText("🦊")).toBeInTheDocument();
  });

  it("renders img for data URL avatar", () => {
    const user = createMockUser({ avatar: "data:image/png;base64,abc" });
    render(<AvatarDisplay user={user} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(img).toHaveAttribute("alt", "avatar");
  });

  it("falls back to initial letter for unknown preset id", () => {
    const user = createMockUser({ avatar: "preset:unknown", username: "Bob" });
    render(<AvatarDisplay user={user} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const user = createMockUser({ avatar: "preset:fox" });
    const { container } = render(<AvatarDisplay user={user} className="my-custom-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("my-custom-class");
  });
});

describe("AvatarPicker", () => {
  it("renders all preset avatars", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    expect(screen.getByText("Choose Avatar")).toBeInTheDocument();
    expect(screen.getByText("🦊")).toBeInTheDocument();
    expect(screen.getByText("🐼")).toBeInTheDocument();
    expect(screen.getByText("🐨")).toBeInTheDocument();
    expect(screen.getByText("💎")).toBeInTheDocument();
  });

  it("calls onSelect with preset id when preset clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    fireEvent.click(screen.getByText("🦊"));
    expect(onSelect).toHaveBeenCalledWith("preset:fox");
  });

  it("highlights current avatar preset", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker currentAvatar="preset:fox" onSelect={onSelect} onClose={onClose} />);

    const foxBtn = screen.getByText("🦊").closest("button");
    expect(foxBtn?.className).toContain("ring-2");
    expect(foxBtn?.className).toContain("ring-brand-500");
  });

  it("calls onClose when Cancel clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when X button clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    const closeBtn = screen.getByText("✕");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows file upload label", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    expect(screen.getByText("Upload Image")).toBeInTheDocument();
    expect(screen.getByText("📁")).toBeInTheDocument();
  });

  it("renders file input with correct accept types", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AvatarPicker onSelect={onSelect} onClose={onClose} />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/png,image/jpeg,image/gif,image/webp");
  });
});
