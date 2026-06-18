'use client';

import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import api, { getImageUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Player, Tournament } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Upload, UserCircle, Search, ExternalLink, Link as LinkIcon, Copy, Check, RefreshCw } from 'lucide-react';

const DEFAULT_PLAYER_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><circle cx='50' cy='40' r='18' fill='%23d4a843' fill-opacity='0.8'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

const statusColors: Record<string, string> = {
  available: 'bg-blue-500/20 text-blue-400',
  sold: 'bg-green-500/20 text-green-400',
  unsold: 'bg-red-500/20 text-red-400',
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Memoized player row — won't re-render unless the player data changes
const PlayerRow = memo(function PlayerRow({
  p,
  onEdit,
  onDelete,
  onEnlarge,
}: {
  p: Player;
  onEdit: (p: Player) => void;
  onDelete: (id: number) => void;
  onEnlarge: (url: string) => void;
}) {
  return (
    <tr className="border-b border-border/20 hover:bg-navy-lighter/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-lighter overflow-hidden shrink-0">
            {p.photo ? (
              <img
                src={getImageUrl(p.photo)}
                alt={p.name}
                loading="lazy"
                decoding="async"
                width={36}
                height={36}
                className="w-full h-full object-cover aspect-square cursor-pointer hover:scale-105 transition-transform duration-300"
                style={{ objectFit: 'cover' }}
                onClick={() => onEnlarge(getImageUrl(p.photo))}
                title="Click to enlarge"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
              />
            ) : (
              <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover aspect-square" style={{ objectFit: 'cover' }} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-foreground text-sm">{p.name}</p>
              {p.crickheroes_url && (() => {
                const urlMatch = p.crickheroes_url.match(/https?:\/\/[^\s]+/);
                const cleanUrl = urlMatch ? urlMatch[0] : (p.crickheroes_url.startsWith('http') ? p.crickheroes_url : `https://${p.crickheroes_url}`);
                return (
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light" title="CricHeroes Profile" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground md:hidden">{p.village}</p>
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-4 py-2.5 text-sm text-muted-foreground">{p.village}</td>
      <td className="hidden md:table-cell px-4 py-2.5">
        <Badge variant="outline" className="text-xs border-gold/20 text-gold">{p.playing_style || '-'}</Badge>
      </td>
      <td className="px-4 py-2.5 text-sm">₹{p.base_price.toLocaleString('en-IN')}</td>
      <td className="px-4 py-2.5">
        <Badge className={`text-xs ${statusColors[p.status]}`}>{p.status}</Badge>
      </td>
      <td className="hidden md:table-cell px-4 py-2.5 text-sm">
        {p.sold_team_name && (
          <span className="text-green-400">{p.sold_team_name} — ₹{p.sold_price?.toLocaleString('en-IN')}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(p)}><Edit className="w-3 h-3" /></Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)} className="text-red-400"><Trash2 className="w-3 h-3" /></Button>
        </div>
      </td>
    </tr>
  );
});

// Virtual scroll window — renders only visible rows + buffer
const VIRTUAL_ROW_HEIGHT = 52;
const BUFFER_ROWS = 15;

function VirtualTable({ rows, onEdit, onDelete, onEnlarge }: {
  rows: Player[];
  onEdit: (p: Player) => void;
  onDelete: (id: number) => void;
  onEnlarge: (url: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setContainerHeight(el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / VIRTUAL_ROW_HEIGHT) + BUFFER_ROWS);
  const visibleRows = rows.slice(startIndex, endIndex);
  const totalHeight = rows.length * VIRTUAL_ROW_HEIGHT;
  const offsetY = startIndex * VIRTUAL_ROW_HEIGHT;

  return (
    <div ref={containerRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full min-w-[500px] text-sm">
        <thead className="sticky top-0 z-10 bg-navy-lighter/80 backdrop-blur-sm">
          <tr className="border-b border-border/30">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Player</th>
            <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Village</th>
            <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Style</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Base Price</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
            <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Sold To</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-[80px]">Actions</th>
          </tr>
        </thead>
        <tbody style={{ position: 'relative' }}>
          {/* Spacer for virtual scroll top */}
          {offsetY > 0 && <tr><td colSpan={7} style={{ height: offsetY, padding: 0 }} /></tr>}
          {visibleRows.map((p) => (
            <PlayerRow key={p.id} p={p} onEdit={onEdit} onDelete={onDelete} onEnlarge={onEnlarge} />
          ))}
          {/* Spacer for virtual scroll bottom */}
          {totalHeight - offsetY - visibleRows.length * VIRTUAL_ROW_HEIGHT > 0 && (
            <tr><td colSpan={7} style={{ height: totalHeight - offsetY - visibleRows.length * VIRTUAL_ROW_HEIGHT, padding: 0 }} /></tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-12 text-center">
          <UserCircle className="w-12 h-12 text-gold/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No players found</p>
        </div>
      )}
    </div>
  );
}

function PendingApprovalsTable({
  rows,
  onApprove,
  onReject,
  onEnlarge,
}: {
  rows: Player[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onEnlarge: (url: string) => void;
}) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full min-w-[750px] text-sm">
        <thead className="bg-navy-lighter/80 backdrop-blur-sm">
          <tr className="border-b border-border/30">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Player</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mobile</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Village</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Age</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Style</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">CricHeroes</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground w-[180px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/20 hover:bg-navy-lighter/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-navy-lighter overflow-hidden shrink-0 border border-gold/10">
                    {p.photo ? (
                      <img
                        src={getImageUrl(p.photo)}
                        alt={p.name}
                        className="w-full h-full object-cover aspect-square cursor-pointer hover:scale-105 transition-transform duration-300"
                        style={{ objectFit: 'cover' }}
                        onClick={() => onEnlarge(getImageUrl(p.photo))}
                        title="Click to enlarge"
                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_PHOTO; }}
                      />
                    ) : (
                      <img src={DEFAULT_PLAYER_PHOTO} alt="" className="w-full h-full object-cover aspect-square" style={{ objectFit: 'cover' }} />
                    )}
                  </div>
                  <span className="font-semibold text-foreground text-sm">{p.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-foreground">{p.mobile || '-'}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{p.village || '-'}</td>
              <td className="px-4 py-3 text-sm text-foreground">{p.age || '-'}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs border-gold/20 text-gold">{p.playing_style || '-'}</Badge>
              </td>
              <td className="px-4 py-3">
                {p.crickheroes_url ? (() => {
                  const urlMatch = p.crickheroes_url.match(/https?:\/\/[^\s]+/);
                  const cleanUrl = urlMatch ? urlMatch[0] : (p.crickheroes_url.startsWith('http') ? p.crickheroes_url : `https://${p.crickheroes_url}`);
                  return (
                    <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline text-xs">
                      Profile <ExternalLink className="w-3 h-3" />
                    </a>
                  );
                })()
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onApprove(p.id)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 px-3 rounded-lg flex items-center gap-1 shadow-md shadow-green-950/20"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject(p.id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold h-8 px-3 rounded-lg flex items-center gap-1 shadow-md shadow-red-950/20"
                  >
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="p-12 text-center">
                <UserCircle className="w-12 h-12 text-gold/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No pending players to approve</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [form, setForm] = useState({ name: '', village: '', mobile: '', playing_style: '', age: '', crickheroes_url: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const regUrl = typeof window !== 'undefined' ? `${window.location.origin}/register${tournament?.registration_code ? `?code=${tournament.registration_code}` : ''}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(regUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRegistration = async () => {
    if (!tournament) return;
    const newStatus = !tournament.registration_open;
    try {
      const res = await api.put(`/tournaments/${tournament.id}`, { registration_open: newStatus });
      setTournament(res.data.tournament);
      toast.success(newStatus ? 'Registration Link Activated!' : 'Registration Link Expired!');
    } catch {
      toast.error('Failed to update registration status');
    }
  };

  const [pendingPlayers, setPendingPlayers] = useState<Player[]>([]);

  const loadPlayers = useCallback((tid: number) => {
    api.get(`/tournaments/${tid}/players`).then((r) => {
      setPlayers(r.data.players);
      setLoading(false);
    }).catch(() => setLoading(false));

    api.get(`/tournaments/${tid}/players?status=pending`).then((r) => {
      setPendingPlayers(r.data.players || []);
    }).catch(() => {});
  }, []);

  const handleApprove = async (id: number) => {
    if (!tournament) return;
    try {
      await api.put(`/tournaments/${tournament.id}/players/${id}`, { status: 'available' });
      toast.success('Player approved successfully');
      loadPlayers(tournament.id);
    } catch {
      toast.error('Failed to approve player');
    }
  };

  const handleReject = async (id: number) => {
    if (!tournament || !confirm('Reject and delete this registration?')) return;
    try {
      await api.delete(`/tournaments/${tournament.id}/players/${id}`);
      toast.success('Registration rejected');
      loadPlayers(tournament.id);
    } catch {
      toast.error('Failed to reject registration');
    }
  };



  useEffect(() => {
    const selectedId = localStorage.getItem('selected_tournament_id');
    if (selectedId) {
      const tid = Number(selectedId);
      api.get(`/tournaments/${tid}`).then((res) => {
        setTournament(res.data.tournament);
        loadPlayers(tid);
      }).catch(() => setLoading(false));
    } else {
      api.get('/tournaments').then((r) => {
        const t = r.data.tournaments;
        if (t.length > 0) {
          setTournament(t[0]);
          loadPlayers(t[0].id);
        } else {
          setLoading(false);
        }
      }).catch(() => setLoading(false));
    }
  }, [loadPlayers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    // Validate all required fields
    if (!form.name.trim()) { toast.error('Player Name is required'); return; }
    if (!form.village.trim()) { toast.error('Village is required'); return; }
    if (!form.mobile.trim()) { toast.error('Mobile number is required'); return; }
    if (!form.playing_style) { toast.error('Playing Style is required'); return; }
    if (!form.age) { toast.error('Age is required'); return; }
    if (!editing && !photo) { toast.error('Photo is required'); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    if (photo) fd.append('photo', photo);
    try {
      if (editing) {
        await api.put(`/tournaments/${tournament.id}/players/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Player updated');
      } else {
        await api.post(`/tournaments/${tournament.id}/players`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Player added');
      }
      setOpen(false);
      setEditing(null);
      setForm({ name: '', village: '', mobile: '', playing_style: '', age: '', crickheroes_url: '' });
      setPhoto(null);
      loadPlayers(tournament.id);
    } catch { toast.error('Failed'); }
  };

  const handleImport = async () => {
    if (!tournament || !importFile) return;
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const res = await api.post(`/tournaments/${tournament.id}/players/bulk-import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message);
      setImportOpen(false); setImportFile(null);
      loadPlayers(tournament.id);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Import failed');
    }
  };

  const handleEdit = useCallback((p: Player) => {
    setEditing(p);
    setForm({ name: p.name, village: p.village || '', mobile: p.mobile || '', playing_style: p.playing_style || '', age: p.age ? String(p.age) : '', crickheroes_url: p.crickheroes_url || '' });
    setOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!tournament || !confirm('Delete?')) return;
    try { await api.delete(`/tournaments/${tournament.id}/players/${id}`); toast.success('Deleted'); loadPlayers(tournament.id); } catch { toast.error('Failed'); }
  }, [tournament, loadPlayers]);

  // Memoized filter — only recomputes when players, pendingPlayers, filter, or debouncedSearch change
  const filtered = useMemo(() => {
    const activeList = filter === 'pending' ? pendingPlayers : players;
    return activeList.filter((p) => {
      if (filter !== 'pending' && filter !== 'all' && p.status !== filter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesVillage = p.village?.toLowerCase().includes(q);
        const matchesMobile = p.mobile?.toLowerCase().includes(q);
        const matchesStyle = p.playing_style?.toLowerCase().includes(q);
        if (!matchesName && !matchesVillage && !matchesMobile && !matchesStyle) {
          return false;
        }
      }
      return true;
    });
  }, [players, pendingPlayers, filter, debouncedSearch]);

  const counts = useMemo(() => ({
    available: players.filter(p => p.status === 'available').length,
    sold: players.filter(p => p.status === 'sold').length,
    unsold: players.filter(p => p.status === 'unsold').length,
  }), [players]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Players</h1>
          {!loading && <p className="text-xs text-muted-foreground mt-0.5">{players.length} total players</p>}
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger render={<Button variant="outline" className="flex-1 md:flex-initial border-gold/30 text-gold"><Upload className="w-4 h-4 mr-1" /> Import</Button>} />
              <DialogContent className="glass border-gold/10">
                <DialogHeader><DialogTitle>Bulk Import Players</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Upload a CSV or Excel file with columns: name, village, mobile, playing_style, age, base_price</p>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="bg-navy-lighter/50" />
                  <Button onClick={handleImport} disabled={!importFile} className="w-full bg-gold hover:bg-gold-dark text-navy">Import Players</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={regOpen} onOpenChange={setRegOpen}>
              <DialogTrigger render={<Button variant="outline" className="flex-1 md:flex-initial border-gold/30 text-gold"><LinkIcon className="w-4 h-4 mr-1" /> Registration Link</Button>} />
              <DialogContent className="glass border-gold/10 max-w-md">
                <DialogHeader><DialogTitle className="text-gradient-gold">Player Registration Link</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-navy-lighter/30 border border-gold/10">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">Link Status</h3>
                      <p className="text-xs text-muted-foreground">
                        {tournament?.registration_open ? 'Active - Players can self-register' : 'Inactive - Link is expired/disabled'}
                      </p>
                    </div>
                    <Button onClick={toggleRegistration} variant={tournament?.registration_open ? "destructive" : "default"}
                      className={tournament?.registration_open ? "" : "bg-gold hover:bg-gold-dark text-navy"} size="sm">
                      {tournament?.registration_open ? 'Expire / End Link' : 'Activate / Start Link'}
                    </Button>
                  </div>
                  {tournament?.registration_open && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Share this URL with players:</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={regUrl} className="bg-navy-lighter/50 text-xs text-muted-foreground select-all" />
                        <Button size="sm" onClick={copyToClipboard} className="bg-gold hover:bg-gold-dark text-navy px-3">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={() => {
                if (tournament) {
                  loadPlayers(tournament.id);
                  toast.success('Data refreshed');
                }
              }}
              className="flex-1 md:flex-initial border-gold/30 text-gold hover:bg-gold/10"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
            </Button>
          </div>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: '', village: '', mobile: '', playing_style: '', age: '', crickheroes_url: '' }); } }}>
            <DialogTrigger render={<Button className="w-full md:w-auto bg-gold hover:bg-gold-dark text-navy"><Plus className="w-4 h-4 mr-1" /> Add Player</Button>} />
            <DialogContent className="glass border-gold/10">
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Player</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-navy-lighter/50" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Village *</Label><Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} required className="bg-navy-lighter/50" /></div>
                  <div><Label>Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required className="bg-navy-lighter/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Playing Style *</Label>
                    <Select value={form.playing_style} onValueChange={(v) => setForm({ ...form, playing_style: v || '' })}>
                      <SelectTrigger className={`bg-navy-lighter/50 ${!form.playing_style ? 'text-muted-foreground' : ''}`}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="glass border-gold/10">
                        <SelectItem value="Batsman">Batsman</SelectItem>
                        <SelectItem value="Bowler">Bowler</SelectItem>
                        <SelectItem value="All-Rounder">All-Rounder</SelectItem>
                        <SelectItem value="Wicket-Keeper">Wicket-Keeper</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Age *</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required min="5" max="100" className="bg-navy-lighter/50" /></div>
                </div>
                <div><Label>CricHeroes Profile URL</Label><Input value={form.crickheroes_url} onChange={(e) => setForm({ ...form, crickheroes_url: e.target.value })} placeholder="https://cricheroes.com/..." className="bg-navy-lighter/50" /></div>
                <div><Label>Photo {!editing ? '*' : ''}</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="bg-navy-lighter/50" />{editing && <p className="text-xs text-muted-foreground mt-1">Leave empty to keep current photo</p>}</div>
                <Button type="submit" className="w-full bg-gold hover:bg-gold-dark text-navy">{editing ? 'Update' : 'Add'} Player</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-navy-lighter/50"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { key: 'all', label: `All (${players.length})` },
            { key: 'available', label: `Available (${counts.available})` },
            { key: 'sold', label: `Sold (${counts.sold})` },
            { key: 'unsold', label: `Unsold (${counts.unsold})` },
            { key: 'pending', label: `Pending (${pendingPlayers.length})` },
          ].map((s) => (
            <Button key={s.key} variant={filter === s.key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s.key)}
              className={filter === s.key ? 'bg-gold text-navy font-bold' : 'border-border'}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Players Table with Virtual Scrolling */}
      <Card className="glass-card border-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filter === 'pending' ? (
          <PendingApprovalsTable rows={filtered} onApprove={handleApprove} onReject={handleReject} onEnlarge={setEnlargedPhoto} />
        ) : (
          <VirtualTable rows={filtered} onEdit={handleEdit} onDelete={handleDelete} onEnlarge={setEnlargedPhoto} />
        )}
      </Card>

      {/* Photo Enlarge Dialog */}
      <Dialog open={!!enlargedPhoto} onOpenChange={(o) => { if (!o) setEnlargedPhoto(null); }}>
        <DialogContent className="glass border-gold/10 p-1 overflow-hidden max-w-[95vw] max-h-[95vh] bg-navy/95 flex items-center justify-center [&>button]:text-white [&>button]:bg-navy/80 [&>button]:rounded-full [&>button]:p-1">
          {enlargedPhoto && (
            <img src={enlargedPhoto} alt="Player Photo" className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
