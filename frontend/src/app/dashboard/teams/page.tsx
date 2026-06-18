'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api, { getImageUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Team, Tournament } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, DollarSign } from 'lucide-react';

const DEFAULT_TEAM_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M35 30h30v20c0 10-8 18-15 18s-15-8-15-18V30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M45 68h10v12H45zM30 80h40v4H30z' fill='%23d4a843' fill-opacity='0.8'/><path d='M28 35h7v10h-7zm37 0h7v10h-7z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', owner_name: '', captain_name: '', budget: '1000000', max_players: '15' });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const loadTeams = useCallback((tid: number) => api.get(`/tournaments/${tid}/teams`).then((r) => setTeams(r.data.teams)).catch(() => {}), []);

  useEffect(() => {
    const socket = getSocket();
    const handleTeamChange = (data: { action: string; tournament_id?: number }) => {
      if (tournament && data.tournament_id === tournament.id) {
        loadTeams(tournament.id);
      }
    };
    const handlePlayerChange = (data: { action: string; tournament_id?: number }) => {
      if (tournament && data.tournament_id === tournament.id) {
        loadTeams(tournament.id);
      }
    };
    socket.on('team:change', handleTeamChange);
    socket.on('player:change', handlePlayerChange);
    return () => {
      socket.off('team:change', handleTeamChange);
      socket.off('player:change', handlePlayerChange);
    };
  }, [tournament, loadTeams]);

  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        const activeTournament = res.data.tournament;
        setTournament(activeTournament);
        loadTeams(tid);
        setForm(prev => ({
          ...prev,
          budget: String(activeTournament.team_budget ?? '1000000'),
          max_players: String(activeTournament.players_per_team ?? '15')
        }));
      }).catch(() => {});
    } else {
      api.get('/tournaments').then((r) => {
        const t = r.data.tournaments;
        if (t.length > 0) {
          const activeTournament = t[0];
          setTournament(activeTournament);
          loadTeams(activeTournament.id);
          setForm(prev => ({
            ...prev,
            budget: String(activeTournament.team_budget ?? '1000000'),
            max_players: String(activeTournament.players_per_team ?? '15')
          }));
        }
      }).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('owner_name', form.owner_name);
    formData.append('captain_name', form.captain_name);
    formData.append('budget', form.budget);
    formData.append('max_players', form.max_players);
    if (logoFile) {
      formData.append('logo', logoFile);
    }

    try {
      if (editing) {
        await api.put(`/tournaments/${tournament.id}/teams/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Team updated');
      } else {
        await api.post(`/tournaments/${tournament.id}/teams`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Team created');
      }
      setOpen(false);
      setEditing(null);
      setLogoFile(null);
      setForm({
        name: '',
        owner_name: '',
        captain_name: '',
        budget: String(tournament?.team_budget ?? '1000000'),
        max_players: String(tournament?.players_per_team ?? '15')
      });
      loadTeams(tournament.id);
    } catch { toast.error('Failed'); }
  };

  const handleEdit = (t: Team) => {
    setEditing(t);
    setForm({ name: t.name, owner_name: t.owner_name || '', captain_name: t.captain_name || '', budget: String(t.budget), max_players: String(t.max_players) });
    setLogoFile(null);
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!tournament || !confirm('Delete this team?')) return;
    try { await api.delete(`/tournaments/${tournament.id}/teams/${id}`); toast.success('Deleted'); loadTeams(tournament.id); } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gradient-gold">Teams</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setLogoFile(null); setForm({ name: '', owner_name: '', captain_name: '', budget: String(tournament?.team_budget ?? '1000000'), max_players: String(tournament?.players_per_team ?? '15') }); } }}>
          <DialogTrigger render={<Button className="bg-gold hover:bg-gold-dark text-navy"><Plus className="w-4 h-4 mr-1" /> Add Team</Button>} />
          <DialogContent className="glass border-gold/10">
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Team</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Team Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-navy-lighter/50" /></div>
              <div><Label>Owner Name</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="bg-navy-lighter/50" /></div>
              <div><Label>Captain Name</Label><Input value={form.captain_name} onChange={(e) => setForm({ ...form, captain_name: e.target.value })} className="bg-navy-lighter/50" /></div>
              <div>
                <Label>Team Logo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="bg-navy-lighter/50 cursor-pointer"
                />
              </div>
              <Button type="submit" className="w-full bg-gold hover:bg-gold-dark text-navy">{editing ? 'Update' : 'Add'} Team</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => {
          const spent = t.budget - t.remaining_budget;
          const pct = t.budget > 0 ? (spent / t.budget) * 100 : 0;
          return (
            <Card key={t.id} className="glass-card border-0 hover:glow-gold-sm transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-navy-lighter flex items-center justify-center overflow-hidden shrink-0 border border-gold/10 shadow-inner">
                      {t.logo ? (
                        <img
                          src={getImageUrl(t.logo)}
                          alt=""
                          className="w-full h-full object-contain aspect-square"
                          style={{ objectFit: 'contain' }}
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_TEAM_LOGO; }}
                        />
                      ) : (
                        <img src={DEFAULT_TEAM_LOGO} alt="" className="w-full h-full object-contain aspect-square" style={{ objectFit: 'contain' }} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground leading-tight">{t.name}</h3>
                      {t.captain_name && <p className="text-xs text-gold mt-0.5">Capt: {t.captain_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {t.owner_name && <p className="text-sm text-muted-foreground">Owner: {t.owner_name}</p>}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1 text-sm"><Users className="w-4 h-4 text-gold" />{t.player_count}/{t.max_players}</div>
                  <div className="flex items-center gap-1 text-sm"><DollarSign className="w-4 h-4 text-green-400" />₹{t.remaining_budget.toLocaleString('en-IN')}</div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-navy-lighter rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">₹{spent.toLocaleString('en-IN')} / ₹{t.budget.toLocaleString('en-IN')} spent</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {teams.length === 0 && (
          <Card className="glass-card border-0 col-span-full"><CardContent className="p-12 text-center"><Users className="w-12 h-12 text-gold/30 mx-auto mb-3" /><p className="text-muted-foreground">No teams yet</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}
