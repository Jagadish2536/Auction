'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getSocket } from '@/lib/socket';
import api, { getImageUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { AuctionFullState, Player, Tournament } from '@/types';
import { toast } from 'sonner';
import {
  Play, Pause, Square, RotateCcw, Gavel, Users, Timer,
  ChevronUp, Check, X, Undo2, Radio, Trophy, UserCircle
} from 'lucide-react';

export default function AuctionPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';
  const canControl = isManager || isAdmin;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionFullState | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [unsoldPlayers, setUnsoldPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'unsold'>('available');
  const [confirmSelectPlayer, setConfirmSelectPlayer] = useState<Player | null>(null);
  const [messages, setMessages] = useState<{ message: string; type: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [timerValue, setTimerValue] = useState(30);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [customBid, setCustomBid] = useState<string>('');

  const loadAvailablePlayers = useCallback((tid: number) => {
    api.get(`/tournaments/${tid}/players?status=available`)
      .then((res) => setAvailablePlayers(res.data.players))
      .catch(() => {});
  }, []);

  const loadUnsoldPlayers = useCallback((tid: number) => {
    api.get(`/tournaments/${tid}/players?status=unsold`)
      .then((res) => setUnsoldPlayers(res.data.players))
      .catch(() => {});
  }, []);

  // Load tournament
  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        setTournament(res.data.tournament);
      }).catch(() => {});
    } else {
      api.get('/tournaments').then((res) => {
        const t = res.data.tournaments;
        if (t.length > 0) setTournament(t[0]);
      }).catch(() => {});
    }
  }, []);

  // Socket connection
  useEffect(() => {
    if (!tournament) return;
    const socket = getSocket();

    const handleConnect = () => {
      console.log('Manager Socket connected/reconnected, joining room:', tournament.id);
      socket.emit('join_auction', { tournament_id: tournament.id });
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);

    socket.on('auction:state', (data: AuctionFullState) => {
      setAuctionState(data);
      if (data.auction) setTimerValue(data.auction.timer_remaining);
    });

    socket.on('auction:message', (msg: { message: string; type: string }) => {
      setMessages((prev) => [msg, ...prev].slice(0, 50));
      if (msg.type === 'sold') toast.success(msg.message);
      else if (msg.type === 'bid') toast.info(msg.message);
      else if (msg.type === 'warning') toast.warning(msg.message);
    });

    socket.on('auction:error', (data: { error: string }) => {
      toast.error(data.error);
    });

    socket.on('auction:timer', (data: { remaining: number }) => {
      setTimerValue(data.remaining);
    });

    socket.on('auction:viewer_count', (data: { count: number }) => {
      setViewerCount(data.count);
    });

    // Load initial players
    loadAvailablePlayers(tournament.id);
    loadUnsoldPlayers(tournament.id);

    return () => {
      socket.emit('leave_auction', { tournament_id: tournament.id });
      socket.off('connect', handleConnect);
      socket.off('auction:state');
      socket.off('auction:message');
      socket.off('auction:error');
      socket.off('auction:viewer_count');
      socket.off('auction:timer');
    };
  }, [tournament, loadAvailablePlayers, loadUnsoldPlayers]);

  // Refresh available and unsold players on state change
  useEffect(() => {
    if (!tournament) return;
    loadAvailablePlayers(tournament.id);
    loadUnsoldPlayers(tournament.id);
  }, [auctionState?.stats?.available, auctionState?.stats?.unsold, tournament, loadAvailablePlayers, loadUnsoldPlayers]);

  const handleSelectRandom = () => {
    const list = activeTab === 'available' ? availablePlayers : unsoldPlayers;
    if (list.length === 0) {
      toast.error(`No ${activeTab} players available to select.`);
      return;
    }
    const randomIndex = Math.floor(Math.random() * list.length);
    setConfirmSelectPlayer(list[randomIndex]);
  };

  const emitAction = useCallback((event: string, data?: Record<string, unknown>) => {
    if (!tournament) return;
    const socket = getSocket();
    socket.emit(event, { tournament_id: tournament.id, ...data });
  }, [tournament]);

  const handleBid = () => {
    if (!selectedTeam || !auctionState?.auction || !tournament) return;
    const bidIncrement = tournament.bid_increment || 1000;
    const isFirstBid = auctionState.auction.current_team_id === null;
    const newAmount = isFirstBid 
      ? (auctionState.auction.current_bid || 0) 
      : (auctionState.auction.current_bid || 0) + bidIncrement;
      
    // Calculate max bid
    const team = auctionState.teams?.find(t => t.id === selectedTeam);
    if (team) {
      const left = Math.max(0, team.max_players - team.player_count);
      const basePrice = tournament.default_base_price || 1000;
      const maxBid = left <= 1 ? team.remaining_budget : team.remaining_budget - (left - 1) * basePrice;
      if (newAmount > maxBid) {
        toast.error(`Bid ₹${newAmount.toLocaleString('en-IN')} exceeds maximum allowed bid (₹${Math.max(0, maxBid).toLocaleString('en-IN')}) for ${team.name} to complete squad.`);
        return;
      }
    }
    emitAction('auction:place_bid', { team_id: selectedTeam, amount: newAmount });
  };

  const handleCustomBid = () => {
    if (!selectedTeam || !auctionState?.auction || !tournament) {
      toast.error('Please select a team first.');
      return;
    }
    const amount = parseInt(customBid);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive bid amount.');
      return;
    }
    
    const basePrice = currentPlayer?.base_price || 0;
    const currentBid = auctionState.auction.current_bid || 0;
    const isFirstBid = auctionState.auction.current_team_id === null;
    
    const bidIncrement = tournament.bid_increment || 1000;
    
    if (isFirstBid) {
      if (amount < basePrice) {
        toast.error(`Custom bid cannot be less than the base price of ₹${basePrice.toLocaleString('en-IN')}`);
        return;
      }
      if ((amount - basePrice) % bidIncrement !== 0) {
        toast.error(`Custom bid must be in increments of ₹${bidIncrement.toLocaleString('en-IN')} relative to the base price.`);
        return;
      }
    } else {
      if (amount < currentBid + bidIncrement) {
        toast.error(`Custom bid must be at least ₹${(currentBid + bidIncrement).toLocaleString('en-IN')}`);
        return;
      }
      if ((amount - currentBid) % bidIncrement !== 0) {
        toast.error(`Custom bid must be in increments of ₹${bidIncrement.toLocaleString('en-IN')} relative to the current bid.`);
        return;
      }
    }
    
    const team = auctionState.teams?.find(t => t.id === selectedTeam);
    if (team) {
      const left = Math.max(0, team.max_players - team.player_count);
      const basePrice = tournament.default_base_price || 1000;
      const maxBid = left <= 1 ? team.remaining_budget : team.remaining_budget - (left - 1) * basePrice;
      if (amount > maxBid) {
        toast.error(`Custom bid ₹${amount.toLocaleString('en-IN')} exceeds maximum allowed bid (₹${Math.max(0, maxBid).toLocaleString('en-IN')}) for ${team.name} to complete squad.`);
        return;
      }
      if (amount > team.remaining_budget) {
        toast.error(`Selected team does not have enough budget (Remaining: ₹${team.remaining_budget.toLocaleString('en-IN')})`);
        return;
      }
    }
    
    emitAction('auction:place_bid', { team_id: selectedTeam, amount });
    setCustomBid('');
  };

  const auction = auctionState?.auction;
  const currentPlayer = auction?.current_player;
  const isLive = auction?.status === 'live';
  const isPaused = auction?.status === 'paused';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold flex items-center gap-2">
            <Radio className="w-6 h-6 text-gold" /> Auction Control
          </h1>
          <p className="text-muted-foreground text-sm">
            {tournament?.name || 'No tournament selected'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Viewer Count */}
          <div className="flex items-center gap-1.5 bg-navy-lighter/60 border border-gold/10 px-2.5 py-1 rounded-full text-[11px] font-semibold text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-white/90 font-medium">{viewerCount} Watching</span>
          </div>

          {tournament?.youtube_url && (
            <a
              href={tournament.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer animate-pulse"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              🔴 YouTube Live
            </a>
          )}
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 ${
              isLive ? 'border-red-500/30 text-red-400 animate-live-pulse' :
              isPaused ? 'border-yellow-500/30 text-yellow-400' :
              'border-muted text-muted-foreground'
            }`}
          >
            {auction?.status?.replace(/_/g, ' ').toUpperCase() || 'NOT STARTED'}
          </Badge>
        </div>
      </div>

      {/* Manager Controls */}
      {canControl && (
        <Card className="glass-card border-gold/10">
          <CardContent className="p-3 flex flex-wrap gap-2">
            {(!auction || auction.status === 'not_started') && (
              <Button onClick={() => emitAction('auction:start')} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-1" /> Start Auction
              </Button>
            )}
            {isLive && (
              <Button onClick={() => emitAction('auction:pause')} variant="outline" className="border-yellow-500/30 text-yellow-400">
                <Pause className="w-4 h-4 mr-1" /> Pause
              </Button>
            )}
            {isPaused && (
              <Button onClick={() => emitAction('auction:resume')} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-1" /> Resume
              </Button>
            )}
            {(isLive || isPaused) && (
              <Button onClick={() => emitAction('auction:end')} variant="outline" className="border-red-500/30 text-red-400">
                <Square className="w-4 h-4 mr-1" /> End Auction
              </Button>
            )}
            {auction?.status === 'ended' && (
              <>
                <Button onClick={() => emitAction('auction:reopen')} variant="outline" className="border-gold/30 text-gold">
                  <RotateCcw className="w-4 h-4 mr-1" /> Reopen
                </Button>
                <Button onClick={() => {
                  if (window.confirm("Are you sure you want to move all remaining available players to the Unsold list?")) {
                    emitAction('auction:move_available_to_unsold');
                  }
                }} variant="outline" className="border-red-500/30 text-red-400">
                  <X className="w-4 h-4 mr-1" /> Move Remaining to Unsold
                </Button>
              </>
            )}
            <Button onClick={() => emitAction('auction:undo_sale')} variant="outline" size="sm" className="ml-auto border-orange-500/30 text-orange-400">
              <Undo2 className="w-4 h-4 mr-1" /> Undo Last Sale
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current Player & Bidding */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Player Card */}
          <Card className={`glass-card border-0 ${currentPlayer ? 'glow-gold' : ''}`}>
            <CardContent className="p-6">
              {currentPlayer ? (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-navy-lighter overflow-hidden shrink-0 mx-auto md:mx-0">
                    {currentPlayer.photo ? (
                      <img
                        src={getImageUrl(currentPlayer.photo)}
                        alt={currentPlayer.name}
                        loading="lazy"
                        decoding="async"
                        width={160}
                        height={160}
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setEnlargedPhoto(getImageUrl(currentPlayer.photo))}
                        title="Click to enlarge"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-16 h-16 text-gold/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">{currentPlayer.name}</h2>
                    <p className="text-muted-foreground">{currentPlayer.village}</p>
                    <Badge variant="outline" className="mt-2 border-gold/20 text-gold">
                      {currentPlayer.playing_style || 'Player'}
                    </Badge>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Base Price</p>
                        <p className="text-lg font-bold text-foreground">₹{currentPlayer.base_price.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Bid</p>
                        <p className="text-2xl font-bold text-gold animate-bid-pop">
                          ₹{(auction?.current_bid || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    {auction?.current_team_name && (
                      <p className="text-sm text-green-400 mt-2">
                        🏏 <span className="font-bold">{auction.current_team_name}</span> bids <span className="font-semibold text-gold">₹{(auction?.current_bid || 0).toLocaleString('en-IN')}</span>!
                      </p>
                    )}
                  </div>
                  {/* Timer */}
                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center
                      ${timerValue <= 5 ? 'border-red-500 text-red-400' : 'border-gold/30 text-gold'}`}>
                      <span className="text-2xl font-bold">{timerValue}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">seconds</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gavel className="w-12 h-12 text-gold/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Select a player to start bidding</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bid Controls */}
          {isLive && currentPlayer && (
            <Card className="glass-card border-0">
              <CardContent className="p-4">
                {/* Team Selection */}
                <p className="text-sm text-muted-foreground mb-2">Select Team to Bid:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {auctionState?.teams?.map((team) => {
                    const left = Math.max(0, team.max_players - team.player_count);
                    const basePrice = tournament?.default_base_price || 1000;
                    const maxBid = left <= 1 ? team.remaining_budget : team.remaining_budget - (left - 1) * basePrice;
                    const displayMaxBid = Math.max(0, maxBid);
                    const bidIncrement = tournament?.bid_increment || 1000;
                    const isFirstBid = auction?.current_team_id === null;
                    const nextBidAmount = isFirstBid 
                      ? (auction?.current_bid || 0) 
                      : (auction?.current_bid || 0) + bidIncrement;
                    const isDisabled = displayMaxBid < nextBidAmount || team.player_count >= team.max_players;

                    return (
                      <Button
                        key={team.id}
                        variant={selectedTeam === team.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedTeam(team.id)}
                        className={selectedTeam === team.id ? 'bg-gold text-navy' : 'border-border text-foreground'}
                        disabled={isDisabled}
                      >
                        {team.name}
                        <span className="ml-1 text-xs opacity-70">
                          ₹{team.remaining_budget.toLocaleString('en-IN')} (Max: ₹{displayMaxBid.toLocaleString('en-IN')})
                        </span>
                      </Button>
                    );
                  })}
                </div>

                {/* Bid Buttons */}
                <div className="mb-4">
                  {(() => {
                    const bidIncrement = tournament?.bid_increment || 1000;
                    const isFirstBid = auction?.current_team_id === null;
                    const nextBidAmount = isFirstBid 
                      ? (auction?.current_bid || 0) 
                      : (auction?.current_bid || 0) + bidIncrement;
                    return (
                      <Button
                        onClick={handleBid}
                        disabled={!selectedTeam}
                        className="w-full bg-gold hover:bg-gold-dark text-navy font-bold text-base py-6 flex items-center justify-center gap-2 shadow-lg"
                      >
                        <ChevronUp className="w-5 h-5 shrink-0" />
                        {isFirstBid 
                          ? `Bid Base Price (₹${nextBidAmount.toLocaleString('en-IN')})`
                          : `Lift Bid (+₹${bidIncrement.toLocaleString('en-IN')} → ₹${nextBidAmount.toLocaleString('en-IN')})`
                        }
                      </Button>
                    );
                  })()}
                </div>

                {/* Custom Bid Section */}
                <div className="mb-4 bg-navy-light/10 border border-gold/10 p-3 rounded-lg flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground font-semibold">Or Enter Custom Bid Amount:</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={customBid}
                      onChange={(e) => setCustomBid(e.target.value)}
                      placeholder="Enter custom amount..."
                      className="bg-navy border-gold/20 text-foreground placeholder:text-muted-foreground h-9 focus-visible:ring-gold/50"
                    />
                    <Button
                      onClick={handleCustomBid}
                      disabled={!selectedTeam || !customBid}
                      className="bg-gold hover:bg-gold-dark text-navy font-bold text-xs px-4 h-9 shadow-md"
                    >
                      Place Bid
                    </Button>
                  </div>
                </div>

                <Separator className="my-3" />

                {/* Sell / Unsold Buttons */}
                {isManager && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => emitAction('auction:sell')}
                      disabled={!auction?.current_team_id}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" /> SOLD!
                    </Button>
                    <Button
                      onClick={() => emitAction('auction:mark_unsold')}
                      variant="outline"
                      className="flex-1 border-red-500/30 text-red-400"
                    >
                      <X className="w-4 h-4 mr-1" /> Unsold
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Player Selection */}
          {canControl && (isLive || isPaused) && !currentPlayer && (
            <Card className="glass-card border-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Select Next Player</CardTitle>
                  <Button 
                    size="sm"
                    onClick={handleSelectRandom}
                    className="bg-gold hover:bg-gold-dark text-navy text-xs font-semibold py-1 px-3 h-8"
                  >
                    Choose Random
                  </Button>
                </div>
                {/* Tabs */}
                <div className="flex gap-2 mt-3 bg-navy-lighter/30 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab('available')}
                    className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${
                      activeTab === 'available'
                        ? 'bg-gold text-navy shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Available ({availablePlayers.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('unsold')}
                    className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${
                      activeTab === 'unsold'
                        ? 'bg-gold text-navy shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Unsold ({unsoldPlayers.length})
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {(activeTab === 'available' ? availablePlayers : unsoldPlayers).map((player) => (
                      <button
                        key={player.id}
                        onClick={() => setConfirmSelectPlayer(player)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-navy-lighter/50 hover:bg-navy-lighter transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-navy-lighter flex items-center justify-center overflow-hidden shrink-0">
                          {player.photo ? (
                            <img src={getImageUrl(player.photo)} alt={player.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <UserCircle className="w-5 h-5 text-gold/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.village} • {player.playing_style}</p>
                        </div>
                        <span className="text-sm text-gold">₹{player.base_price.toLocaleString('en-IN')}</span>
                      </button>
                    ))}
                    {(activeTab === 'available' ? availablePlayers : unsoldPlayers).length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No {activeTab} players left
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Teams */}
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-gold" /> Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {auctionState?.teams?.map((team) => {
                const left = Math.max(0, team.max_players - team.player_count);
                const basePrice = tournament?.default_base_price || 1000;
                const maxBid = left <= 1 ? team.remaining_budget : team.remaining_budget - (left - 1) * basePrice;
                const displayMaxBid = Math.max(0, maxBid);
                return (
                  <div key={team.id} className="flex items-center justify-between p-2 rounded-lg bg-navy-lighter/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.player_count}/{team.max_players} players | Max Bid: ₹{displayMaxBid.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className="text-sm text-gold font-medium">₹{team.remaining_budget.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="w-4 h-4 text-gold" /> Auction Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-lg bg-navy-lighter/30">
                  <p className="text-lg font-bold text-foreground">{auctionState?.stats?.sold || 0}</p>
                  <p className="text-xs text-green-400">Sold</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-navy-lighter/30">
                  <p className="text-lg font-bold text-foreground">{auctionState?.stats?.unsold || 0}</p>
                  <p className="text-xs text-red-400">Unsold</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-navy-lighter/30">
                  <p className="text-lg font-bold text-foreground">{auctionState?.stats?.available || 0}</p>
                  <p className="text-xs text-gold">Available</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-navy-lighter/30">
                  <p className="text-lg font-bold text-foreground">{auctionState?.stats?.total || 0}</p>
                  <p className="text-xs text-blue-400">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold" /> Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {auctionState?.recent_sold?.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-navy-lighter/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.sold_team_name}</p>
                      </div>
                      <span className="text-sm text-green-400 font-bold shrink-0">₹{player.sold_price?.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {(!auctionState?.recent_sold || auctionState.recent_sold.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No sales yet</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Live Messages */}
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" /> Live Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                  {messages.map((msg, i) => (
                    <p key={i} className="text-xs text-muted-foreground py-1 border-b border-border/30">
                      {msg.message}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
      </div>
    </div>

      {/* Selection Confirmation Dialog */}
      <Dialog open={!!confirmSelectPlayer} onOpenChange={(o) => { if (!o) setConfirmSelectPlayer(null); }}>
        <DialogContent className="glass border-gold/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gradient-gold text-lg">Confirm Player Selection</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to bring <strong className="text-foreground text-base">{confirmSelectPlayer?.name}</strong> to the auction?
            </p>
            <p className="text-xs text-gold">Base Price: ₹{confirmSelectPlayer?.base_price.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmSelectPlayer(null)} className="border-border">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (confirmSelectPlayer) {
                  emitAction('auction:select_player', { player_id: confirmSelectPlayer.id });
                  setConfirmSelectPlayer(null);
                }
              }} 
              className="bg-gold hover:bg-gold-dark text-navy font-semibold"
            >
              Bring to Auction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Enlarge Dialog */}
      <Dialog open={!!enlargedPhoto} onOpenChange={(o) => { if (!o) setEnlargedPhoto(null); }}>
        <DialogContent className="glass border-gold/10 p-2 overflow-hidden max-w-[95vw] sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] w-fit bg-navy/95 flex items-center justify-center">
          {enlargedPhoto && (
            <img src={enlargedPhoto} alt="Player Photo" className="max-w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
