'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import VirtualPlayerList from '@/components/ui/VirtualPlayerList';
import { PublicTournamentData, Tournament, Player, Team } from '@/types';
import { getImageUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  Trophy, Users, UserCheck, UserX, Radio, LogIn, Eye,
  MapPin, Calendar, Timer, TrendingUp, Gavel,
  Phone, Mail, ArrowLeft, ShieldAlert, UserCircle, ExternalLink, Heart, Search
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store';

const statusConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', pulse: false },
  live: { label: '🔴 LIVE', color: 'bg-red-500/20 text-red-400 border-red-500/30', pulse: true },
  paused: { label: '⏸ Paused', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', pulse: false },
  ended: { label: 'Ended', color: 'bg-green-500/20 text-green-400 border-green-500/30', pulse: false },
};

const DEFAULT_PLAYER_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><circle cx='50' cy='40' r='18' fill='%23d4a843' fill-opacity='0.8'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23d4a843' fill-opacity='0.8'/></svg>";
const DEFAULT_TEAM_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M35 30h30v20c0 10-8 18-15 18s-15-8-15-18V30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M45 68h10v12H45zM30 80h40v4H30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M28 35h7v10h-7zm37 0h7v10h-7z' fill='%23d4a843' fill-opacity='0.8'/></svg>";
const DEFAULT_TOURNAMENT_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M50 15L20 30v25c0 20 18 35 30 40 12-5 30-20 30-40V30L50 15z' fill='%23d4a843' fill-opacity='0.2' stroke='%23d4a843' stroke-width='3'/><circle cx='50' cy='50' r='12' fill='%23d4a843' fill-opacity='0.8'/></svg>";
const DEFAULT_SPONSOR_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M50 30c-5-5-15-5-20 0s-5 15 0 20l20 20 20-20c5-5 5-15 0-20s-15-5-20 0z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

/** Ensure CricHeroes URL has a proper protocol prefix so it opens as external link */
function ensureUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function HomePageContent() {
  const { user, checkAuth, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const selectedTid = searchParams.get('tournament_id') ? Number(searchParams.get('tournament_id')) : null;
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [pubModalType, setPubModalType] = useState<'teams' | 'total' | 'sold' | 'unsold' | null>(null);
  const [pubPlayers, setPubPlayers] = useState<Player[]>([]);
  const [pubTeams, setPubTeams] = useState<Team[]>([]);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [pubSearchQuery, setPubSearchQuery] = useState('');

  const openPublicModal = (type: 'teams' | 'total' | 'sold' | 'unsold') => {
    if (!selectedTid) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    if (type === 'teams') {
      // teams are already in data.teams
      setPubTeams(data?.teams || []);
      setPubModalType(type);
    } else {
      setPubModalType(type);
      fetch(`${apiBase}/api/public/tournament/${selectedTid}/players`)
        .then(r => r.json())
        .then(d => { setPubPlayers(d.players || []); })
        .catch(() => {});
    }
  };

  const getPubFilteredPlayers = (): Player[] => {
    let list: Player[] = [];
    switch (pubModalType) {
      case 'total': list = pubPlayers; break;
      case 'sold': list = pubPlayers.filter(p => p.status === 'sold'); break;
      case 'unsold': list = pubPlayers.filter(p => p.status === 'unsold'); break;
      default: list = [];
    }
    // Apply search filter
    if (pubSearchQuery.trim()) {
      const q = pubSearchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.village?.toLowerCase().includes(q) ||
        p.playing_style?.toLowerCase().includes(q) ||
        p.mobile?.includes(q)
      );
    }
    return list;
  };

  const pubModalTitle = (): string => {
    switch (pubModalType) {
      case 'total': return 'All Players';
      case 'sold': return 'Sold Players';
      case 'unsold': return 'Unsold Players';
      case 'teams': return 'All Teams';
      default: return '';
    }
  };

  const pubStatusColors: Record<string, string> = {
    available: 'bg-blue-500/20 text-blue-400',
    sold: 'bg-green-500/20 text-green-400',
    unsold: 'bg-red-500/20 text-red-400',
  };

  const fetchTournamentData = () => {
    if (!selectedTid) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiBase}/api/public/tournament/${selectedTid}`)
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  // Lock body scroll on mobile/iOS when any modal is open
  useEffect(() => {
    const isModalOpen = pubModalType !== null || enlargedPhoto !== null;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [pubModalType, enlargedPhoto]);

  useEffect(() => {
    if (selectedTid) {
      fetchTournamentData();
      // Pre-fetch players to open modal instantly
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      fetch(`${apiBase}/api/public/tournament/${selectedTid}/players`)
        .then(r => r.json())
        .then(d => setPubPlayers(d.players || []))
        .catch(() => {});
      const interval = setInterval(fetchTournamentData, 5000);
      return () => clearInterval(interval);
    } else {
      const fetchTournaments = () => {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        fetch(`${apiBase}/api/public/tournaments`)
          .then((res) => res.json())
          .then((d) => { setTournaments(d.tournaments || []); setLoading(false); })
          .catch(() => setLoading(false));
      };
      fetchTournaments();
      const interval = setInterval(fetchTournaments, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTid]);

  useEffect(() => {
    const socket = getSocket();

    const handleTournamentChange = () => {
      if (selectedTid) {
        fetchTournamentData();
      } else {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        fetch(`${apiBase}/api/public/tournaments`)
          .then((res) => res.json())
          .then((d) => { setTournaments(d.tournaments || []); setLoading(false); })
          .catch(() => setLoading(false));
      }
    };

    const handlePlayerChange = (data: { tournament_id?: number }) => {
      if (selectedTid && data.tournament_id === selectedTid) {
        fetchTournamentData();
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        fetch(`${apiBase}/api/public/tournament/${selectedTid}/players`)
          .then(r => r.json())
          .then(d => setPubPlayers(d.players || []))
          .catch(() => {});
      }
    };

    const handleTeamChange = (data: { tournament_id?: number }) => {
      if (selectedTid && data.tournament_id === selectedTid) {
        fetchTournamentData();
      }
    };

    socket.on('tournament:change', handleTournamentChange);
    socket.on('player:change', handlePlayerChange);
    socket.on('team:change', handleTeamChange);

    if (selectedTid) {
      socket.emit('join_auction', { tournament_id: selectedTid });
      
      const handleAuctionState = () => {
        fetchTournamentData();
      };
      
      socket.on('auction:state', handleAuctionState);

      return () => {
        socket.off('auction:state', handleAuctionState);
        socket.off('tournament:change', handleTournamentChange);
        socket.off('player:change', handlePlayerChange);
        socket.off('team:change', handleTeamChange);
        socket.emit('leave_auction', { tournament_id: selectedTid });
      };
    }

    return () => {
      socket.off('tournament:change', handleTournamentChange);
      socket.off('player:change', handlePlayerChange);
      socket.off('team:change', handleTeamChange);
    };
  }, [selectedTid]);

  // Countdown timer for individual tournament view
  useEffect(() => {
    if (!data?.tournament?.auction_date) return;
    const target = new Date(data.tournament.auction_date).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.tournament?.auction_date]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Gavel className="w-12 h-12 text-gold animate-pulse" />
          <p className="text-muted-foreground">Loading Lakshya Sports...</p>
        </div>
      </div>
    );
  }

  // --- RENDERING DETAIL VIEW (THE "OLD HOMEPAGE" LAYOUT) ---
  if (selectedTid && data?.tournament) {
    const tournament = data.tournament;
    const stats = data.stats;
    const status = statusConfig[data.auction_status || 'not_started'];

    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-light to-navy-lighter opacity-90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,168,67,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(212,168,67,0.08),transparent_50%)]" />

          <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
            <button
              onClick={() => { window.location.search = ''; }}
              className="flex items-center gap-2 text-gold hover:text-gold-light transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Tournaments
            </button>
            {mounted && isAuthenticated && user ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-gold hover:bg-gold-dark text-navy font-semibold shadow-md glow-gold-sm">
                  {user.role === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard'}
                </Button>
              </Link>
            ) : mounted ? (
              <Link href="/login">
                <Button size="sm" className="bg-gold hover:bg-gold-dark text-navy font-semibold shadow-md glow-gold-sm">
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              </Link>
            ) : (
              <div className="w-20 h-8" />
            )}
          </nav>

          <div className="relative z-10 px-6 py-16 md:py-24 max-w-7xl mx-auto text-center">
            {/* Tournament Logo */}
            {tournament.logo ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6"
              >
                <img
                  src={getImageUrl(tournament.logo)}
                  alt={tournament.name}
                  className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-2xl object-cover glow-gold cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={() => setEnlargedPhoto(getImageUrl(tournament.logo))}
                  title="Click to enlarge"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TOURNAMENT_LOGO; }}
                />
              </motion.div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
                <img src={DEFAULT_TOURNAMENT_LOGO} alt="" className="w-10 h-10 object-contain" />
              </div>
            )}

            {/* Tournament Name */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-gradient-gold mb-4"
            >
              {tournament.name}
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6"
            >
              {tournament.description || 'Experience the live auction and track bids in real time.'}
            </motion.p>

            {/* Auction Status Badge */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge
                className={`text-sm px-4 py-1.5 ${status.color} ${status.pulse ? 'animate-live-pulse' : ''}`}
                variant="outline"
              >
                <Radio className="w-3 h-3 mr-2" />
                {status.label}
              </Badge>
            </motion.div>

            {/* Venue & Date */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex flex-col items-center justify-center gap-2 mt-6 text-sm text-muted-foreground"
            >
              {tournament.venue && (
                <span className="flex items-center gap-1.5 justify-center">
                  <MapPin className="w-4 h-4 text-gold/60" /> {tournament.venue}
                </span>
              )}
              {tournament.venue_address && (
                <span className="text-xs text-muted-foreground/85 max-w-lg text-center">
                  Address: {tournament.venue_address}
                </span>
              )}
              {tournament.auction_date && (
                <span className="flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4 text-gold/60" />
                  {new Date(tournament.auction_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              )}
            </motion.div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              {(data.auction_status === 'live' || data.auction_status === 'paused') && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Link href={`/live?tournament_id=${tournament.id}`}>
                    <Button size="lg" className="bg-gold hover:bg-gold-dark text-navy font-bold text-base px-8 glow-gold animate-live-pulse">
                      <Radio className="w-5 h-5 mr-2" /> View Live Auction
                    </Button>
                  </Link>
                </motion.div>
              )}
              {data.auction_status === 'ended' && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Link href={`/live?tournament_id=${tournament.id}`}>
                    <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white font-bold text-base px-8">
                      <Trophy className="w-5 h-5 mr-2" /> View Auction Results
                    </Button>
                  </Link>
                </motion.div>
              )}
              {tournament.youtube_url && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                >
                  <a
                    href={tournament.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold text-base px-8 shadow-md">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping mr-2"></span>
                      🔴 Watch on YouTube
                    </Button>
                  </a>
                </motion.div>
              )}
            </div>
          </div>
        </header>

        {/* Countdown Timer */}
        {tournament.auction_date && data.auction_status === 'not_started' && (
          <section className="py-12 px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-sm uppercase tracking-wider text-gold/70 mb-4 flex items-center justify-center gap-2">
                <Timer className="w-4 h-4" /> Auction Starts In
              </h2>
              <div className="flex items-center justify-center gap-4 md:gap-6">
                {[
                  { value: countdown.days, label: 'Days' },
                  { value: countdown.hours, label: 'Hours' },
                  { value: countdown.minutes, label: 'Minutes' },
                  { value: countdown.seconds, label: 'Seconds' },
                ].map((item) => (
                  <div key={item.label} className="glass-card rounded-xl p-4 md:p-6 min-w-[80px]">
                    <div className="text-3xl md:text-5xl font-bold text-gradient-gold">
                      {String(item.value).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Stats Section */}
        <section className="py-12 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: 'Total Teams', value: stats?.total_teams || 0, color: 'text-blue-400', type: 'teams' as const },
              { icon: UserCheck, label: 'Total Players', value: stats?.total_players || 0, color: 'text-gold', type: 'total' as const },
              { icon: Trophy, label: 'Sold Players', value: stats?.sold_players || 0, color: 'text-green-400', type: 'sold' as const },
              { icon: UserX, label: 'Unsold Players', value: stats?.unsold_players || 0, color: 'text-red-400', type: 'unsold' as const },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
              >
                <Card
                  className="glass-card border-0 cursor-pointer hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  onClick={() => openPublicModal(stat.type)}
                >
                  <CardContent className="p-6 text-center">
                    <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Recent Sold Players */}
        {data.recent_sold && data.recent_sold.length > 0 && (
          <section className="py-12 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-gradient-gold mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-gold" /> Latest Sales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.recent_sold.slice(0, 6).map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="glass-card border-0 hover:glow-gold-sm transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-navy-lighter flex items-center justify-center overflow-hidden shrink-0">
                          {player.photo ? (
                            <img
                              src={getImageUrl(player.photo)}
                              alt={player.name}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              onClick={() => setEnlargedPhoto(getImageUrl(player.photo))}
                              title="Click to enlarge"
                              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                            />
                          ) : (
                            <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{player.name}</h3>
                          <p className="text-sm text-muted-foreground">{player.village}</p>
                          <div className="flex items-center justify-between mt-1">
                            <Badge variant="outline" className="text-xs border-gold/20 text-gold">
                              {player.sold_team_name}
                            </Badge>
                            <span className="text-sm font-bold text-green-400">₹{player.sold_price?.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Highest Bid Player of the Tournament */}
        {(() => {
          const soldPlayers = pubPlayers.filter(p => p.status === 'sold' && p.sold_price !== null && p.sold_price !== undefined);
          const highestPlayer = soldPlayers.length > 0 
            ? soldPlayers.reduce((max, p) => ((p.sold_price || 0) > (max.sold_price || 0) ? p : max), soldPlayers[0])
            : null;

          if (!highestPlayer) return null;

          return (
            <section className="py-12 px-6 border-t border-border/10">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gradient-gold mb-6 flex items-center justify-center gap-2">
                  <Trophy className="w-6 h-6 text-gold animate-bounce" /> Tournament's Highest Bid
                </h2>
                
                <Card className="glass-card border border-gold/20 overflow-hidden glow-gold max-w-2xl mx-auto hover:scale-[1.01] transition-transform duration-300">
                  <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">
                    {/* Photo with zoom/enlarge */}
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-navy-lighter overflow-hidden shrink-0 border border-gold/25 relative group shadow-md flex items-center justify-center">
                      {highestPlayer.photo ? (
                        <img
                          src={getImageUrl(highestPlayer.photo)}
                          alt={highestPlayer.name}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setEnlargedPhoto(getImageUrl(highestPlayer.photo))}
                          title="Click to enlarge"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                        />
                      ) : (
                        <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-white font-semibold uppercase tracking-wider">Click to Enlarge</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 text-center md:text-left space-y-3">
                      <div>
                        <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                          <h3 className="text-2xl font-bold text-foreground">{highestPlayer.name}</h3>
                          {highestPlayer.crickheroes_url && (
                            <a
                              href={ensureUrl(highestPlayer.crickheroes_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gold hover:text-gold-light p-1 bg-gold/10 hover:bg-gold/20 rounded-full transition-all"
                              title="View CricHeroes Profile"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{highestPlayer.village}</p>
                      </div>

                      <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <Badge variant="outline" className="border-gold/20 text-gold bg-gold/5 px-2.5 py-0.5 text-xs font-semibold">
                          {highestPlayer.playing_style || 'Player'}
                        </Badge>
                        {highestPlayer.age && (
                          <Badge variant="outline" className="border-border/40 text-muted-foreground bg-navy-lighter/25 px-2.5 py-0.5 text-xs font-semibold">
                            Age: {highestPlayer.age}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Base Price</p>
                          <p className="text-base font-bold text-foreground">₹{highestPlayer.base_price.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gold/80">Highest Bid</p>
                          <p className="text-xl font-black text-green-400">₹{highestPlayer.sold_price?.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground">
                          Bought by: <span className="text-green-400 font-bold">{highestPlayer.sold_team_name}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          );
        })()}

        {/* Highest Bid Player by Team */}
        {data.teams && data.teams.length > 0 && (
          <section className="py-12 px-6 border-t border-border/10 bg-navy-lighter/5">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-gradient-gold mb-6 flex items-center justify-center gap-2">
                <Users className="w-6 h-6 text-gold" /> Team-wise Highest Bids
              </h2>

              <div className="overflow-x-auto flex gap-6 pb-6 justify-start custom-scrollbar snap-x">
                {(() => {
                  const soldPlayers = pubPlayers.filter(p => p.status === 'sold' && p.sold_price !== null && p.sold_price !== undefined);
                  return data.teams.map((team) => {
                    const teamSoldPlayers = soldPlayers.filter(p => p.sold_team_id === team.id);
                    const teamHighestPlayer = teamSoldPlayers.length > 0
                      ? teamSoldPlayers.reduce((max, p) => ((p.sold_price || 0) > (max.sold_price || 0) ? p : max), teamSoldPlayers[0])
                      : null;

                    return (
                      <div
                        key={team.id}
                        className="w-[280px] shrink-0 glass-card rounded-2xl p-5 border border-gold/10 hover:border-gold/30 hover:shadow-lg transition-all duration-300 flex flex-col justify-between snap-align"
                      >
                        {teamHighestPlayer ? (
                          <div className="space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-3">
                              {/* Photo & Name */}
                              <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl bg-navy-lighter overflow-hidden shrink-0 border border-gold/10 relative group flex items-center justify-center">
                                  {teamHighestPlayer.photo ? (
                                    <img
                                      src={getImageUrl(teamHighestPlayer.photo)}
                                      alt={teamHighestPlayer.name}
                                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                      onClick={() => setEnlargedPhoto(getImageUrl(teamHighestPlayer.photo))}
                                      title="Click to enlarge"
                                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                                    />
                                  ) : (
                                    <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <h4 className="font-bold text-foreground text-sm truncate">{teamHighestPlayer.name}</h4>
                                    {teamHighestPlayer.crickheroes_url && (
                                      <a
                                        href={ensureUrl(teamHighestPlayer.crickheroes_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gold hover:text-gold-light shrink-0"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{teamHighestPlayer.village}</p>
                                  <Badge variant="outline" className="mt-1 border-gold/20 text-gold text-[9px] px-1.5 py-0 bg-gold/5">
                                    {teamHighestPlayer.playing_style || 'Player'}
                                  </Badge>
                                </div>
                              </div>

                              {/* Prices */}
                              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/10 text-center">
                                <div>
                                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Base Price</p>
                                  <p className="text-xs font-bold text-foreground">₹{teamHighestPlayer.base_price.toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] uppercase tracking-wider text-gold/70">Highest Bid</p>
                                  <p className="text-xs font-bold text-green-400">₹{teamHighestPlayer.sold_price?.toLocaleString('en-IN')}</p>
                                </div>
                              </div>
                            </div>

                            {/* Team Name below player details */}
                            <div className="pt-4 mt-auto border-t border-border/10 text-center">
                              <Badge className="bg-navy-lighter hover:bg-navy-lighter border border-gold/20 text-gold text-[10px] py-1 px-3 rounded-full w-full justify-center">
                                {team.name}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 flex-1 flex flex-col justify-between py-4 text-center">
                            <div className="my-auto space-y-2">
                              <UserCircle className="w-10 h-10 text-gold/25 mx-auto" />
                              <p className="text-xs text-muted-foreground italic">No players drafted yet</p>
                            </div>
                            {/* Team Name below player details */}
                            <div className="pt-4 mt-auto border-t border-border/10 text-center">
                              <Badge className="bg-navy-lighter hover:bg-navy-lighter border border-gold/20 text-gold text-[10px] py-1 px-3 rounded-full w-full justify-center">
                                {team.name}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </section>
        )}

        {/* Sponsors */}
        {data.sponsors && data.sponsors.length > 0 && (
          <section className="py-16 px-6 relative border-t border-border/20 bg-gradient-to-b from-transparent to-navy/40">
            <div className="max-w-6xl mx-auto text-center">
              <h2 className="text-xl font-bold tracking-wider text-gradient-gold mb-12 flex items-center justify-center gap-2">
                <Heart className="w-5 h-5 text-gold animate-pulse" /> Tournament Sponsors
              </h2>
              
              <div className="overflow-x-auto flex gap-6 pb-4 justify-start custom-scrollbar">
                {data.sponsors.map((sponsor) => (
                  <div
                    key={sponsor.id}
                    className="w-[280px] shrink-0 glass-card rounded-2xl p-6 flex flex-col items-center text-center border border-gold/10 shadow-[0_0_15px_rgba(212,168,67,0.05)] transition-all duration-300 hover:scale-105 hover:border-gold/30 hover:shadow-[0_0_25px_rgba(212,168,67,0.15)]"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-navy-lighter/50 border border-gold/10 flex items-center justify-center overflow-hidden p-2 mb-4 shrink-0 shadow-inner">
                      {sponsor.logo ? (
                        <img
                          src={getImageUrl(sponsor.logo)}
                          alt={sponsor.name}
                          className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setEnlargedPhoto(getImageUrl(sponsor.logo))}
                          title="Click to enlarge"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_SPONSOR_LOGO; }}
                        />
                      ) : (
                        <img
                          src={DEFAULT_SPONSOR_LOGO}
                          alt={sponsor.name}
                          className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setEnlargedPhoto(DEFAULT_SPONSOR_LOGO)}
                          title="Click to enlarge"
                        />
                      )}
                    </div>
                    <h3 className="text-base font-bold text-gold mb-2">{sponsor.name}</h3>
                    {sponsor.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{sponsor.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-border/50 py-8 px-6 mt-12">
          <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
            <p className="flex items-center justify-center gap-2">
              <Gavel className="w-4 h-4 text-gold/50" />
              Lakshya Sports Cricket Tournament • {tournament.name} © {new Date().getFullYear()}
            </p>
          </div>
        </footer>

        {/* Player Detail Modal */}
        <Dialog open={pubModalType !== null && pubModalType !== 'teams'} onOpenChange={(o) => { if (!o) { setPubModalType(null); setPubSearchQuery(''); } }}>
          <DialogContent className="glass border-gold/10 max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl w-full">
            <DialogHeader>
              <DialogTitle className="text-gradient-gold flex items-center gap-2">
                {pubModalType === 'sold' && <UserCheck className="w-5 h-5 text-green-400" />}
                {pubModalType === 'unsold' && <UserX className="w-5 h-5 text-red-400" />}
                {pubModalType === 'total' && <Users className="w-5 h-5 text-gold" />}
                {pubModalTitle()} ({getPubFilteredPlayers().length})
              </DialogTitle>
            </DialogHeader>
            {/* Search Field */}
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, village, style, or phone..."
                value={pubSearchQuery}
                onChange={(e) => setPubSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-navy-lighter/50 border border-gold/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 transition-all"
              />
            </div>
            {getPubFilteredPlayers().length > 0 ? (
              <>
                {/* Mobile View: Virtual Player List */}
                <VirtualPlayerList<Player>
                  items={getPubFilteredPlayers()}
                  rowHeight={80}
                  maxHeight="60vh"
                  keyExtractor={(p) => p.id}
                  emptyMessage="No players in this category"
                  emptyIcon={<UserCircle className="w-12 h-12 text-gold/20 mx-auto" />}
                  className="md:hidden pr-1 mt-2"
                  renderRow={(p) => (
                    <div className="p-3 rounded-xl bg-navy-lighter/20 border border-gold/10 flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-navy-lighter overflow-hidden shrink-0 border border-gold/10">
                          {p.photo ? (
                            <img
                              src={getImageUrl(p.photo)}
                              alt=""
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setEnlargedPhoto(getImageUrl(p.photo))}
                              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                            />
                          ) : (
                            <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{p.name}</span>
                            {p.crickheroes_url && (
                              <a href={ensureUrl(p.crickheroes_url)} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                            <div>Age: {p.age || '-'} • {p.village || 'No Village'}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[9px] border-gold/20 text-gold px-1.5 py-0">
                                {p.playing_style || '-'}
                              </Badge>
                              <Badge className={`text-[9px] px-1.5 py-0 ${pubStatusColors[p.status]}`}>
                                {p.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-1 shrink-0">
                        <div className="text-[11px] text-muted-foreground">Base: <span className="text-foreground font-semibold">₹{p.base_price.toLocaleString('en-IN')}</span></div>
                        {p.sold_team_name && (
                          <div className="text-[10px] bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5 mt-1">
                            <div className="text-green-400 font-medium truncate max-w-[90px]">{p.sold_team_name}</div>
                            <div className="text-white font-bold">₹{p.sold_price?.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                />

                {/* Desktop View: Full horizontal table */}
                <div
                  className="hidden md:block overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar overscroll-contain"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <Table className="min-w-[650px] w-full">
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead>Player</TableHead>
                        <TableHead>Village</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Status</TableHead>
                        {(pubModalType === 'sold' || pubModalType === 'total') && <TableHead>Sold To</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPubFilteredPlayers().map((p) => (
                        <TableRow key={p.id} className="border-border/20 hover:bg-navy-lighter/30">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-navy-lighter overflow-hidden shrink-0">
                                {p.photo ? (
                                  <img
                                    src={getImageUrl(p.photo)}
                                    alt=""
                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                    onClick={() => setEnlargedPhoto(getImageUrl(p.photo))}
                                    title="Click to enlarge"
                                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                                  />
                                ) : (
                                  <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-foreground text-sm">{p.name}</span>
                                  {p.crickheroes_url && <a href={ensureUrl(p.crickheroes_url)} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light"><ExternalLink className="w-3 h-3" /></a>}
                                </div>
                                {p.age && <span className="text-xs text-muted-foreground">Age: {p.age}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.village || '-'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs border-gold/20 text-gold">{p.playing_style || '-'}</Badge></TableCell>
                          <TableCell className="text-sm">₹{p.base_price.toLocaleString('en-IN')}</TableCell>
                          <TableCell><Badge className={`text-xs ${pubStatusColors[p.status]}`}>{p.status}</Badge></TableCell>
                          {(pubModalType === 'sold' || pubModalType === 'total') && (
                            <TableCell className="text-sm">
                              {p.sold_team_name ? (
                                <div><span className="text-green-400 font-medium">{p.sold_team_name}</span><span className="text-muted-foreground ml-1.5">₹{p.sold_price?.toLocaleString('en-IN')}</span></div>
                              ) : '-'}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="p-10 text-center"><UserCircle className="w-12 h-12 text-gold/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No players in this category</p></div>
            )}
          </DialogContent>
        </Dialog>

        {/* Teams Detail Modal */}
        <Dialog open={pubModalType === 'teams'} onOpenChange={(o) => { if (!o) setPubModalType(null); }}>
          <DialogContent className="glass border-gold/10 max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl w-full">
            <DialogHeader>
              <DialogTitle className="text-gradient-gold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-blue-400" />
                All Teams ({pubTeams.length})
              </DialogTitle>
            </DialogHeader>
            <div
              className="overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {pubTeams.length > 0 ? (
                <>
                  {/* Mobile View: list of team cards */}
                  <div className="md:hidden space-y-2.5">
                    {pubTeams.map((t) => {
                      const spentPct = t.budget > 0 ? ((t.budget - t.remaining_budget) / t.budget) * 100 : 0;
                      return (
                        <div key={t.id} className="p-3 rounded-xl bg-navy-lighter/20 border border-gold/10 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-navy-lighter overflow-hidden shrink-0 flex items-center justify-center border border-gold/10">
                              {t.logo ? (
                                <img
                                  src={getImageUrl(t.logo)}
                                  alt=""
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setEnlargedPhoto(getImageUrl(t.logo))}
                                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TEAM_LOGO; }}
                                />
                              ) : (
                                <img src={DEFAULT_TEAM_LOGO} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground text-sm">{t.name}</h4>
                              <p className="text-xs text-muted-foreground">Owner: {t.owner_name || '-'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/10">
                            <div>
                              <div className="text-muted-foreground text-[10px]">Players</div>
                              <div className="font-semibold text-foreground">{t.player_count} / {t.max_players}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[10px]">Budget</div>
                              <div className="font-semibold text-gold">₹{t.budget.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[10px]">Remaining</div>
                              <div className="font-semibold text-green-400">₹{t.remaining_budget.toLocaleString('en-IN')}</div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                              <span>Spent: {Math.round(spentPct)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-navy-lighter rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all" style={{ width: `${spentPct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop View: Full horizontal table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table className="min-w-[650px] w-full">
                      <TableHeader>
                        <TableRow className="border-border/30">
                          <TableHead>Team</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Players</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pubTeams.map((t) => {
                          const spentPct = t.budget > 0 ? ((t.budget - t.remaining_budget) / t.budget) * 100 : 0;
                          return (
                            <TableRow key={t.id} className="border-border/20 hover:bg-navy-lighter/30">
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-navy-lighter overflow-hidden shrink-0 flex items-center justify-center">
                                    {t.logo ? (
                                      <img
                                        src={getImageUrl(t.logo)}
                                        alt=""
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                        onClick={() => setEnlargedPhoto(getImageUrl(t.logo))}
                                        title="Click to enlarge"
                                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TEAM_LOGO; }}
                                      />
                                    ) : (
                                      <img src={DEFAULT_TEAM_LOGO} alt="" className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <span className="font-medium text-foreground text-sm">{t.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.owner_name || '-'}</TableCell>
                              <TableCell className="text-sm">{t.player_count} / {t.max_players}</TableCell>
                              <TableCell className="text-sm">₹{t.budget.toLocaleString('en-IN')}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <span className="text-sm text-green-400 font-medium">₹{t.remaining_budget.toLocaleString('en-IN')}</span>
                                  <div className="h-1.5 w-20 bg-navy-lighter rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all" style={{ width: `${spentPct}%` }} />
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center"><Trophy className="w-12 h-12 text-gold/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No teams created yet</p></div>
              )}
            </div>
          </DialogContent>
        </Dialog>


        {/* Photo Enlarge Dialog */}
        <Dialog open={!!enlargedPhoto} onOpenChange={(o) => { if (!o) setEnlargedPhoto(null); }}>
          <DialogContent className="glass border-gold/10 p-1 overflow-hidden w-[95vw] max-w-[95vw] sm:max-w-[85vw] bg-navy/95 max-h-[90vh] flex items-center justify-center [&>button]:text-white [&>button]:bg-navy/80 [&>button]:rounded-full [&>button]:p-1">
            {enlargedPhoto && (
              <div className="flex items-center justify-center w-full h-full max-h-[80vh] overflow-hidden">
                <img
                  src={enlargedPhoto}
                  alt="Enlarged View"
                  loading="eager"
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  style={{ objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- RENDERING MAIN MULTI-TOURNAMENT ORGANIZATION HOMEPAGE ---
  const liveTournaments = tournaments.filter(t => t.status === 'auction_live' || t.status === 'auction_paused');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming' || t.status === 'draft');
  const completedTournaments = tournaments.filter(t => t.status === 'auction_ended' || t.status === 'completed');

  const renderTournamentCard = (t: Tournament) => {
    const hasAuctionLive = t.status === 'auction_live' || t.status === 'auction_paused';
    return (
      <Card
        key={t.id}
        className="glass-card border border-gold/10 hover:border-gold/30 hover:glow-gold-sm transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
        onClick={() => { window.location.search = `?tournament_id=${t.id}`; }}
      >
        {/* Top image/colored bar */}
        <div className="h-2 bg-gradient-to-r from-gold to-gold-light" />
        
        <CardContent className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className={`capitalize text-xs ${hasAuctionLive ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'border-gold/20 text-gold'}`}>
                {t.status.replace(/_/g, ' ')}
              </Badge>
              {t.auction_date && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gold/60" />
                  {new Date(t.auction_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short'
                  })}
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-gold transition-colors">{t.name}</h3>
            <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-6">
              {t.description || 'Join us for the live action auction and track match schedules.'}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/20">
            {t.venue && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 text-gold/60 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{t.venue}{t.venue_address ? `, ${t.venue_address}` : ''}</span>
              </div>
            )}
            <Button
              className="w-full bg-navy-lighter hover:bg-gold hover:text-navy border border-gold/20 text-gold text-xs font-semibold py-2 rounded-xl transition-all"
            >
              View Details & Live Auction
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        {/* Header/NavBar */}
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/lakshya_sports_logo.png"
                alt="Lakshya Sports Logo"
                className="w-10 h-10 rounded-full border border-gold/30 object-cover shadow-md"
              />
              <div>
                <span className="text-lg font-bold text-gradient-gold block leading-none">Lakshya Sports</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 tracking-wider uppercase font-semibold">Cricket Organization</span>
              </div>
            </div>
            {mounted && isAuthenticated && user ? (
              <Link href="/dashboard" prefetch={false}>
                <Button size="sm" className="bg-gold hover:bg-gold-dark text-navy font-semibold shadow-md glow-gold-sm">
                  {user.role === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard'}
                </Button>
              </Link>
            ) : mounted ? (
              <Link href="/login" prefetch={false}>
                <Button size="sm" className="bg-gold hover:bg-gold-dark text-navy font-semibold shadow-md glow-gold-sm">
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              </Link>
            ) : (
              <div className="w-20 h-8" />
            )}
          </div>
        </header>

        {/* Hero Banner Section */}
        <section className="relative overflow-hidden py-16 md:py-24 border-b border-border/20">
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-light to-navy-lighter opacity-95" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,168,67,0.18),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(212,168,67,0.1),transparent_50%)]" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
            {/* Circular DP Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 flex justify-center"
            >
              <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 shadow-xl overflow-hidden flex items-center justify-center">
                <img
                  src="/lakshya_sports_logo.png"
                  alt="Lakshya Sports Logo"
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover bg-white"
                />
              </div>
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gradient-gold mb-4"
            >
              Lakshya Sports
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Lakshya Sports is a premier cricket organization and sports academy. We manage professional cricket leagues, coach talent, broadcast matches live on YouTube, and host exciting player auctions. Discover our tournaments below.
            </motion.p>

            {/* Social / Contact Grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm"
            >
              <a
                href="https://instagram.com/lakshya_sports_"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-navy-lighter/60 hover:bg-navy-lighter border border-gold/10 hover:border-gold/30 text-muted-foreground hover:text-foreground px-4 py-2 rounded-full transition-all"
              >
                <svg
                  className="w-4 h-4 text-pink-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span>lakshya_sports_</span>
              </a>
              <a
                href="https://youtube.com/@lakshyasports-u1y"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-navy-lighter/60 hover:bg-navy-lighter border border-gold/10 hover:border-gold/30 text-muted-foreground hover:text-foreground px-4 py-2 rounded-full transition-all"
              >
                <svg
                  className="w-4 h-4 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
                  <polygon points="10 15 15 12 10 9" />
                </svg>
                <span>@lakshyasports-u1y</span>
              </a>
              <a
                href="tel:7842971717"
                className="flex items-center gap-2 bg-navy-lighter/60 hover:bg-navy-lighter border border-gold/10 hover:border-gold/30 text-muted-foreground hover:text-foreground px-4 py-2 rounded-full transition-all"
              >
                <Phone className="w-4 h-4 text-green-400" />
                <span>+91 78429 71717</span>
              </a>
              <a
                href="mailto:lakshyasports99@gmail.com"
                className="flex items-center gap-2 bg-navy-lighter/60 hover:bg-navy-lighter border border-gold/10 hover:border-gold/30 text-muted-foreground hover:text-foreground px-4 py-2 rounded-full transition-all"
              >
                <Mail className="w-4 h-4 text-blue-400" />
                <span>lakshyasports99@gmail.com</span>
              </a>
            </motion.div>
          </div>
        </section>

        {/* All Tournaments Section */}
        <section className="py-16 px-6 max-w-7xl mx-auto space-y-16">
          
          {/* 1. Active or Live Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Live & Active Auctions</h2>
              </div>
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">{liveTournaments.length} Active</Badge>
            </div>
            {liveTournaments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveTournaments.map(renderTournamentCard)}
              </div>
            ) : (
              <div className="text-center py-12 bg-navy-lighter/10 rounded-2xl border border-dashed border-gold/10 text-muted-foreground text-sm">
                No auctions are currently live.
              </div>
            )}
          </div>

          {/* 2. Upcoming Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gold" />
                <h2 className="text-2xl font-bold text-foreground">Upcoming Tournaments</h2>
              </div>
              <Badge className="bg-gold/10 text-gold border-gold/20">{upcomingTournaments.length} Upcoming</Badge>
            </div>
            {upcomingTournaments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTournaments.map(renderTournamentCard)}
              </div>
            ) : (
              <div className="text-center py-12 bg-navy-lighter/10 rounded-2xl border border-dashed border-gold/10 text-muted-foreground text-sm">
                No upcoming tournaments scheduled.
              </div>
            )}
          </div>

          {/* 3. Auction Completed or Over Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-2xl font-bold text-muted-foreground">Completed Auctions</h2>
              </div>
              <Badge variant="outline" className="text-muted-foreground border-border/40">{completedTournaments.length} Completed</Badge>
            </div>
            {completedTournaments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 hover:opacity-90 transition-opacity">
                {completedTournaments.map(renderTournamentCard)}
              </div>
            ) : (
              <div className="text-center py-12 bg-navy-lighter/10 rounded-2xl border border-dashed border-gold/10 text-muted-foreground text-sm">
                No completed auctions listed yet.
              </div>
            )}
          </div>

        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6 bg-navy-lighter/20">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <Gavel className="w-4 h-4 text-gold/50" />
            Lakshya Sports Cricket Auction Platform © {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">All rights reserved.</p>
        </div>
      </footer>
      <Dialog open={!!enlargedPhoto} onOpenChange={(o) => { if (!o) setEnlargedPhoto(null); }}>
        <DialogContent className="glass border-gold/10 p-1 overflow-hidden w-[95vw] max-w-[95vw] sm:max-w-[85vw] bg-navy/95 max-h-[90vh] flex items-center justify-center [&>button]:text-white [&>button]:bg-navy/80 [&>button]:rounded-full [&>button]:p-1">
          {enlargedPhoto && (
            <div className="flex items-center justify-center w-full h-full max-h-[80vh] overflow-hidden">
              <img
                src={enlargedPhoto}
                alt="Enlarged View"
                loading="eager"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                style={{ objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
