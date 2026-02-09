import { Zap, Flame, Mountain } from "lucide-react";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: { bg: "bg-emerald-600", text: "text-emerald-400", pill: "bg-emerald-500", border: "border-emerald-500/40" },
  medium: { bg: "bg-amber-500", text: "text-amber-400", pill: "bg-amber-500", border: "border-amber-500/40" },
  hard: { bg: "bg-violet-500", text: "text-violet-400", pill: "bg-violet-500", border: "border-violet-500/40" },
} as const;

export const DifficultyIconMap = {
  easy: Zap,
  medium: Flame,
  hard: Mountain,
} as const;

export function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export const TIME_SLOTS = generateTimeSlots();

export const DURATION_OPTIONS = [
  { label: "1m", value: 1 },
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "All Day", value: 1440 },
  { label: "Custom", value: -1 },
];
