import { User } from "../types";

const PRESET_AVATARS = [
  { id: "fox", emoji: "🦊", bg: "bg-orange-200", label: "Fox" },
  { id: "panda", emoji: "🐼", bg: "bg-green-200", label: "Panda" },
  { id: "koala", emoji: "🐨", bg: "bg-stone-200", label: "Koala" },
  { id: "lion", emoji: "🦁", bg: "bg-yellow-200", label: "Lion" },
  { id: "tiger", emoji: "🐯", bg: "bg-amber-200", label: "Tiger" },
  { id: "frog", emoji: "🐸", bg: "bg-emerald-200", label: "Frog" },
  { id: "cat", emoji: "🐱", bg: "bg-slate-200", label: "Cat" },
  { id: "dog", emoji: "🐶", bg: "bg-blue-200", label: "Dog" },
  { id: "rabbit", emoji: "🐰", bg: "bg-pink-200", label: "Rabbit" },
  { id: "bear", emoji: "🐻", bg: "bg-brown-200", label: "Bear" },
  { id: "unicorn", emoji: "🦄", bg: "bg-purple-200", label: "Unicorn" },
  { id: "eagle", emoji: "🦅", bg: "bg-indigo-200", label: "Eagle" },
  { id: "dolphin", emoji: "🐬", bg: "bg-cyan-200", label: "Dolphin" },
  { id: "butterfly", emoji: "🦋", bg: "bg-fuchsia-200", label: "Butterfly" },
  { id: "star", emoji: "🌟", bg: "bg-yellow-100", label: "Star" },
  { id: "diamond", emoji: "💎", bg: "bg-sky-200", label: "Diamond" },
];

function isPreset(avatar: string): boolean {
  return avatar.startsWith("preset:");
}

function getPresetId(avatar: string): string {
  return avatar.replace("preset:", "");
}

function findPreset(id: string) {
  return PRESET_AVATARS.find((p) => p.id === id);
}

interface AvatarDisplayProps {
  user: User;
  size?: number;
  className?: string;
}

export function AvatarDisplay({ user, size = 28, className = "" }: AvatarDisplayProps) {
  const avatar = user.avatar;
  const sizeStr = `${size}px`;

  if (avatar && isPreset(avatar)) {
    const preset = findPreset(getPresetId(avatar));
    if (preset) {
      return (
        <div
          className={`rounded-full flex items-center justify-center shrink-0 ${preset.bg} ${className}`}
          style={{ width: sizeStr, height: sizeStr }}
          title={preset.label}
        >
          <span style={{ fontSize: `${size * 0.5}px` }}>{preset.emoji}</span>
        </div>
      );
    }
  }

  if (avatar && avatar.startsWith("data:image")) {
    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: sizeStr, height: sizeStr }}
      >
        <img
          src={avatar}
          alt="avatar"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full bg-brand-200 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: sizeStr, height: sizeStr }}
    >
      <span
        className="font-bold text-brand-700"
        style={{ fontSize: `${size * 0.45}px` }}
      >
        {user.username[0].toUpperCase()}
      </span>
    </div>
  );
}

interface AvatarPickerProps {
  currentAvatar?: string;
  onSelect: (avatar: string) => void;
  onClose: () => void;
}

export function AvatarPicker({ currentAvatar, onSelect, onClose }: AvatarPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-slide-down">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-stone-800">Choose Avatar</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <span className="text-stone-500 text-lg leading-none">✕</span>
          </button>
        </div>

        <p className="text-sm text-stone-500 mb-4">Pick a preset avatar</p>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {PRESET_AVATARS.map((preset) => {
            const isActive = currentAvatar === `preset:${preset.id}`;
            return (
              <button
                key={preset.id}
                onClick={() => onSelect(`preset:${preset.id}`)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-brand-100 ring-2 ring-brand-500 scale-105"
                    : "bg-stone-50 hover:bg-stone-100 hover:scale-105"
                }`}
              >
                <span className="text-2xl">{preset.emoji}</span>
                <span className="text-[10px] text-stone-500 font-medium">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-sm text-stone-500 mb-3">Or upload your own</p>

        <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer active:scale-[0.98] border-2 border-dashed border-brand-200">
          <span className="text-lg">📁</span>
          Upload Image
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const maxSize = 2 * 1024 * 1024;
              if (file.size > maxSize) {
                alert("Image too large. Max 2MB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = (ev) => {
                const result = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  const MAX = 128;
                  let w = img.width;
                  let h = img.height;
                  if (w > MAX || h > MAX) {
                    const scale = MAX / Math.max(w, h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                  }
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d")!;
                  ctx.drawImage(img, 0, 0, w, h);
                  const dataUrl = canvas.toDataURL("image/png");
                  onSelect(dataUrl);
                };
                img.src = result;
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
