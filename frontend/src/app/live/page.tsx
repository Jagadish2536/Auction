'use client';

import { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSocket } from '@/lib/socket';
import { getImageUrl } from '@/lib/api';
import { AuctionFullState, Player, Tournament } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Radio, Trophy, Users, UserCircle, Gavel, Timer, TrendingUp, Home, ArrowLeft, Heart, Search } from 'lucide-react';
import Link from 'next/link';
import OptimizedImage, { DEFAULT_PLAYER_PHOTO } from '@/components/ui/OptimizedImage';
import VirtualPlayerList from '@/components/ui/VirtualPlayerList';
import { usePublicPlayers } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries';
import { prefetchPlayerImages, prefetchTeamImages } from '@/lib/imageCache';

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

export default function LivePage() {
  const [state, setState] = useState<AuctionFullState | null>(null);
  const [messages, setMessages] = useState<{ message: string; type: string }[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [timerValue, setTimerValue] = useState(30);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);

  // Modal details & all players state
  const queryClient = useQueryClient();
  const { data: players = [], refetch: refetchPlayers } = usePublicPlayers(tournamentId);
  const [activeFilter, setActiveFilter] = useState<'total' | 'sold' | 'unsold' | 'left' | null>(null);
  const [selectedSquadPlayer, setSelectedSquadPlayer] = useState<Player | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const isAudioEnabledRef = useRef(isAudioEnabled);

  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  // Lock body scroll on mobile/iOS when any modal is open
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    const isModalOpen = activeFilter !== null || selectedSquadPlayer !== null || enlargedPhoto !== null;
    if (isModalOpen) {
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalHtmlHeight = document.documentElement.style.height;
      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyHeight = document.body.style.height;

      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100%';

      return () => {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.documentElement.style.height = originalHtmlHeight;
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.height = originalBodyHeight;
      };
    }
  }, [activeFilter, selectedSquadPlayer, enlargedPhoto]);

  const speakMessage = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(v => v.lang === 'en-IN' || v.lang.startsWith('en-in') || v.name.includes('India'));
      if (indianVoice) {
        utterance.voice = indianVoice;
      }
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech error:', e);
    }
  };

  const announceAuctionMessage = (msg: { message: string; type: string }) => {
    if (!isAudioEnabledRef.current) return;
    let speechText = '';
    const cleanMessage = msg.message.replace(/[🎯💰🎉❌]/g, '').trim();
    if (msg.type === 'info') {
      const match = cleanMessage.match(/(.+) is up for auction! Base price: ₹(.+)/i);
      if (match) {
        const name = match[1].trim();
        const price = match[2].replace(/,/g, '').trim();
        speechText = `${name} is up for auction. Base price is ${price} rupees. Bidding starts now.`;
      } else {
        speechText = cleanMessage.replace('₹', 'rupees');
      }
    } else if (msg.type === 'bid') {
      const match = cleanMessage.match(/(.+) bids ₹(.+)!/i);
      if (match) {
        const team = match[1].trim();
        const amount = match[2].replace(/,/g, '').replace('!', '').trim();
        speechText = `${team} bids ${amount} rupees.`;
      } else {
        speechText = cleanMessage.replace('₹', 'rupees');
      }
    } else if (msg.type === 'sold') {
      const match = cleanMessage.match(/(.+) SOLD to (.+) for ₹(.+)!/i);
      if (match) {
        const name = match[1].trim();
        const team = match[2].trim();
        const price = match[3].replace(/,/g, '').replace('!', '').trim();
        speechText = `Sold! ${name} is sold to team ${team} for ${price} rupees. Congratulations.`;
      } else {
        speechText = cleanMessage.replace('₹', 'rupees');
      }
    } else if (msg.type === 'unsold') {
      const match = cleanMessage.match(/(.+) goes UNSOLD/i);
      if (match) {
        const name = match[1].trim();
        speechText = `${name} is unsold.`;
      } else {
        speechText = cleanMessage;
      }
    }
    if (speechText) {
      speakMessage(speechText);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryTid = params.get('tournament_id');
    if (queryTid) {
      setTournamentId(Number(queryTid));
    } else {
      // Get tournament ID from public API if none provided in URL
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/public/tournament`)
        .then((r) => r.json())
        .then((d) => {
          if (d.tournament) setTournamentId(d.tournament.id);
        }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    const fetchT = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/public/tournament/${tournamentId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.tournament) setTournament(d.tournament);
          if (d.sponsors) setSponsors(d.sponsors);
        }).catch(() => {});
    };
    fetchT();
  }, [tournamentId]);

  // Invalidate player cache when stats change (player sold/unsold)
  useEffect(() => {
    if (tournamentId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.publicPlayers(tournamentId) });
    }
  }, [tournamentId, state?.stats?.sold, state?.stats?.unsold, queryClient]);

  // Preload team images when state updates
  useEffect(() => {
    if (state?.teams) {
      prefetchTeamImages(state.teams);
    }
  }, [state?.teams]);

  useEffect(() => {
    if (!tournamentId) return;
    
    const socket = getSocket();

    const handleConnect = () => {
      console.log('Live Socket connected/reconnected, joining room:', tournamentId);
      socket.emit('join_auction', { tournament_id: tournamentId });
    };

    socket.on('connect', handleConnect);

    socket.on('auction:state', (data: AuctionFullState) => {
      setState(data);
      if (data.auction) setTimerValue(data.auction.timer_remaining);
    });
    
    socket.on('auction:message', (msg: { message: string; type: string }) => {
      setMessages((prev) => [msg, ...prev].slice(0, 100));
      announceAuctionMessage(msg);
    });

    socket.on('auction:history', (data: { messages: { message: string; type: string }[] }) => {
      if (data && data.messages) {
        setMessages(data.messages);
      }
    });
    
    socket.on('auction:timer', (data: { remaining: number }) => setTimerValue(data.remaining));
    
    socket.on('auction:viewer_count', (data: { count: number }) => {
      setViewerCount(data.count);
    });

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit('leave_auction', { tournament_id: tournamentId });
      socket.off('connect', handleConnect);
      socket.off('auction:state');
      socket.off('auction:message');
      socket.off('auction:history');
      socket.off('auction:timer');
      socket.off('auction:viewer_count');
    };
  }, [tournamentId]);

  const auction = state?.auction;
  const player = auction?.current_player;
  const isLive = auction?.status === 'live';

  // Memoized filtered players — only recomputes when dependencies change
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      // Status filter
      let statusMatch = false;
      if (activeFilter === 'total') statusMatch = true;
      else if (activeFilter === 'sold') statusMatch = p.status === 'sold';
      else if (activeFilter === 'unsold') statusMatch = p.status === 'unsold';
      else if (activeFilter === 'left') statusMatch = p.status === 'available';
      if (!statusMatch) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.village?.toLowerCase().includes(q) ||
          p.playing_style?.toLowerCase().includes(q) ||
          p.mobile?.includes(q)
        );
      }
      return true;
    });
  }, [players, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-gold/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Top Row: Logo, Brand Name & Mobile Status Indicators */}
          <div className="flex items-center justify-between md:justify-start gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              {tournament?.logo ? (
                <img
                  src={getImageUrl(tournament.logo)}
                  alt={tournament.name}
                  className="w-8 h-8 rounded-md object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TOURNAMENT_LOGO; }}
                />
              ) : (
                <img src={DEFAULT_TOURNAMENT_LOGO} alt="" className="w-8 h-8 object-contain" />
              )}
              <span className="font-bold text-gradient-gold">
                {tournament?.name || 'Lakshya Live'}
              </span>
            </Link>
            
            {/* Mobile-only compact status indicators */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex items-center gap-1 bg-navy-lighter/60 border border-gold/10 px-2 py-0.5 rounded-full text-[10px] font-semibold text-muted-foreground shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                <span className="text-white/90 font-medium">{viewerCount}</span>
              </div>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${
                auction?.status === 'live' 
                  ? 'border-red-500/30 text-red-400 animate-live-pulse' 
                  : auction?.status === 'paused'
                    ? 'border-yellow-500/30 text-yellow-400'
                    : 'border-muted text-muted-foreground'
              }`}>
                {auction?.status ? auction.status.replace(/_/g, ' ').toUpperCase() : 'OFFLINE'}
              </Badge>
            </div>
          </div>

          {/* Bottom Row (on Mobile): Navigation and Action Buttons in a single line */}
          <div className="flex flex-row flex-wrap items-center justify-start md:justify-end gap-1.5 w-full md:w-auto">
            <a
              href="/"
              className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground hover:text-gold bg-navy-lighter/35 hover:bg-navy-lighter border border-gold/5 hover:border-gold/20 px-2 py-1 rounded-lg transition-all shrink-0"
            >
              <Home className="w-3 h-3" />
              <span>Home</span>
            </a>
            {tournamentId && (
              <Link
                href={`/?tournament_id=${tournamentId}`}
                className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground hover:text-gold bg-navy-lighter/35 hover:bg-navy-lighter border border-gold/5 hover:border-gold/20 px-2 py-1 rounded-lg transition-all shrink-0"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Tournament</span>
              </Link>
            )}
            {tournament?.youtube_url && (
              <a
                href={tournament.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-full text-[11px] font-bold transition-all shadow-md cursor-pointer shrink-0"
              >
                <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
                🔴 YouTube Live
              </a>
            )}
            <button
              onClick={() => {
                const nextVal = !isAudioEnabled;
                setIsAudioEnabled(nextVal);
                if (nextVal) {
                  speakMessage("Audio announcements turned on!");
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer shrink-0 ${
                isAudioEnabled 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' 
                  : 'bg-navy-lighter/50 border-gold/10 text-muted-foreground hover:text-gold'
              }`}
            >
              {isAudioEnabled ? '🔊 ON' : '🔇 OFF'}
            </button>

            {/* Desktop-only Watching count */}
            <div className="hidden md:flex items-center gap-1.5 bg-navy-lighter/60 border border-gold/10 px-2.5 py-1 rounded-full text-[11px] font-semibold text-muted-foreground shadow-sm ml-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-white/90 font-medium">{viewerCount} Watching</span>
            </div>

            <Badge variant="outline" className={`hidden md:flex items-center text-xs ${
              auction?.status === 'live' 
                ? 'border-red-500/30 text-red-400 animate-live-pulse' 
                : auction?.status === 'paused'
                  ? 'border-yellow-500/30 text-yellow-400'
                  : 'border-muted text-muted-foreground'
            }`}>
              <Radio className="w-3 h-3 mr-1" />
              {auction?.status ? auction.status.replace(/_/g, ' ').toUpperCase() : 'OFFLINE'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Current Player */}
          <div className="lg:col-span-2">
            <Card className={`glass-card border-0 ${player ? 'glow-gold' : ''}`}>
              <CardContent className="p-6 md:p-8">
                {player ? (
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-navy-lighter overflow-hidden shrink-0">
                      {player.photo ? (
                        <img
                          src={getImageUrl(player.photo)}
                          alt={player.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setEnlargedPhoto(getImageUrl(player.photo))}
                          title="Click to enlarge"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                        />
                      ) : (
                        <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <p className="text-sm text-gold uppercase tracking-wider mb-1">Now Bidding</p>
                      <h1 className="text-3xl md:text-4xl font-bold text-foreground">{player.name}</h1>
                      <p className="text-muted-foreground text-lg">{player.village}</p>
                      <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start mt-2">
                        <Badge variant="outline" className="border-gold/20 text-gold">{player.playing_style}</Badge>
                        {player.crickheroes_url && (
                          <a
                            href={ensureUrl(player.crickheroes_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs bg-navy-lighter hover:bg-navy-lighter/80 text-gold font-semibold py-1 px-3 rounded-full border border-gold/20 transition-colors shadow-sm"
                          >
                            Crickheroes ↗
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-6 mt-6">
                        <div>
                          <p className="text-xs text-muted-foreground">Base Price</p>
                          <p className="text-xl font-bold text-foreground">₹{player.base_price.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Current Bid</p>
                          <p className="text-3xl font-bold text-gold animate-bid-pop">₹{(auction?.current_bid || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      {auction?.current_team_name && (
                        <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                          <p className="text-sm text-green-400">🏏 <span className="font-bold text-lg">{auction.current_team_name}</span> bids <span className="font-bold text-lg text-gold">₹{(auction.current_bid || 0).toLocaleString('en-IN')}</span>!</p>
                        </div>
                      )}
                    </div>

                    {/* Timer */}
                    <div className="flex flex-col items-center">
                      <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center
                        ${timerValue <= 5 ? 'border-red-500 text-red-400' : timerValue <= 10 ? 'border-yellow-500 text-yellow-400' : 'border-gold/30 text-gold'}`}>
                        <span className="text-3xl font-bold">{timerValue}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Timer className="w-3 h-3" /> seconds</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Gavel className="w-16 h-16 text-gold/20 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-2">
                      {auction?.status === 'ended' ? 'Auction Has Ended' :
                       auction?.status === 'paused' ? 'Auction is Paused' :
                       'Waiting for Next Player'}
                    </h2>
                    <p className="text-muted-foreground">Stay tuned for live updates</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Total', value: state?.stats?.total || 0, color: 'text-blue-400', filterKey: 'total' as const },
                { label: 'Sold', value: state?.stats?.sold || 0, color: 'text-green-400', filterKey: 'sold' as const },
                { label: 'Unsold', value: state?.stats?.unsold || 0, color: 'text-red-400', filterKey: 'unsold' as const },
                { label: 'Left', value: state?.stats?.available || 0, color: 'text-gold', filterKey: 'left' as const },
              ].map((s) => (
                <Card
                  key={s.label}
                  className="glass-card border border-gold/5 cursor-pointer hover:border-gold/30 hover:bg-navy-lighter/30 transition-all duration-200"
                  onClick={() => {
                    refetchPlayers();
                    setActiveFilter(s.filterKey);
                  }}
                >
                  <CardContent className="p-3 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="overflow-x-auto flex gap-4 pb-4 lg:flex-col lg:overflow-visible lg:pb-0 custom-scrollbar">
            {/* Live Feed */}
            <div className="w-[320px] lg:w-auto shrink-0">
              <Card className="glass-card border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="w-4 h-4 text-red-400 animate-live-pulse" /> Live Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-1">
                      {messages.map((msg, i) => (
                        <p key={i} className="text-xs text-muted-foreground py-1.5 border-b border-border/20">{msg.message}</p>
                      ))}
                      {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Waiting for updates...</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Recent Sales */}
            <div className="w-[320px] lg:w-auto shrink-0">
              <Card className="glass-card border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gold" /> Recent Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2">
                      {state?.recent_sold?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-navy-lighter/30">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.sold_team_name}</p>
                          </div>
                          <span className="text-sm text-green-400 font-bold shrink-0">₹{p.sold_price?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      {(!state?.recent_sold || state.recent_sold.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No sales yet</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Teams and their Purchased (Sold) Players */}
        <section className="mt-8 border-t border-gold/10 pt-6">
          <h2 className="text-xl font-bold text-gradient-gold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-gold" />
            Teams Squads & Purchase Details
          </h2>
          <div className="overflow-x-auto flex gap-4 pb-4 custom-scrollbar">
            {state?.teams?.map((team) => {
              const teamPlayers = players.filter((p) => p.status === 'sold' && p.sold_team_id === team.id);
              const spent = team.budget - team.remaining_budget;
              const remaining = team.remaining_budget;
              const purchasedCount = team.player_count;
              
              const leftCount = Math.max(0, team.max_players - purchasedCount);
              
              // Use tournament default base price
              const basePrice = tournament?.default_base_price || 1000;
              
              // Calculate Max Bid: Remaining Budget - (Players Left - 1) * basePrice
              const maxBid = leftCount > 0 
                ? Math.max(0, remaining - (leftCount - 1) * basePrice)
                : 0;
              
              // Find signature (highest purchased) player
              const signaturePlayer = teamPlayers.reduce((max, p) => 
                (p.sold_price || 0) > (max?.sold_price || 0) ? p : max
              , null as Player | null);

              return (
                <div key={team.id} className="w-[320px] shrink-0">
                  <Card className="glass-card border border-gold/10 hover:border-gold/30 transition-all flex flex-col h-[460px]">
                    <CardHeader className="pb-3 border-b border-border/20 text-center flex flex-row items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-navy-lighter flex items-center justify-center overflow-hidden border border-gold/10 shrink-0">
                        {team.logo ? (
                          <img
                            src={getImageUrl(team.logo)}
                            alt={team.name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => setEnlargedPhoto(getImageUrl(team.logo))}
                            title="Click to enlarge"
                            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TEAM_LOGO; }}
                          />
                        ) : (
                          <img src={DEFAULT_TEAM_LOGO} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <CardTitle className="text-base font-bold text-gradient-gold truncate">{team.name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground truncate">Owner: {team.owner_name} | Captain: {team.captain_name}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1 flex flex-col">
                      {/* Stats details section */}
                      <div className="space-y-1.5 text-xs text-center border-b border-border/10 pb-4 mb-3">
                        <p className="text-muted-foreground font-medium">
                          Spent <span className="text-red-400 font-semibold">₹{spent.toLocaleString('en-IN')}</span> | Remaining <span className="text-green-400 font-semibold">₹{remaining.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-muted-foreground font-medium">
                          Purchased <span className="text-blue-400 font-semibold">{purchasedCount}</span> | Left <span className="text-gold font-semibold">{leftCount}</span>
                        </p>
                        <p className="text-muted-foreground font-medium">
                          Max Bid <span className="text-gold font-semibold">₹{maxBid.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-muted-foreground font-medium flex items-center justify-center gap-1">
                          <span className="text-gold">⭐</span>
                          {signaturePlayer ? (
                            <span className="truncate max-w-[200px]">
                              {signaturePlayer.name} <span className="text-green-400 font-semibold">₹{signaturePlayer.sold_price?.toLocaleString('en-IN')}</span>
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/60">None</span>
                          )}
                        </p>
                      </div>

                      {/* Table Headers */}
                      <div className="flex justify-between text-[11px] font-bold text-muted-foreground border-b border-border/20 pb-1.5 mb-1.5 px-1">
                        <span>Player</span>
                        <span>Bid</span>
                      </div>

                      {/* Scrollable Player List */}
                      <ScrollArea className="h-[250px] pr-1 flex-1">
                        <div className="space-y-1">
                          {teamPlayers.map((p) => {
                            const isHighest = signaturePlayer && p.id === signaturePlayer.id;
                            return (
                              <div key={p.id} className="flex items-center justify-between text-xs py-1.5 px-1 border-b border-border/10 last:border-0">
                                <button
                                  onClick={() => setSelectedSquadPlayer(p)}
                                  className="text-foreground/90 font-medium hover:text-gold transition-colors text-left truncate max-w-[130px] cursor-pointer"
                                >
                                  {p.name}
                                </button>
                                {isHighest ? (
                                  <span className="bg-gold text-navy font-bold px-1.5 py-0.5 rounded text-[11px] min-w-[50px] text-center shadow-sm">
                                    ₹{p.sold_price?.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground font-semibold">
                                    ₹{p.sold_price?.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {teamPlayers.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-12 italic">No players purchased yet</p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </section>

        {/* Leaderboard Section */}
        <section className="mt-8 border-t border-gold/10 pt-6">
          <h2 className="text-xl font-bold text-gradient-gold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            Teams Leaderboard
          </h2>
          <div className="overflow-x-auto flex gap-4 pb-4 custom-scrollbar">
            {state?.teams?.sort((a, b) => b.player_count - a.player_count).map((team, i) => (
              <div key={team.id} className="w-[280px] shrink-0 p-4 rounded-xl bg-navy-lighter/30 border border-gold/10 flex items-center gap-3.5 shadow-sm transition-all hover:border-gold/20">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${i === 0 ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-navy-lighter text-muted-foreground border border-border/10'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-navy-lighter flex items-center justify-center overflow-hidden border border-gold/10 shrink-0">
                  {team.logo ? (
                    <img
                      src={getImageUrl(team.logo)}
                      alt={team.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                      onClick={() => setEnlargedPhoto(getImageUrl(team.logo))}
                      title="Click to enlarge"
                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TEAM_LOGO; }}
                    />
                  ) : (
                    <img src={DEFAULT_TEAM_LOGO} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.player_count} players</p>
                </div>
                <span className="text-sm font-bold text-gold shrink-0">₹{team.remaining_budget.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sponsors Section */}
        {sponsors && sponsors.length > 0 && (
          <section className="mt-8 border-t border-gold/10 pt-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-gradient-gold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-gold animate-pulse" /> Sponsored By
            </h2>
            <div className="overflow-x-auto flex gap-6 pb-4 justify-start custom-scrollbar">
              {sponsors.map((s) => (
                <div
                  key={s.id}
                  className="w-[280px] shrink-0 glass-card p-6 rounded-2xl flex flex-col items-center text-center border border-gold/10 shadow-[0_0_15px_rgba(212,168,67,0.03)] transition-all hover:scale-[1.03] hover:border-gold/25"
                >
                  <div className="w-32 h-20 rounded-xl bg-navy-lighter/50 border border-gold/10 flex items-center justify-center overflow-hidden p-2 mb-4 shrink-0 shadow-inner">
                    {s.logo ? (
                      <img
                        src={getImageUrl(s.logo)}
                        alt={s.name}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setEnlargedPhoto(getImageUrl(s.logo))}
                        title="Click to enlarge"
                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_SPONSOR_LOGO; }}
                      />
                    ) : (
                      <img
                        src={DEFAULT_SPONSOR_LOGO}
                        alt={s.name}
                        className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setEnlargedPhoto(DEFAULT_SPONSOR_LOGO)}
                        title="Click to enlarge"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gold mb-2">{s.name}</h4>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Stats Detail Dialog */}
      <Dialog open={activeFilter !== null} onOpenChange={(open) => { if (!open) { setActiveFilter(null); setSearchQuery(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[85vw] md:max-w-2xl w-full bg-navy border border-gold/10 text-foreground max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient-gold capitalize">
              {activeFilter === 'left' ? 'Remaining' : activeFilter} Players ({filteredPlayers.length})
            </DialogTitle>
          </DialogHeader>
          {/* Search Field */}
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, village, style, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-navy-lighter/50 border border-gold/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 transition-all"
            />
          </div>
          <VirtualPlayerList<Player>
            items={filteredPlayers}
            rowHeight={80}
            maxHeight="60vh"
            keyExtractor={(p) => p.id}
            emptyMessage="No players found"
            emptyIcon={<UserCircle className="w-12 h-12 text-gold/20 mx-auto" />}
            className="pr-4 mt-4 flex-1 min-h-0"
            renderRow={(p) => (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-navy-lighter/30 border border-border/50">
                <div className="w-12 h-12 rounded-lg bg-navy-lighter overflow-hidden shrink-0">
                  <OptimizedImage
                    src={p.photo ? getImageUrl(p.photo) : null}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => setEnlargedPhoto(getImageUrl(p.photo))}
                    title="Click to enlarge"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedSquadPlayer(p)}
                    className="text-sm font-semibold text-foreground hover:text-gold transition-colors truncate text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    {p.name}
                  </button>
                  {p.crickheroes_url && (
                    <a
                      href={ensureUrl(p.crickheroes_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-gold font-normal border border-gold/20 px-1.5 py-0.5 rounded-sm hover:bg-gold/10 transition-colors shrink-0"
                    >
                      Profile ↗
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">{p.village} | {p.playing_style}</p>
                </div>
                <div className="text-right shrink-0">
                  {p.status === 'sold' ? (
                    <>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-1">
                        Sold to {p.sold_team_name}
                      </Badge>
                      <p className="text-sm font-bold text-green-400">₹{p.sold_price?.toLocaleString('en-IN')}</p>
                    </>
                  ) : p.status === 'unsold' ? (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      Unsold
                    </Badge>
                  ) : (
                    <>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mb-1">
                        Available
                      </Badge>
                      <p className="text-xs text-muted-foreground">Base: ₹{p.base_price.toLocaleString('en-IN')}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          />
        </DialogContent>
      </Dialog>

      {/* Player Details Dialog */}
      <Dialog open={!!selectedSquadPlayer} onOpenChange={(o) => { if (!o) setSelectedSquadPlayer(null); }}>
        <DialogContent className="glass border-gold/10 max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-gradient-gold text-lg">Player Details</DialogTitle>
          </DialogHeader>
          {selectedSquadPlayer && (
            <div className="py-4 space-y-4">
              <div className="w-24 h-24 rounded-full bg-navy-lighter flex items-center justify-center overflow-hidden mx-auto border border-gold/10">
                {selectedSquadPlayer.photo ? (
                  <img
                    src={getImageUrl(selectedSquadPlayer.photo)}
                    alt={selectedSquadPlayer.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => setEnlargedPhoto(getImageUrl(selectedSquadPlayer.photo))}
                    title="Click to enlarge"
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                  />
                ) : (
                  <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedSquadPlayer.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedSquadPlayer.village}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-navy-lighter/30 rounded-lg">
                <div>
                  <p className="text-muted-foreground">Playing Style</p>
                  <p className="font-semibold text-foreground">{selectedSquadPlayer.playing_style}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Price</p>
                  <p className="font-semibold text-foreground">₹{selectedSquadPlayer.base_price.toLocaleString('en-IN')}</p>
                </div>
                {selectedSquadPlayer.status === 'sold' && (
                  <div className="col-span-2 border-t border-border/10 pt-2 mt-1">
                    <p className="text-muted-foreground font-medium font-semibold">Sold Price</p>
                    <p className="text-sm font-bold text-green-400">₹{selectedSquadPlayer.sold_price?.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
              {selectedSquadPlayer.crickheroes_url && (
                <a
                  href={ensureUrl(selectedSquadPlayer.crickheroes_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-navy font-bold py-2 px-4 rounded-lg transition-colors text-sm shadow-md cursor-pointer"
                >
                  Crickheroes Profile ↗
                </a>
              )}
            </div>
          )}
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
