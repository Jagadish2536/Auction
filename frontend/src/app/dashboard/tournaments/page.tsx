'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Tournament } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Trophy, Calendar, MapPin, Loader2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  upcoming: 'bg-blue-500/20 text-blue-400',
  auction_live: 'bg-red-500/20 text-red-400',
  auction_paused: 'bg-yellow-500/20 text-yellow-400',
  auction_ended: 'bg-green-500/20 text-green-400',
  completed: 'bg-purple-500/20 text-purple-400',
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    venue: '',
    venue_address: '',
    start_date: '',
    end_date: '',
    auction_date: '',
    players_per_team: '15',
    bid_increment: '1000',
    team_budget: '1000000',
    default_base_price: '1000',
    youtube_url: ''
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => { api.get('/tournaments').then((r) => setTournaments(r.data.tournaments)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    const handleTournamentChange = () => {
      load();
    };
    socket.on('tournament:change', handleTournamentChange);
    return () => {
      socket.off('tournament:change', handleTournamentChange);
    };
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Tournament name is required');
      return;
    }

    // Client-side logo validation
    if (logo) {
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      const fileExt = logo.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExts.includes(fileExt)) {
        toast.error('Invalid logo format. Only JPG, JPEG, PNG, and WEBP images are supported.');
        return;
      }
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (logo.size > maxSize) {
        toast.error('Logo size too large. Please upload an image smaller than 10MB.');
        return;
      }
    }

    setSubmitting(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    if (logo) fd.append('logo', logo);
    try {
      if (editing) {
        await api.put(`/tournaments/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Tournament updated');
      } else {
        await api.post('/tournaments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Tournament created');
      }
      setOpen(false);
      setEditing(null);
      setForm({
        name: '',
        description: '',
        venue: '',
        venue_address: '',
        start_date: '',
        end_date: '',
        auction_date: '',
        players_per_team: '15',
        bid_increment: '1000',
        team_budget: '1000000',
        default_base_price: '1000',
        youtube_url: ''
      });
      setLogo(null);
      load();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to save tournament');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (t: Tournament) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || '',
      venue: t.venue || '',
      venue_address: t.venue_address || '',
      start_date: t.start_date || '',
      end_date: t.end_date || '',
      auction_date: t.auction_date?.slice(0, 16) || '',
      players_per_team: String(t.players_per_team ?? 15),
      bid_increment: String(t.bid_increment ?? 1000),
      team_budget: String(t.team_budget ?? 1000000),
      default_base_price: String(t.default_base_price ?? 1000),
      youtube_url: t.youtube_url || ''
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    const t = tournaments.find(x => x.id === id);
    const name = t?.name || 'this tournament';
    if (!confirm(`⚠️ DELETE "${name}"?\n\nThis will permanently delete:\n• All players (pending, available, sold, unsold)\n• All teams\n• All bid history\n• Auction state\n• Sponsors & advertisements\n\nThis action CANNOT be undone!`)) return;
    try { await api.delete(`/tournaments/${id}`); toast.success(`Tournament "${name}" deleted with all data`); load(); } catch { toast.error('Failed to delete tournament'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient-gold">Tournaments</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: '', description: '', venue: '', venue_address: '', start_date: '', end_date: '', auction_date: '', players_per_team: '15', bid_increment: '1000', team_budget: '1000000', default_base_price: '1000', youtube_url: '' }); } }}>
          <DialogTrigger render={<Button className="bg-gold hover:bg-gold-dark text-navy"><Plus className="w-4 h-4 mr-1" /> New Tournament</Button>} />
          <DialogContent className="glass border-gold/10 max-w-lg">
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Tournament</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-navy-lighter/50" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-navy-lighter/50" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Venue Name</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="bg-navy-lighter/50" /></div>
                <div><Label>Venue Address Details</Label><Input value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })} className="bg-navy-lighter/50" placeholder="Address details" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Players / Team</Label><Input type="number" value={form.players_per_team} onChange={(e) => setForm({ ...form, players_per_team: e.target.value })} className="bg-navy-lighter/50" /></div>
                <div><Label>Bid Increment (₹)</Label><Input type="number" value={form.bid_increment} onChange={(e) => setForm({ ...form, bid_increment: e.target.value })} className="bg-navy-lighter/50" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Team Budget (₹)</Label><Input type="number" value={form.team_budget} onChange={(e) => setForm({ ...form, team_budget: e.target.value })} className="bg-navy-lighter/50" /></div>
                <div><Label>Player Base Price (₹)</Label><Input type="number" value={form.default_base_price} onChange={(e) => setForm({ ...form, default_base_price: e.target.value })} className="bg-navy-lighter/50" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="bg-navy-lighter/50" /></div>
                <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="bg-navy-lighter/50" /></div>
              </div>
              <div><Label>Auction Date & Time</Label><Input type="datetime-local" value={form.auction_date} onChange={(e) => setForm({ ...form, auction_date: e.target.value })} className="bg-navy-lighter/50" /></div>
              <div><Label>YouTube Live URL</Label><Input type="url" placeholder="https://youtube.com/live/..." value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className="bg-navy-lighter/50" /></div>
              <div><Label>Logo</Label><Input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="bg-navy-lighter/50" /></div>
              <Button type="submit" disabled={submitting} className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {editing ? 'Updating' : 'Creating'} Tournament...
                  </>
                ) : (
                  `${editing ? 'Update' : 'Create'} Tournament`
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tournaments.map((t) => (
          <Card key={t.id} className="glass-card border-0 hover:glow-gold-sm transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-gold" />
                    <h3 className="text-lg font-bold text-foreground">{t.name}</h3>
                  </div>
                  <Badge variant="outline" className={`text-xs ${statusColors[t.status] || ''}`}>
                    {t.status.replace(/_/g, ' ')}
                  </Badge>
                  {(t.venue || t.venue_address) && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1">
                      <MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                      <span>
                        {t.venue}
                        {t.venue_address && <span className="block text-xs text-muted-foreground/80">{t.venue_address}</span>}
                      </span>
                    </p>
                  )}
                  {t.auction_date && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.auction_date).toLocaleDateString('en-IN')}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{t.team_count} teams</span>
                    <span>{t.player_count} players</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {tournaments.length === 0 && (
          <Card className="glass-card border-0 col-span-full"><CardContent className="p-12 text-center"><Trophy className="w-12 h-12 text-gold/30 mx-auto mb-3" /><p className="text-muted-foreground">No tournaments yet. Create your first one!</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}
