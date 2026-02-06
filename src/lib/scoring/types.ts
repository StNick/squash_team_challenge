export type ServiceBox = "L" | "R";

export interface PlayerInfo {
  name: string;
  teamColor: string;
}

export interface ScoringState {
  matchId: number;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  scoreA: number;
  scoreB: number;
  server: "A" | "B";
  serviceBox: ServiceBox;
  isHandout: boolean;
  preferredBox: {
    A: ServiceBox;
    B: ServiceBox;
  };
  matchStartTime: number;
  history: PointEvent[];
  status: "in_progress" | "completed";
}

export interface PointEvent {
  timestamp: number;
  scorer: "A" | "B";
  scoreA: number;
  scoreB: number;
  server: "A" | "B";
  serviceBox: ServiceBox;
  isHandout: boolean;
}

export interface MatchInfo {
  id: number;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
}

export type ScoringAction =
  | { type: "SCORE_POINT"; scorer: "A" | "B" }
  | { type: "SELECT_SERVICE_BOX"; box: ServiceBox }
  | { type: "SET_SERVER"; server: "A" | "B" }
  | { type: "UNDO" }
  | { type: "RESTORE"; state: ScoringState }
  | { type: "RESET"; matchInfo: MatchInfo };

export interface StoredSession {
  state: ScoringState;
  savedAt: number;
}
