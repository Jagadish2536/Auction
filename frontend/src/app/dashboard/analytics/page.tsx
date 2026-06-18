'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import api, { getImageUrl } from '@/lib/api';
import { DashboardAnalytics, Tournament, Player, Team } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Trophy, DollarSign, Target, BarChart3, UserCheck, UserX, UserCircle, ExternalLink } from 'lucide-react';

const COLORS = ['#d4a843', '#22c55e', '#ef4444', '#3b82f6', '#a855f7', '#f59e0b'];

type ModalType = 'total' | 'sold' | 'unsold' | 'available' | 'teams' | null;

const DEFAULT_PLAYER_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><circle cx='50' cy='40' r='18' fill='%23d4a843' fill-opacity='0.8'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23d4a843' fill-opacity='0.8'/></svg>";
const DEFAULT_TEAM_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M35 30h30v20c0 10-8 18-15 18s-15-8-15-18V30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M45 68h10v12H45zM30 80h40v4H30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M28 35h7v10h-7zm37 0h7v10h-7z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [charts, setCharts] = useState<{ team_spending: { name: string; spent: number; remaining: number }[]; bid_distribution: { range: string; count: number }[]; players_by_style: { name: string; count: number }[] } | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        setTournament(res.data.tournament);
        api.get(`/analytics/dashboard/${tid}`).then((r) => setAnalytics(r.data)).catch(() => {});
        api.get(`/analytics/charts/${tid}`).then((r) => {
          const data = r.data;
          if (data?.players_by_style) {
            data.players_by_style = data.players_by_style.map((item: { style: string; count: number }) => ({
              name: item.style,
              count: item.count
            }));
          }
          setCharts(data);
        }).catch(() => {});
      }).catch(() => {});
    } else {
      api.get('/tournaments').then((r) => {
        const t = r.data.tournaments;
        if (t.length > 0) {
          setTournament(t[0]);
          api.get(`/analytics/dashboard/${t[0].id}`).then((res) => setAnalytics(res.data)).catch(() => {});
          api.get(`/analytics/charts/${t[0].id}`).then((res) => {
            const data = res.data;
            if (data?.players_by_style) {
              data.players_by_style = data.players_by_style.map((item: { style: string; count: number }) => ({
                name: item.style,
                count: item.count
              }));
            }
            setCharts(data);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  const openModal = (type: ModalType) => {
    if (!tournament) return;
    const tid = tournament.id;
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
    { icon: TrendingUp, label: 'Highest Bid', value: `₹${analytics.highest_bid.toLocaleString('en-IN')}`, color: 'text-gold', type: null },
    { icon: DollarSign, label: 'Avg Bid', value: `₹${analytics.average_bid.toLocaleString('en-IN')}`, color: 'text-green-400', type: null },
    { icon: Trophy, label: 'Teams', value: analytics.total_teams, color: 'text-purple-400', type: 'teams' as ModalType },
    { icon: BarChart3, label: 'Completion', value: `${analytics.completion_percentage}%`, color: 'text-blue-400', type: null },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gradient-gold">Analytics</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`glass-card border-0 transition-all duration-200 ${s.type ? 'cursor-pointer hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
            onClick={() => s.type && openModal(s.type)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-lighter flex items-center justify-center"><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold text-foreground">{s.value}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Spending Chart */}
        {charts?.team_spending && (
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="text-sm">Team Spending</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.team_spending}>
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#132240', border: '1px solid rgba(212,168,67,0.2)', borderRadius: '8px', color: '#e5e7eb' }} />
                  <Bar dataKey="spent" fill="#d4a843" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="remaining" fill="#1a2d52" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Bid Distribution */}
        {charts?.bid_distribution && (
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="text-sm">Bid Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.bid_distribution}>
                  <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#132240', border: '1px solid rgba(212,168,67,0.2)', borderRadius: '8px', color: '#e5e7eb' }} />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Players by Style */}
        {charts?.players_by_style && charts.players_by_style.length > 0 && (
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="text-sm">Players by Style</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={charts.players_by_style} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry: { name?: string; value?: number; payload?: { name?: string; count?: number } }) => `${entry.name || entry.payload?.name || ''}: ${entry.value || entry.payload?.count || 0}`}>
                    {charts.players_by_style.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#132240', border: '1px solid rgba(212,168,67,0.2)', borderRadius: '8px', color: '#e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Most Active Team */}
        {analytics?.most_active_team && (
          <Card className="glass-card border-gold/10">
            <CardHeader><CardTitle className="text-sm text-gold">🏆 Most Active Team</CardTitle></CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-foreground">{analytics.most_active_team.name}</h3>
              <p className="text-muted-foreground">{analytics.most_active_team.player_count} players bought</p>
              <p className="text-gold mt-2">₹{(analytics.most_active_team.budget - analytics.most_active_team.remaining_budget).toLocaleString('en-IN')} spent</p>
            </CardContent>
          </Card>
        )}
      </div>

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
