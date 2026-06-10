export type PlayerIconId =
  | "human"
  | "crown"
  | "fox"
  | "ninja"
  | "alien"
  | "unicorn"
  | "robot";

export type PlayerIconDefinition = {
  id: PlayerIconId;
  name: string;
  cost: number;
  accent: string;
  emoji: string;
};

export const DEFAULT_PLAYER_ICON_ID: PlayerIconId = "human";

export const PLAYER_ICONS: PlayerIconDefinition[] = [
  {
    id: "human",
    name: "Classic",
    cost: 0,
    accent: "#ffe89a",
    emoji: "🧑",
  },
  {
    id: "crown",
    name: "Champion",
    cost: 2200,
    accent: "#ffeb99",
    emoji: "👑",
  },
  {
    id: "fox",
    name: "Trickster",
    cost: 2200,
    accent: "#ff9e6d",
    emoji: "🦊",
  },
  {
    id: "ninja",
    name: "Shadow",
    cost: 2800,
    accent: "#d1d4ff",
    emoji: "🥷",
  },
  {
    id: "alien",
    name: "Nebula",
    cost: 3000,
    accent: "#8dffb2",
    emoji: "👽",
  },
  {
    id: "unicorn",
    name: "Prism",
    cost: 3400,
    accent: "#ff9bc5",
    emoji: "🦄",
  },
  {
    id: "robot",
    name: "Mecha",
    cost: 3600,
    accent: "#d1d4ff",
    emoji: "🤖",
  },
];

export const getEmojiForPlayerIconId = (id: PlayerIconId): string => {
  const match = PLAYER_ICONS.find((item) => item.id === id);
  return match?.emoji ?? "🧑";
};
