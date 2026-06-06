import type { Player } from "../entity/GameEntities";

type TurnBannerInput = {
  isShuffling: boolean;
  turn: number;
  players: Player[];
};

export class GamePresenter {
  getTurnBannerText({ isShuffling, turn, players }: TurnBannerInput): string {
    if (isShuffling) return "Shuffling...";
    if (turn === 0) return "Your turn";
    return `${players[turn].name} turn`;
  }
}
