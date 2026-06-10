export type BackgroundId =
  | "emerald"
  | "royal"
  | "golden"
  | "rose"
  | "ember"
  | "midnight";

export type BackgroundDefinition = {
  id: BackgroundId;
  name: string;
  cost: number;
  accent: string;
  background: string;
};

export const DEFAULT_BACKGROUND_ID: BackgroundId = "emerald";

export const BACKGROUNDS: BackgroundDefinition[] = [
  {
    id: "emerald",
    name: "Emerald Table",
    cost: 2400,
    accent: "#8dffb2",
    background: "#0f4f34",
  },
  {
    id: "royal",
    name: "Royal Felt",
    cost: 3600,
    accent: "#7ab8ff",
    background: "#123a72",
  },
  {
    id: "golden",
    name: "Golden Temple",
    cost: 4800,
    accent: "#ffeb99",
    background: "#d4a574",
  },
  {
    id: "rose",
    name: "Rose Salon",
    cost: 4800,
    accent: "#ff9bc5",
    background: "#6b3b5f",
  },
  {
    id: "ember",
    name: "Ember Hall",
    cost: 5200,
    accent: "#ffae75",
    background: "#6c241a",
  },
  {
    id: "midnight",
    name: "Midnight Casino",
    cost: 7600,
    accent: "#d1d4ff",
    background: "#1a1f43",
  },
];
