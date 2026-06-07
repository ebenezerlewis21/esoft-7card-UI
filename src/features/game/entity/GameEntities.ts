export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Card = {
  suit: Suit;
  rank: Rank;
  id: string;
};

export type Player = {
  name: string;
  cards: Card[];
  isHuman: boolean;
  icon?: string;
};

export type GamePhase = "action" | "drawn";
export type DiscardSource = "deck" | "discard" | null;

export type AiDecision =
  | { action: "takeDiscard"; swapIdx: number }
  | { action: "drawDeck" };

export type AiDifficulty = "beginner" | "pro" | "advance" | "expert";

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const RANK_VAL: Record<Rank, number> = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 10,
  Q: 10,
  K: 10,
};

export function isRed(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

export function cardRankIdx(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function findZeroCards(hand: Card[]): Set<number> {
  const n = hand.length;
  if (n === 0) return new Set<number>();

  const comboMasks: number[] = [];
  const seenMasks = new Set<number>();

  const addCombo = (indices: number[]): void => {
    let mask = 0;
    for (const i of indices) {
      mask |= 1 << i;
    }
    if (mask !== 0 && !seenMasks.has(mask)) {
      seenMasks.add(mask);
      comboMasks.push(mask);
    }
  };

  const rankGroups: Partial<Record<Rank, number[]>> = {};
  for (let i = 0; i < n; i++) {
    const r = hand[i].rank;
    if (!rankGroups[r]) rankGroups[r] = [];
    rankGroups[r]!.push(i);
  }

  for (const rankKey in rankGroups) {
    const rank = rankKey as Rank;
    const values = rankGroups[rank];
    if (values && values.length >= 3) {
      addCombo(values);
    }
  }

  const suitGroups: Record<Suit, number[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  };

  for (let i = 0; i < n; i++) {
    const s = hand[i].suit;
    suitGroups[s].push(i);
  }

  for (const suit of SUITS) {
    const idxs = suitGroups[suit];
    const sorted = idxs
      .slice()
      .sort((a, b) => cardRankIdx(hand[a].rank) - cardRankIdx(hand[b].rank));

    for (let len = sorted.length; len >= 3; len--) {
      for (let start = 0; start <= sorted.length - len; start++) {
        const slice = sorted.slice(start, start + len);

        let consecLow = true;
        for (let k = 1; k < slice.length; k++) {
          if (
            cardRankIdx(hand[slice[k]].rank) !==
            cardRankIdx(hand[slice[k - 1]].rank) + 1
          ) {
            consecLow = false;
            break;
          }
        }
        if (consecLow) {
          addCombo(slice);
          continue;
        }

        const ranks = slice
          .map((i) => (hand[i].rank === "A" ? 13 : cardRankIdx(hand[i].rank)))
          .sort((a, b) => a - b);

        let consecHigh = true;
        for (let k = 1; k < ranks.length; k++) {
          if (ranks[k] !== ranks[k - 1] + 1) {
            consecHigh = false;
            break;
          }
        }
        if (consecHigh) {
          addCombo(slice);
        }
      }
    }
  }

  // Choose non-overlapping combos that minimize score (maximize removed value).
  const popcount = (x: number): number => {
    let v = x;
    let c = 0;
    while (v) {
      v &= v - 1;
      c++;
    }
    return c;
  };

  const comboValue = (mask: number): number => {
    let value = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        value += hand[i].rank === "A" ? 1 : RANK_VAL[hand[i].rank];
      }
    }
    return value;
  };

  type Best = { value: number; count: number; mask: number };
  const memo = new Map<string, Best>();

  const dfs = (idx: number, usedMask: number): Best => {
    const key = `${idx}|${usedMask}`;
    const cached = memo.get(key);
    if (cached) return cached;

    if (idx >= comboMasks.length) {
      return { value: 0, count: 0, mask: 0 };
    }

    const skip = dfs(idx + 1, usedMask);
    let best: Best = skip;

    const comboMask = comboMasks[idx];
    if ((comboMask & usedMask) === 0) {
      const takeTail = dfs(idx + 1, usedMask | comboMask);
      const takeValue = comboValue(comboMask) + takeTail.value;
      const takeCount = popcount(comboMask) + takeTail.count;
      const take: Best = {
        value: takeValue,
        count: takeCount,
        mask: comboMask | takeTail.mask,
      };
      if (
        take.value > best.value ||
        (take.value === best.value && take.count > best.count)
      ) {
        best = take;
      }
    }

    memo.set(key, best);
    return best;
  };

  const best = dfs(0, 0);
  const zeros = new Set<number>();
  for (let i = 0; i < n; i++) {
    if ((best.mask & (1 << i)) !== 0) zeros.add(i);
  }

  return zeros;
}

export function calcHandScore(hand: Card[]): number {
  if (!hand.length) return 0;
  const zeros = findZeroCards(hand);
  return hand.reduce((sum, card, i) => {
    if (zeros.has(i)) return sum;
    return sum + (card.rank === "A" ? 1 : RANK_VAL[card.rank]);
  }, 0);
}

function getBestSwapGain(
  hand: Card[],
  incomingCard: Card,
): { bestGain: number; bestIdx: number; bestDropValue: number } {
  const currentScore = calcHandScore(hand);
  let bestGain = Number.NEGATIVE_INFINITY;
  let bestIdx = -1;
  let bestDropValue = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < hand.length; i++) {
    const trial = hand.slice();
    trial[i] = incomingCard;
    const trialScore = calcHandScore(trial);
    const gain = currentScore - trialScore;
    const dropped = hand[i].rank === "A" ? 1 : RANK_VAL[hand[i].rank];

    if (gain > bestGain || (gain === bestGain && dropped > bestDropValue)) {
      bestGain = gain;
      bestIdx = i;
      bestDropValue = dropped;
    }
  }

  return { bestGain, bestIdx, bestDropValue };
}

export function aiDecide(
  hand: Card[],
  discardTop: Card | null,
  options?: { difficulty?: AiDifficulty; deckPreview?: Card[] },
): AiDecision {
  const difficulty = options?.difficulty ?? "pro";
  const MIN_DISCARD_GAIN_TO_TAKE =
    difficulty === "beginner" ? 4 : difficulty === "pro" ? 2 : 1;

  if (discardTop) {
    const discardSwap = getBestSwapGain(hand, discardTop);

    if (difficulty === "expert") {
      const preview = (options?.deckPreview ?? []).slice(0, 2);
      let bestDeckGain = 0;

      for (const peekCard of preview) {
        const deckSwap = getBestSwapGain(hand, peekCard);
        bestDeckGain = Math.max(bestDeckGain, deckSwap.bestGain);
      }

      if (
        discardSwap.bestIdx >= 0 &&
        discardSwap.bestGain >= MIN_DISCARD_GAIN_TO_TAKE &&
        discardSwap.bestGain >= bestDeckGain
      ) {
        return { action: "takeDiscard", swapIdx: discardSwap.bestIdx };
      }
      return { action: "drawDeck" };
    }

    if (
      discardSwap.bestIdx >= 0 &&
      discardSwap.bestGain >= MIN_DISCARD_GAIN_TO_TAKE
    ) {
      if (
        difficulty === "beginner" &&
        discardSwap.bestGain <= 6 &&
        Math.random() < 0.4
      ) {
        return { action: "drawDeck" };
      }

      return { action: "takeDiscard", swapIdx: discardSwap.bestIdx };
    }
  }

  return { action: "drawDeck" };
}

export function aiDecideSwap(
  hand: Card[],
  drawnCard: Card,
  options?: { difficulty?: AiDifficulty },
): number {
  const difficulty = options?.difficulty ?? "pro";
  const bestSwap = getBestSwapGain(hand, drawnCard);

  if (difficulty === "beginner") {
    if (bestSwap.bestGain <= 0) return -1;
    if (bestSwap.bestGain <= 2 && Math.random() < 0.45) return -1;
    if (Math.random() < 0.2) {
      return Math.floor(Math.random() * hand.length);
    }
    return bestSwap.bestIdx;
  }

  if (bestSwap.bestGain <= 0) return -1;
  return bestSwap.bestIdx;
}

export function aiShouldStop(
  hand: Card[],
  options?: { difficulty?: AiDifficulty; opponentHands?: Card[][] },
): boolean {
  const difficulty = options?.difficulty ?? "pro";
  const score = calcHandScore(hand);
  const opponentScores = (options?.opponentHands ?? []).map((cards) =>
    calcHandScore(cards),
  );
  const bestOpponentScore =
    opponentScores.length > 0
      ? Math.min(...opponentScores)
      : Number.POSITIVE_INFINITY;
  const scoreLead = bestOpponentScore - score;

  if (Number.isFinite(bestOpponentScore)) {
    if (difficulty === "expert" && score <= 7 && scoreLead >= 0) {
      return true;
    }

    if (difficulty === "advance" && score <= 7 && scoreLead >= 1) {
      return true;
    }

    if (difficulty === "pro" && score <= 7 && scoreLead >= 2) {
      return true;
    }

    if (difficulty === "beginner" && score <= 8 && scoreLead >= 3) {
      return true;
    }
  }

  if (difficulty === "beginner") {
    return (
      (score <= 11 && Math.random() < 0.3) ||
      (score <= 8 && Math.random() < 0.25)
    );
  }

  if (difficulty === "pro") {
    return score <= 7 && Math.random() < 0.45;
  }

  if (difficulty === "advance") {
    return score <= 5 || (score <= 6 && Math.random() < 0.72);
  }

  return (
    score <= 5 ||
    (score <= 6 && Math.random() < 0.9) ||
    (score <= 7 && Math.random() < 0.35)
  );
}
