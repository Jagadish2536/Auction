'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import api from '@/lib/api';
import { Tournament } from '@/types';
import { toast } from 'sonner';
import { Download, FileText, FileSpreadsheet, File, Image, Loader2, Sparkles, Trophy } from 'lucide-react';

interface ReportPlayer {
  id: number;
  name: string;
  village: string | null;
  mobile: string | null;
  playing_style: string | null;
  age: number | null;
  base_price: number;
  status: string;
  sold_team_name: string | null;
  sold_price: number | null;
  sold_at: string | null;
}

interface ReportTeam {
  id: number;
  name: string;
  owner_name: string | null;
  captain_name: string | null;
  budget: number;
  remaining_budget: number;
  max_players: number;
  player_count: number;
  players?: ReportPlayer[];
}

export default function ReportsPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'teams' | 'auction'>('players');
  const [loadingData, setLoadingData] = useState(false);
  const [reportData, setReportData] = useState<{
    players?: ReportPlayer[];
    teams?: ReportTeam[];
    sold_players?: ReportPlayer[];
  }>({});

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        setTournament(res.data.tournament);
      }).catch(() => {});
    } else {
      api.get('/tournaments').then((r) => {
        const t = r.data.tournaments;
        if (t.length > 0) setTournament(t[0]);
      }).catch(() => {});
    }
  }, []);

  // Fetch JSON preview data whenever tournament or active tab changes
  useEffect(() => {
    if (!tournament) return;
    setLoadingData(true);
    api.get(`/reports/${activeTab}/${tournament.id}?format=json`)
      .then((res) => {
        setReportData(res.data);
        setLoadingData(false);
      })
      .catch(() => {
        toast.error('Failed to load preview data');
        setLoadingData(false);
      });
  }, [tournament, activeTab]);

  const handleDownload = async (format: string) => {
    if (!tournament) return;
    try {
      const res = await api.get(`/reports/${activeTab}/${tournament.id}?format=${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'excel' ? 'xlsx' : format;
      link.setAttribute('download', `${tournament.name}_${activeTab}_report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${activeTab.toUpperCase()} report downloaded in ${format.toUpperCase()}`);
    } catch { 
      toast.error('Download failed'); 
    }
  };

  const handleDownloadImage = async () => {
    if (!previewRef.current || !tournament) return;
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#0f172a', // slate-900 theme color background
        useCORS: true,
        scale: 2 // double scale for crisp text rendering
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${tournament.name}_${activeTab}_report.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report image downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export image');
    }
  };

  const handleDownloadSingleTeam = async (teamId: number, teamName: string, format: string) => {
    if (!tournament) return;
    try {
      const res = await api.get(`/reports/teams/${tournament.id}?format=${format}&team_id=${teamId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'excel' ? 'xlsx' : format;
      const teamSuffix = teamName.replace(/\s+/g, '_');
      link.setAttribute('download', `${tournament.name}_${teamSuffix}_report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${teamName} report downloaded in ${format.toUpperCase()}`);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDownloadSingleTeamImage = async (teamId: number, teamName: string) => {
    const cardElement = document.getElementById(`team-card-${teamId}`);
    if (!cardElement || !tournament) return;
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#0f172a',
        useCORS: true,
        scale: 2
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const teamSuffix = teamName.replace(/\s+/g, '_');
      link.download = `${tournament.name}_${teamSuffix}_report.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${teamName} image downloaded successfully!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export image');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Tournament Reports</h1>
          <p className="text-muted-foreground text-sm">
            Generate, preview, and download structured reports for {tournament?.name || 'your tournament'}.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleDownload('csv')} className="border-gold/20 text-gold hover:bg-gold/10 text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload('excel')} className="border-gold/20 text-gold hover:bg-gold/10 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload('pdf')} className="border-gold/20 text-gold hover:bg-gold/10 text-xs">
            <File className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
          <Button variant="default" size="sm" onClick={handleDownloadImage} className="bg-gold hover:bg-gold-dark text-navy font-semibold text-xs shadow-md glow-gold-sm">
            <Image className="w-3.5 h-3.5 mr-1" /> Download Image
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/20 pb-px">
        <button
          onClick={() => setActiveTab('players')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'players' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Players Report
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'teams' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Teams & Player Details
        </button>
        <button
          onClick={() => setActiveTab('auction')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'auction' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Auction Report
        </button>
      </div>

      {/* Interactive Report Preview Panel */}
      <Card className="glass border-gold/10 overflow-hidden">
        <CardHeader className="bg-navy-light/40 border-b border-border/20 flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            Live Preview: {activeTab === 'players' ? 'All Players List' : activeTab === 'teams' ? 'Teams & Purchased Players' : 'Sold Players Auction Report'}
          </CardTitle>
          {loadingData && <Loader2 className="w-4 h-4 text-gold animate-spin" />}
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] w-full">
            <div ref={previewRef} className="p-6 min-w-[800px]">
              {/* Image capture header (visible in PNG output) */}
              <div className="hidden block mb-6 text-center border-b border-gold/20 pb-4">
                <h2 className="text-2xl font-bold text-gold">{tournament?.name}</h2>
                <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
                  {activeTab === 'players' ? 'Players Report' : activeTab === 'teams' ? 'Teams & Player Details' : 'Auction Report'}
                </p>
              </div>

              {loadingData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-gold animate-spin" />
                  <p className="text-sm text-muted-foreground">Fetching report records...</p>
                </div>
              ) : (
                <>
                  {/* PLAYERS REPORT PREVIEW */}
                  {activeTab === 'players' && (
                    <Table>
                      <TableHeader className="bg-navy/60">
                        <TableRow className="border-border/20">
                          <TableHead className="text-gold">Name</TableHead>
                          <TableHead className="text-gold">Village</TableHead>
                          <TableHead className="text-gold">Mobile</TableHead>
                          <TableHead className="text-gold">Playing Style</TableHead>
                          <TableHead className="text-gold">Age</TableHead>
                          <TableHead className="text-gold">Base Price</TableHead>
                          <TableHead className="text-gold">Status</TableHead>
                          <TableHead className="text-gold">Sold Team</TableHead>
                          <TableHead className="text-gold">Sold Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.players && reportData.players.length > 0 ? (
                          reportData.players.map((p) => (
                            <TableRow key={p.id} className="border-border/10 hover:bg-navy-light/10">
                              <TableCell className="font-semibold text-foreground">{p.name}</TableCell>
                              <TableCell className="text-muted-foreground">{p.village || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{p.mobile || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{p.playing_style || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{p.age || '-'}</TableCell>
                              <TableCell className="text-foreground">₹{p.base_price.toLocaleString('en-IN')}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  p.status === 'sold' ? 'bg-green-500/20 text-green-400' :
                                  p.status === 'unsold' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {p.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-gold font-medium">{p.sold_team_name || '-'}</TableCell>
                              <TableCell className="text-green-400 font-semibold">{p.sold_price ? `₹${p.sold_price.toLocaleString('en-IN')}` : '-'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No players found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* TEAMS REPORT PREVIEW */}
                  {activeTab === 'teams' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {reportData.teams && reportData.teams.length > 0 ? (
                        reportData.teams.map((t) => {
                          const purchased = t.players?.length || 0;
                          const spent = t.budget - t.remaining_budget;
                          const left = Math.max(0, t.max_players - purchased);
                          const basePrice = tournament?.default_base_price || 1000;
                          const maxBid = left <= 1 ? t.remaining_budget : t.remaining_budget - (left - 1) * basePrice;
                          const highestPaid = t.players && t.players.length > 0
                            ? t.players.reduce((prev, current) => ((current.sold_price || 0) > (prev.sold_price || 0) ? current : prev), t.players[0])
                            : null;

                          return (
                            <div key={t.id} id={`team-card-${t.id}`} className="border border-border/20 rounded-xl overflow-hidden bg-navy/20 flex flex-col">
                              {/* Team Header */}
                              <div className="bg-navy px-3 py-2 flex items-center justify-between border-b border-border/20">
                                <span className="text-sm font-bold text-gold uppercase tracking-wider truncate mr-2">{t.name}</span>
                                <div className="flex items-center gap-1" data-html2canvas-ignore="true">
                                  <button
                                    onClick={() => handleDownloadSingleTeam(t.id, t.name, 'excel')}
                                    title="Download Excel"
                                    className="p-1 hover:bg-navy-light/40 rounded text-muted-foreground hover:text-gold transition-colors"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadSingleTeam(t.id, t.name, 'pdf')}
                                    title="Download PDF"
                                    className="p-1 hover:bg-navy-light/40 rounded text-muted-foreground hover:text-gold transition-colors"
                                  >
                                    <File className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadSingleTeamImage(t.id, t.name)}
                                    title="Download Image"
                                    className="p-1 hover:bg-navy-light/40 rounded text-muted-foreground hover:text-gold transition-colors"
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Stats Row */}
                              <div className="bg-navy-light/30 px-3 py-2 text-center text-xs text-muted-foreground border-b border-border/10 flex flex-col gap-0.5 font-medium">
                                <div>
                                  Spent: <span className="text-foreground font-semibold">₹{spent.toLocaleString('en-IN')}</span> | Rem: <span className="text-green-400 font-bold">₹{t.remaining_budget.toLocaleString('en-IN')}</span>
                                </div>
                                <div>
                                  Purchased: <span className="text-foreground font-semibold">{purchased}</span> | Left: <span className="text-foreground font-semibold">{left}</span>
                                </div>
                                <div>
                                  Max Bid: <span className="text-gold font-semibold">₹{Math.max(0, maxBid).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="truncate text-[11px] text-foreground mt-0.5">
                                  {highestPaid && highestPaid.sold_price ? (
                                    <>🏆 <span className="font-semibold">{highestPaid.name}</span> <span className="text-green-400 font-semibold">₹{highestPaid.sold_price.toLocaleString('en-IN')}</span></>
                                  ) : (
                                    <span>Highest: -</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Purchased Players Table */}
                              <div className="flex-1 overflow-auto">
                                <Table className="text-xs border-collapse">
                                  <TableHeader className="bg-navy-dark/40 border-b border-border/20">
                                    <TableRow className="border-border/10">
                                      <TableHead className="text-gold py-1 h-8 text-center border-r border-border/10">Player</TableHead>
                                      <TableHead className="text-gold py-1 h-8 text-center">Bid</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {t.players && t.players.length > 0 ? (
                                      t.players.map((p) => {
                                        const isHighest = highestPaid && p.id === highestPaid.id;
                                        return (
                                          <TableRow
                                            key={p.id}
                                            className={`border-b border-border/10 hover:bg-navy-light/10 ${
                                              isHighest ? 'bg-yellow-500/25 text-yellow-100 font-bold border-yellow-500/30' : ''
                                            }`}
                                          >
                                            <TableCell className="py-1.5 truncate max-w-[120px] text-center border-r border-border/10 font-medium">
                                              {p.name}
                                            </TableCell>
                                            <TableCell className={`py-1.5 text-center font-bold ${isHighest ? 'text-yellow-400' : 'text-green-400'}`}>
                                              ₹{(p.sold_price || 0).toLocaleString('en-IN')}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-[10px]">No players</TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-center py-20 text-muted-foreground">No teams found</div>
                      )}
                    </div>
                  )}

                  {/* AUCTION REPORT PREVIEW */}
                  {activeTab === 'auction' && (
                    <Table>
                      <TableHeader className="bg-navy/60">
                        <TableRow className="border-border/20">
                          <TableHead className="text-gold">Player Name</TableHead>
                          <TableHead className="text-gold">Village</TableHead>
                          <TableHead className="text-gold">Playing Style</TableHead>
                          <TableHead className="text-gold">Base Price</TableHead>
                          <TableHead className="text-gold">Sold Price</TableHead>
                          <TableHead className="text-gold">Sold Team</TableHead>
                          <TableHead className="text-gold">Sold At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.sold_players && reportData.sold_players.length > 0 ? (
                          reportData.sold_players.map((p) => (
                            <TableRow key={p.id} className="border-border/10 hover:bg-navy-light/10">
                              <TableCell className="font-semibold text-foreground">{p.name}</TableCell>
                              <TableCell className="text-muted-foreground">{p.village || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{p.playing_style || '-'}</TableCell>
                              <TableCell className="text-foreground">₹{p.base_price.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-green-400 font-bold">₹{(p.sold_price || 0).toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-gold font-medium">{p.sold_team_name}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {p.sold_at ? new Date(p.sold_at).toLocaleString('en-IN', {
                                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                                }) : '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No sold players yet</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
