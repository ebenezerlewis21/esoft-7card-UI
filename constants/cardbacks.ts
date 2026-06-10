export type CardBackId =
  | "royal"
  | "golden"
  | "rose"
  | "ember"
  | "emerald"
  | "midnight";

export type CardBackDefinition = {
  id: CardBackId;
  name: string;
  cost: number;
  accent: string;
  color: string;
};

export const DEFAULT_CARD_BACK_ID: CardBackId = "royal";

export const CARD_BACKS: CardBackDefinition[] = [
  {
    id: "royal",
    name: "Royal Blue",
    cost: 1200,
    accent: "#7ab8ff",
    color: "#173b92",
  },
  {
    id: "golden",
    name: "Golden Card",
    cost: 1800,
    accent: "#ffeb99",
    color: "#b8860b",
  },
  {
    id: "rose",
    name: "Rose Card",
    cost: 1800,
    accent: "#ff9bc5",
    color: "#c71585",
  },
  {
    id: "ember",
    name: "Ember Red",
    cost: 1600,
    accent: "#ffae75",
    color: "#7a241c",
  },
  {
    id: "emerald",
    name: "Emerald Crest",
    cost: 2000,
    accent: "#8dffb2",
    color: "#0d5a3b",
  },
  {
    id: "midnight",
    name: "Midnight Violet",
    cost: 2400,
    accent: "#d1d4ff",
    color: "#26235f",
  },
];
