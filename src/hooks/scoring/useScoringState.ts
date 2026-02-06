import { useReducer, useCallback } from "react";
import type {
  ScoringState,
  ScoringAction,
  ServiceBox,
  MatchInfo,
  PointEvent,
} from "~/lib/scoring/types";

const MAX_HISTORY_LENGTH = 50;

function createInitialState(matchInfo: MatchInfo): ScoringState {
  return {
    matchId: matchInfo.id,
    playerA: matchInfo.playerA,
    playerB: matchInfo.playerB,
    scoreA: 0,
    scoreB: 0,
    server: "A",
    serviceBox: "R",
    isHandout: true,
    preferredBox: {
      A: "R",
      B: "R",
    },
    matchStartTime: Date.now(),
    history: [],
    status: "in_progress",
  };
}

function scoringReducer(
  state: ScoringState,
  action: ScoringAction
): ScoringState {
  switch (action.type) {
    case "SCORE_POINT": {
      const { scorer } = action;
      const newScoreA = scorer === "A" ? state.scoreA + 1 : state.scoreA;
      const newScoreB = scorer === "B" ? state.scoreB + 1 : state.scoreB;

      // Create history entry with state BEFORE the point
      const historyEntry: PointEvent = {
        timestamp: Date.now(),
        scorer,
        scoreA: newScoreA,
        scoreB: newScoreB,
        server: state.server,
        serviceBox: state.serviceBox,
        isHandout: state.isHandout,
      };

      // Determine new server state
      let newServer = state.server;
      let newServiceBox = state.serviceBox;
      let newIsHandout = state.isHandout;

      if (scorer === state.server) {
        // Server wins the point - alternate service box
        newServiceBox = state.serviceBox === "R" ? "L" : "R";
        newIsHandout = false;
      } else {
        // Server loses the point - handout
        newServer = scorer;
        newServiceBox = state.preferredBox[scorer];
        newIsHandout = true;
      }

      // Trim history if needed
      const newHistory = [...state.history, historyEntry].slice(
        -MAX_HISTORY_LENGTH
      );

      return {
        ...state,
        scoreA: newScoreA,
        scoreB: newScoreB,
        server: newServer,
        serviceBox: newServiceBox,
        isHandout: newIsHandout,
        history: newHistory,
      };
    }

    case "SELECT_SERVICE_BOX": {
      if (!state.isHandout) {
        // Can only select box during handout
        return state;
      }

      return {
        ...state,
        serviceBox: action.box,
        isHandout: false,
        preferredBox: {
          ...state.preferredBox,
          [state.server]: action.box,
        },
      };
    }

    case "SET_SERVER": {
      // Change who is serving (handout)
      return {
        ...state,
        server: action.server,
        serviceBox: state.preferredBox[action.server],
        isHandout: true,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) {
        return state;
      }

      const lastEvent = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);

      // Restore scores to before this point was scored
      const previousScoreA =
        lastEvent.scorer === "A" ? lastEvent.scoreA - 1 : lastEvent.scoreA;
      const previousScoreB =
        lastEvent.scorer === "B" ? lastEvent.scoreB - 1 : lastEvent.scoreB;

      return {
        ...state,
        scoreA: previousScoreA,
        scoreB: previousScoreB,
        server: lastEvent.server,
        serviceBox: lastEvent.serviceBox,
        isHandout: lastEvent.isHandout,
        history: newHistory,
      };
    }

    case "RESTORE": {
      return action.state;
    }

    case "RESET": {
      return createInitialState(action.matchInfo);
    }

    default:
      return state;
  }
}

export function useScoringState(matchInfo: MatchInfo) {
  const [state, dispatch] = useReducer(
    scoringReducer,
    matchInfo,
    (matchInfo) => createInitialState(matchInfo)
  );

  const scorePoint = useCallback((scorer: "A" | "B") => {
    dispatch({ type: "SCORE_POINT", scorer });
  }, []);

  const selectServiceBox = useCallback((box: ServiceBox) => {
    dispatch({ type: "SELECT_SERVICE_BOX", box });
  }, []);

  const setServer = useCallback((server: "A" | "B") => {
    dispatch({ type: "SET_SERVER", server });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const restore = useCallback((savedState: ScoringState) => {
    dispatch({ type: "RESTORE", state: savedState });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET", matchInfo });
  }, [matchInfo]);

  return {
    state,
    scorePoint,
    selectServiceBox,
    setServer,
    undo,
    restore,
    reset,
    canUndo: state.history.length > 0,
  };
}
