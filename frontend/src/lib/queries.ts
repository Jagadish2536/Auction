import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Player, Team, Tournament, DashboardAnalytics } from '@/types';
import { prefetchPlayerImages, prefetchTeamImages } from '@/lib/imageCache';

// ────────────────────────────────────────
// Query Keys — centralised for invalidation
// ────────────────────────────────────────
export const queryKeys = {
  players: (tid: number) => ['players', tid] as const,
  pendingPlayers: (tid: number) => ['pendingPlayers', tid] as const,
  publicPlayers: (tid: number) => ['publicPlayers', tid] as const,
  tournament: (tid: number) => ['tournament', tid] as const,
  publicTournament: (tid: number) => ['publicTournament', tid] as const,
  tournaments: ['tournaments'] as const,
  publicTournaments: ['publicTournaments'] as const,
  teams: (tid: number) => ['teams', tid] as const,
  analytics: (tid: number) => ['analytics', tid] as const,
};

// ────────────────────────────────────────
// Authenticated Hooks (admin/manager dashboard)
// ────────────────────────────────────────

/** Fetch players for a tournament (admin view) */
export function usePlayers(tournamentId: number | null | undefined) {
  return useQuery<Player[]>({
    queryKey: queryKeys.players(tournamentId!),
    queryFn: async () => {
      const { data } = await api.get(`/tournaments/${tournamentId}/players`);
      const players: Player[] = data.players || [];
      // Preload images in background
      prefetchPlayerImages(players);
      return players;
    },
    enabled: !!tournamentId,
    staleTime: 60_000,       // 60 seconds
    gcTime: 5 * 60_000,      // 5 minutes
    placeholderData: (prev) => prev, // Keep previous data while refetching
  });
}

/** Fetch pending players for a tournament (admin view) */
export function usePendingPlayers(tournamentId: number | null | undefined) {
  return useQuery<Player[]>({
    queryKey: queryKeys.pendingPlayers(tournamentId!),
    queryFn: async () => {
      const { data } = await api.get(`/tournaments/${tournamentId}/players?status=pending`);
      return data.players || [];
    },
    enabled: !!tournamentId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/** Fetch tournament by ID (admin view) */
export function useTournament(tournamentId: number | null | undefined) {
  return useQuery<Tournament>({
    queryKey: queryKeys.tournament(tournamentId!),
    queryFn: async () => {
      const { data } = await api.get(`/tournaments/${tournamentId}`);
      return data.tournament;
    },
    enabled: !!tournamentId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Fetch teams for a tournament (admin view) */
export function useTeams(tournamentId: number | null | undefined) {
  return useQuery<Team[]>({
    queryKey: queryKeys.teams(tournamentId!),
    queryFn: async () => {
      const { data } = await api.get(`/tournaments/${tournamentId}/teams`);
      const teams: Team[] = data.teams || [];
      prefetchTeamImages(teams);
      return teams;
    },
    enabled: !!tournamentId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/** Fetch dashboard analytics */
export function useAnalytics(tournamentId: number | null | undefined) {
  return useQuery<DashboardAnalytics>({
    queryKey: queryKeys.analytics(tournamentId!),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/dashboard/${tournamentId}`);
      return data;
    },
    enabled: !!tournamentId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

// ────────────────────────────────────────
// Public Hooks (live page, homepage)
// ────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/** Fetch public players for a tournament (no auth required) */
export function usePublicPlayers(tournamentId: number | null | undefined) {
  return useQuery<Player[]>({
    queryKey: queryKeys.publicPlayers(tournamentId!),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/public/tournament/${tournamentId}/players`);
      if (!res.ok) {
        throw new Error('Tournament not found');
      }
      const data = await res.json();
      const players: Player[] = data.players || [];
      prefetchPlayerImages(players);
      return players;
    },
    enabled: !!tournamentId,
    staleTime: 30_000,       // 30 seconds for public data
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    retry: false,            // Don't retry permanently missing resources
  });
}

/** Fetch public tournament by ID */
export function usePublicTournament(tournamentId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.publicTournament(tournamentId!),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/public/tournament/${tournamentId}`);
      if (!res.ok) {
        throw new Error('Tournament not found');
      }
      return await res.json();
    },
    enabled: !!tournamentId,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    retry: false,            // Don't retry permanently missing resources
  });
}

/** Fetch all public tournaments */
export function usePublicTournaments() {
  return useQuery<Tournament[]>({
    queryKey: queryKeys.publicTournaments,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/public/tournaments`);
      const data = await res.json();
      return data.tournaments || [];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

// ────────────────────────────────────────
// Socket-driven Invalidation Hook
// ────────────────────────────────────────

/**
 * Hook that listens to socket events and invalidates React Query caches.
 * Use this in layout or page components to keep data fresh.
 */
export function useSocketInvalidation(tournamentId: number | null | undefined) {
  const queryClient = useQueryClient();

  const invalidatePlayers = useCallback(() => {
    if (!tournamentId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.players(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingPlayers(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.publicPlayers(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics(tournamentId) });
  }, [queryClient, tournamentId]);

  const invalidateTeams = useCallback(() => {
    if (!tournamentId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.teams(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics(tournamentId) });
  }, [queryClient, tournamentId]);

  const invalidateTournament = useCallback(() => {
    if (!tournamentId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.tournament(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.publicTournament(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.publicTournaments });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics(tournamentId) });
  }, [queryClient, tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    const socket = getSocket();

    socket.on('player:change', invalidatePlayers);
    socket.on('team:change', invalidateTeams);
    socket.on('tournament:change', invalidateTournament);

    return () => {
      socket.off('player:change', invalidatePlayers);
      socket.off('team:change', invalidateTeams);
      socket.off('tournament:change', invalidateTournament);
    };
  }, [tournamentId, invalidatePlayers, invalidateTeams, invalidateTournament]);
}
