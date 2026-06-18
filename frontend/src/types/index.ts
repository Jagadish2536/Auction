// TypeScript interfaces for the JV Cricket Auction Platform

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'manager' | 'admin';
  is_active: boolean;
  tournament_id?: number | null;
  tournament_name?: string | null;
  perm_teams?: boolean;
  perm_players?: boolean;
  perm_auction?: boolean;
  perm_sponsors?: boolean;
  perm_analytics?: boolean;
  perm_reports?: boolean;
  created_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  logo: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  auction_date: string | null;
  venue: string | null;
  venue_address: string | null;
  players_per_team: number;
  bid_increment: number;
  team_budget: number;
  default_base_price: number;
  status: TournamentStatus;
  registration_open?: boolean;
  registration_code?: string;
  youtube_url?: string | null;
  created_at: string;
  team_count: number;
  player_count: number;
}

export type TournamentStatus = 'draft' | 'upcoming' | 'auction_live' | 'auction_paused' | 'auction_ended' | 'completed';

export interface Team {
  id: number;
  tournament_id: number;
  name: string;
  logo: string | null;
  owner_name: string | null;
  captain_name: string | null;
  budget: number;
  remaining_budget: number;
  max_players: number;
  player_count: number;
  created_at: string;
}

export interface Player {
  id: number;
  tournament_id: number;
  name: string;
  village: string | null;
  mobile: string | null;
  playing_style: string | null;
  age: number | null;
  photo: string | null;
  base_price: number;
  status: 'available' | 'sold' | 'unsold';
  crickheroes_url: string | null;
  sold_team_id: number | null;
  sold_team_name: string | null;
  sold_price: number | null;
  sold_at: string | null;
  created_at: string;
}

export interface AuctionState {
  id: number;
  tournament_id: number;
  status: 'not_started' | 'live' | 'paused' | 'ended';
  current_player_id: number | null;
  current_player: Player | null;
  current_bid: number;
  current_team_id: number | null;
  current_team_name: string | null;
  timer_remaining: number;
}

export interface BidHistory {
  id: number;
  player_id: number;
  player_name: string;
  team_id: number;
  team_name: string;
  amount: number;
  created_at: string;
}

export interface Sponsor {
  id: number;
  tournament_id: number;
  name: string;
  logo: string | null;
  url: string | null;
  tier: string;
  description?: string | null;
}

export interface Advertisement {
  id: number;
  tournament_id: number;
  title: string | null;
  image: string | null;
  url: string | null;
  is_active: boolean;
}

export interface AuctionFullState {
  auction: AuctionState | null;
  teams: Team[];
  recent_sold: Player[];
  stats: {
    total: number;
    available: number;
    sold: number;
    unsold: number;
  };
}

export interface DashboardAnalytics {
  total_players: number;
  sold_players: number;
  unsold_players: number;
  available_players: number;
  highest_bid: number;
  highest_sold_player: Player | null;
  average_bid: number;
  total_teams: number;
  total_spent: number;
  most_active_team: Team | null;
  completion_percentage: number;
  remaining_budgets: { team: string; remaining: number; budget: number }[];
}

export interface PublicTournamentData {
  tournament: Tournament | null;
  stats: {
    total_teams: number;
    total_players: number;
    sold_players: number;
    unsold_players: number;
  };
  auction_status: string;
  recent_sold: Player[];
  sponsors: Sponsor[];
  advertisements: Advertisement[];
  teams: Team[];
}
