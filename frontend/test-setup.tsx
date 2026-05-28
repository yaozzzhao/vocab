import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

type Props = Record<string, unknown> & { className?: string };

function makeIcon() {
  return ({ className, ...props }: Props) =>
    <svg data-testid="icon" className={className} {...props} />;
}

const icons = [
  "AlertCircle", "ArrowLeft", "ArrowRight", "BarChart3", "BookMarked",
  "BookOpen", "BookText", "BookX", "BrainCircuit", "CheckCircle2",
  "ChevronDown", "ChevronLeft", "ChevronRight", "FileText", "Filter",
  "Flame", "HelpCircle", "Home", "HomeIcon", "KeyRound", "Library", "Lock",
  "Loader2",
  "LogOut", "Minus", "Play", "Plus", "RotateCcw", "Settings", "ShieldQuestion",
  "Sparkles", "Star", "Target", "ThumbsDown", "Trash2", "Trophy",   "Upload", "User",
  "Users", "Volume2", "X", "XCircle", "Zap",
];

vi.mock("lucide-react", () => {
  const mod: Record<string, React.FC> = {};
  for (const name of icons) mod[name] = makeIcon();
  return mod;
});
