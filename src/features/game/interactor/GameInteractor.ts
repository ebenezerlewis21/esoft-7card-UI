import {
  Card,
  DiscardSource,
  GamePhase,
  makeDeck,
  Player,
  shuffle,
} from "../entity/GameEntities";

export type GameState = {
  deck: Card[];
  discard: Card[];
  players: Player[];
  turn: number;
  phase: GamePhase;
  drawnCard: Card | null;
  drawnFrom: DiscardSource;
  selectedHandIdx: number | null;
  movingCardIdx: number | null;
  message: string;
  gameOver: boolean;
  aiThinking: boolean;
  stopPending?: boolean;
};

export class GameInteractor {
  createInitialState(): GameState {
    const deck = shuffle(makeDeck());
    const players: Player[] = [
      { name: "You", cards: deck.splice(0, 7), isHuman: true, icon: "ðŸ§‘" },
      {
        name: "Player 2",
        cards: deck.splice(0, 7),
        isHuman: false,
        icon: "ðŸ¤–",
      },
      {
        name: "Player 3",
        cards: deck.splice(0, 7),
        isHuman: false,
        icon: "ðŸ¤–",
      },
    ];

    return {
      deck,
      discard: [],
      players,
      turn: 0,
      phase: "action",
      drawnCard: null,
      drawnFrom: null,
      selectedHandIdx: null,
      movingCardIdx: null,
      message: "",
      gameOver: false,
      aiThinking: false,
      stopPending: false,
    };
  }
}
