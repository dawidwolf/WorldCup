// This hook is deprecated and has been replaced by the central TournamentDataProvider.
// All bonus pick logic is now handled in `context/tournament-data-context.tsx`.
// This file can be safely removed from the project.

/**
 * @deprecated This hook is no longer in use. All functionality has been moved to `TournamentDataProvider`.
 */
export function useBonus(currentUserId: number | null) {
  return {
    teams: [],
    players: [],
    savedWinnerId: null,
    savedScorerId: null,
    goldenBootLeaders: [],
    isLocked: true,
    loading: false,
    saveWinner: async () => ({ error: "Hook is deprecated" }),
    saveScorer: async () => ({ error: "Hook is deprecated" }),
  }
}

export type DBTeam = any
export type DBPlayer = any
