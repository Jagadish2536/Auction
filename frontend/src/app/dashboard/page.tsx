'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import api, { getImageUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Tournament, DashboardAnalytics, Player, Team } from '@/types';
import { Trophy, Users, UserCheck, UserX, TrendingUp, DollarSign, BarChart3, Target, UserCircle, ExternalLink } from 'lucide-react';

type ModalType = 'total' | 'sold' | 'unsold' | 'available' | 'teams' | null;

const DEFAULT_PLAYER_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><circle cx='50' cy='40' r='18' fill='%23d4a843' fill-opacity='0.8'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23d4a843' fill-opacity='0.8'/></svg>";
const DEFAULT_TEAM_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M35 30h30v20c0 10-8 18-15 18s-15-8-15-18V30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M45 68h10v12H45zM30 80h40v4H30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M28 35h7v10h-7zm37 0h7v10h-7z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const loadAnalytics = (tid: number) => {
    api.get(`/analytics/dashboard/${tid}`).then((r) => setAnalytics(r.data)).catch(() => {});
  };

  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        setActiveTournament(res.data.tournament);
        loadAnalytics(tid);
      }).catch(() => {});
    } else {
      api.get('/tournaments').then((res) => {
        const t = res.data.tournaments;
        if (t.length > 0) {
          setActiveTournament(t[0]);
          loadAnalytics(t[0].id);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!activeTournament) return;
    const socket = getSocket();

    const handleUpdate = () => {
      loadAnalytics(activeTournament.id);
      if (modalType === 'teams') {
        api.get(`/tournaments/${activeTournament.id}/teams`).then((r) => setTeams(r.data.teams || [])).catch(() => {});
      } else if (modalType) {
        api.get(`/tournaments/${activeTournament.id}/players`).then((r) => setAllPlayers(r.data.players || [])).catch(() => {});
      }
    };

    socket.on('player:change', handleUpdate);
    socket.on('team:change', handleUpdate);
    socket.on('tournament:change', handleUpdate);

    return () => {
      socket.off('player:change', handleUpdate);
      socket.off('team:change', handleUpdate);
      socket.off('tournament:change', handleUpdate);
    };
  }, [activeTournament, modalType]);

  const openModal = (type: ModalType) => {
    if (!activeTournament) return;
    const tid = activeTournament.id;

    if (type === 'teams') {
      api.get(`/tournaments/${tid}/teams`).then((r) => {
        setTeams(r.data.teams || []);
        setModalType(type);
      }).catch(() => {});
    } else {
      api.get(`/tournaments/${tid}/players`).then((r) => {
        setAllPlayers(r.data.players || []);
        setModalType(type);
      }).catch(() => {});
    }
  };

  const getFilteredPlayers = (): Player[] => {
    switch (modalType) {
      case 'total': return allPlayers;
      case 'sold': return allPlayers.filter(p => p.status === 'sold');
      case 'unsold': return allPlayers.filter(p => p.status === 'unsold');
      case 'available': return allPlayers.filter(p => p.status === 'available');
      default: return [];
    }
  };

  const getModalTitle = (): string => {
    switch (modalType) {
      case 'total': return 'All Players';
      case 'sold': return 'Sold Players';
      case 'unsold': return 'Unsold Players';
      case 'available': return 'Available Players';
      case 'teams': return 'All Teams';
      default: return '';
    }
  };

  const statusColors: Record<string, string> = {
    available: 'bg-blue-500/20 text-blue-400',
    sold: 'bg-green-500/20 text-green-400',
    unsold: 'bg-red-500/20 text-red-400',
  };

  const stats = analytics ? [
    { icon: Users, label: 'Total Players', value: analytics.total_players, color: 'text-blue-400', type: 'total' as ModalType },
    { icon: UserCheck, label: 'Sold', value: analytics.sold_players, color: 'text-green-400', type: 'sold' as ModalType },
    { icon: UserX, label: 'Unsold', value: analytics.unsold_players, color: 'text-red-400', type: 'unsold' as ModalType },
    { icon: Target, label: 'Available', value: analytics.available_players, color: 'text-gold', type: 'available' as ModalType },
    { icon: Trophy, label: 'Teams', value: analytics.total_teams, color: 'text-purple-400', type: 'teams' as ModalType },
    { icon: TrendingUp, label: 'Highest Bid', value: `₹${analytics.highest_bid.toLocaleString('en-IN')}`, color: 'text-gold', type: null },
    { icon: DollarSign, label: 'Total Spent', value: `₹${analytics.total_spent.toLocaleString('en-IN')}`, color: 'text-green-400', type: null },
    { icon: BarChart3, label: 'Completion', value: `${analytics.completion_percentage}%`, color: 'text-blue-400', type: null },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-gold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back! Here&apos;s your auction overview.
        </p>
      </div>

      {/* Active Tournament */}
      {activeTournament && (
        <Card className="glass-card border-gold/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Tournament</p>
              <h2 className="text-lg font-bold text-foreground">{activeTournament.name}</h2>
            </div>
            <Badge variant="outline" className="border-gold/20 text-gold capitalize">
              {activeTournament.status.replace(/_/g, ' ')}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {analytics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className={`glass-card border-0 transition-all duration-200 ${stat.type ? 'cursor-pointer hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
              onClick={() => stat.type && openModal(stat.type)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-navy-lighter flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTournament ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="glass-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Highest Sold Player */}
      {analytics?.highest_sold_player && (
        <Card className="glass-card border-gold/10">
          <CardHeader>
            <CardTitle className="text-sm text-gold">🏆 Highest Sold Player</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-navy-lighter flex items-center justify-center">
                <Trophy className="w-8 h-8 text-gold" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{analytics.highest_sold_player.name}</h3>
                <p className="text-muted-foreground">{analytics.highest_sold_player.village}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-green-400 font-bold text-lg">
                    ₹{analytics.highest_sold_player.sold_price?.toLocaleString('en-IN')}
                  </span>
                  <Badge variant="outline" className="border-gold/20 text-gold text-xs">
                    {analytics.highest_sold_player.sold_team_name}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Budgets */}
      {analytics?.remaining_budgets && analytics.remaining_budgets.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-sm text-foreground">Team Budgets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.remaining_budgets.map((team) => {
              const pct = team.budget > 0 ? ((team.budget - team.remaining) / team.budget) * 100 : 0;
              return (
                <div key={team.team}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{team.team}</span>
                    <span className="text-muted-foreground">₹{team.remaining.toLocaleString('en-IN')} left</span>
                  </div>
                  <div className="h-2 bg-navy-lighter rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!activeTournament && (
        <Card className="glass-card border-0">
          <CardContent className="p-12 text-center">
            <Trophy className="w-16 h-16 text-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Tournaments Yet</h3>
            <p className="text-muted-foreground">Create your first tournament to get started!</p>
          </CardContent>
        </Card>
      )}

      {/* Player Detail Modal */}
      <Dialog open={modalType !== null && modalType !== 'teams'} onOpenChange={(o) => { if (!o) setModalType(null); }}>
        <DialogContent className="glass border-gold/10 max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle className="text-gradient-gold flex items-center gap-2">
              {modalType === 'sold' && <UserCheck className="w-5 h-5 text-green-400" />}
              {modalType === 'unsold' && <UserX className="w-5 h-5 text-red-400" />}
              {modalType === 'available' && <Target className="w-5 h-5 text-gold" />}
              {modalType === 'total' && <Users className="w-5 h-5 text-blue-400" />}
              {getModalTitle()} ({getFilteredPlayers().length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {getFilteredPlayers().length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[650px]">
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Player</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Status</TableHead>
                      {(modalType === 'sold' || modalType === 'total') && <TableHead>Sold To</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredPlayers().map((p) => (
                      <TableRow key={p.id} className="border-border/20 hover:bg-navy-lighter/30">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-navy-lighter overflow-hidden shrink-0">
                              {p.photo ? (
                                <img
                                  src={getImageUrl(p.photo)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                                />
                              ) : (
                                <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground text-sm">{p.name}</span>
                                {p.crickheroes_url && <a href={p.crickheroes_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light"><ExternalLink className="w-3 h-3" /></a>}
                              </div>
                              {p.age && <span className="text-xs text-muted-foreground">Age: {p.age}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.village || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs border-gold/20 text-gold">{p.playing_style || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">₹{p.base_price.toLocaleString('en-IN')}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[p.status]}`}>{p.status}</Badge>
                        </TableCell>
                        {(modalType === 'sold' || modalType === 'total') && (
                          <TableCell className="text-sm">
                            {p.sold_team_name ? (
                              <div>
                                <span className="text-green-400 font-medium">{p.sold_team_name}</span>
                                <span className="text-muted-foreground ml-1.5">₹{p.sold_price?.toLocaleString('en-IN')}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-10 text-center">
                <UserCircle className="w-12 h-12 text-gold/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No players in this category</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Teams Detail Modal */}
      <Dialog open={modalType === 'teams'} onOpenChange={(o) => { if (!o) setModalType(null); }}>
        <DialogContent className="glass border-gold/10 max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle className="text-gradient-gold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              All Teams ({teams.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {teams.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[650px]">
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
                    {teams.map((t) => {
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
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
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
            ) : (
              <div className="p-10 text-center">
                <Trophy className="w-12 h-12 text-gold/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No teams created yet</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
