import { Gamepad2 } from "lucide-react";

const GAME_COLORS: Record<string, string> = {
  minecraft: "bg-green-500/20 text-green-400",
  csgo: "bg-yellow-500/20 text-yellow-400",
  cs2: "bg-yellow-500/20 text-yellow-400",
  valheim: "bg-blue-500/20 text-blue-400",
  terraria: "bg-lime-500/20 text-lime-400",
  rust: "bg-orange-500/20 text-orange-400",
  ark: "bg-emerald-500/20 text-emerald-400",
  factorio: "bg-zinc-500/20 text-zinc-400",
  satisfactory: "bg-cyan-500/20 text-cyan-400",
  "7dtd": "bg-red-500/20 text-red-400",
  default: "bg-primary/10 text-primary",
};

const GAME_EMOJIS: Record<string, string> = {
  minecraft: "⛏️",
  csgo: "🎯",
  cs2: "🎯",
  valheim: "⚔️",
  terraria: "🌿",
  rust: "🔧",
  ark: "🦕",
  factorio: "⚙️",
  satisfactory: "🏭",
  "7dtd": "🧟",
};

export function GameIcon({ game, size = "md" }: { game: string; size?: "sm" | "md" | "lg" }) {
  const key = game.toLowerCase();
  const colorClass = GAME_COLORS[key] ?? GAME_COLORS.default;
  const emoji = GAME_EMOJIS[key];

  const sizeClass = {
    sm: "w-7 h-7 text-sm",
    md: "w-10 h-10 text-lg",
    lg: "w-14 h-14 text-2xl",
  }[size];

  return (
    <div
      className={`${sizeClass} rounded-lg ${colorClass} flex items-center justify-center font-bold shrink-0`}
    >
      {emoji ?? <Gamepad2 className="h-4 w-4" />}
    </div>
  );
}
