'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '@/lib/api';
import { User, Tournament } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, UserCircle, Users, Radio, Heart, BarChart3, FileText, Shield } from 'lucide-react';

const ToggleSwitch = ({ checked, onChange, label, icon: Icon }: { checked: boolean, onChange: (val: boolean) => void, label: string, icon?: any }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-navy-lighter/35 border border-gold/10 hover:border-gold/25 transition-all">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gold" />}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold/30 ${
          checked ? 'bg-gold' : 'bg-navy-light'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    tournament_id: '',
    perm_teams: true,
    perm_players: true,
    perm_auction: true,
    perm_sponsors: true,
    perm_analytics: true,
    perm_reports: true,
  });

  const load = () => api.get('/users').then((r) => setUsers(r.data.users)).catch(() => {});
  
  useEffect(() => {
    load();
    api.get('/tournaments').then((r) => setTournaments(r.data.tournaments || [])).catch(() => {});
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      tournament_id: '',
      perm_teams: true,
      perm_players: true,
      perm_auction: true,
      perm_sponsors: true,
      perm_analytics: true,
      perm_reports: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === 'admin' && !form.tournament_id) {
      toast.error('Please select an assigned tournament for the Admin');
      return;
    }
    try {
      const payload: any = {
        name: form.name,
        role: form.role,
        tournament_id: form.role === 'admin' && form.tournament_id ? Number(form.tournament_id) : null,
        perm_teams: form.role === 'admin' ? form.perm_teams : true,
        perm_players: form.role === 'admin' ? form.perm_players : true,
        perm_auction: form.role === 'admin' ? form.perm_auction : true,
        perm_sponsors: form.role === 'admin' ? form.perm_sponsors : true,
        perm_analytics: form.role === 'admin' ? form.perm_analytics : true,
        perm_reports: form.role === 'admin' ? form.perm_reports : true,
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success('User updated');
      } else {
        payload.email = form.email;
        payload.password = form.password;
        await api.post('/users', payload);
        toast.success('User created');
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed');
    }
  };

  const handleEdit = (u: User) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      tournament_id: u.tournament_id ? String(u.tournament_id) : '',
      perm_teams: u.perm_teams ?? true,
      perm_players: u.perm_players ?? true,
      perm_auction: u.perm_auction ?? true,
      perm_sponsors: u.perm_sponsors ?? true,
      perm_analytics: u.perm_analytics ?? true,
      perm_reports: u.perm_reports ?? true,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient-gold">User Management</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger render={<Button className="bg-gold hover:bg-gold-dark text-navy"><Plus className="w-4 h-4 mr-1" /> Add User</Button>} />
          <DialogContent className="glass border-gold/10 max-w-lg overflow-y-auto max-h-[90vh]">
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} User</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-navy-lighter/50" /></div>
              {!editing && <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="bg-navy-lighter/50" /></div>}
              <div><Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} className="bg-navy-lighter/50" /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v || '', tournament_id: v === 'manager' ? '' : form.tournament_id })}>
                  <SelectTrigger className="bg-navy-lighter/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass border-gold/10">
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === 'admin' && (
                <div>
                  <Label>Assigned Tournament *</Label>
                  <Select value={form.tournament_id} onValueChange={(v) => setForm({ ...form, tournament_id: v || '' })}>
                    <SelectTrigger className="bg-navy-lighter/50">
                      <SelectValue placeholder="Select Tournament">
                        {tournaments.find(t => String(t.id) === form.tournament_id)?.name || "Select Tournament"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="glass border-gold/10 animate-in fade-in-50 duration-200">
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.role === 'admin' && (
                <div className="space-y-3 pt-3 border-t border-gold/10">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gold">Feature Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleSwitch
                      label="Teams"
                      icon={Users}
                      checked={form.perm_teams}
                      onChange={(val) => setForm({ ...form, perm_teams: val })}
                    />
                    <ToggleSwitch
                      label="Players"
                      icon={UserCircle}
                      checked={form.perm_players}
                      onChange={(val) => setForm({ ...form, perm_players: val })}
                    />
                    <ToggleSwitch
                      label="Auction"
                      icon={Radio}
                      checked={form.perm_auction}
                      onChange={(val) => setForm({ ...form, perm_auction: val })}
                    />
                    <ToggleSwitch
                      label="Sponsors"
                      icon={Heart}
                      checked={form.perm_sponsors}
                      onChange={(val) => setForm({ ...form, perm_sponsors: val })}
                    />
                    <ToggleSwitch
                      label="Analytics"
                      icon={BarChart3}
                      checked={form.perm_analytics}
                      onChange={(val) => setForm({ ...form, perm_analytics: val })}
                    />
                    <ToggleSwitch
                      label="Reports"
                      icon={FileText}
                      checked={form.perm_reports}
                      onChange={(val) => setForm({ ...form, perm_reports: val })}
                    />
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold">{editing ? 'Update' : 'Create'} User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <Card key={u.id} className="glass-card border-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center"><UserCircle className="w-5 h-5 text-gold" /></div>
                  <div>
                    <h3 className="font-semibold text-foreground">{u.name}</h3>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-[10px] border-gold/20 text-gold capitalize">{u.role}</Badge>
                      {u.role === 'admin' && u.tournament_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          🏆 {u.tournament_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              
              {u.role === 'admin' && (
                <div className="mt-3 pt-3 border-t border-gold/10">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Permitted Features</p>
                  <div className="flex flex-wrap gap-1">
                    {u.perm_teams !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><Users className="w-2.5 h-2.5 text-gold" /> Teams</Badge>}
                    {u.perm_players !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><UserCircle className="w-2.5 h-2.5 text-gold" /> Players</Badge>}
                    {u.perm_auction !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><Radio className="w-2.5 h-2.5 text-gold" /> Auction</Badge>}
                    {u.perm_sponsors !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><Heart className="w-2.5 h-2.5 text-gold" /> Sponsors</Badge>}
                    {u.perm_analytics !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><BarChart3 className="w-2.5 h-2.5 text-gold" /> Analytics</Badge>}
                    {u.perm_reports !== false && <Badge variant="secondary" className="text-[9px] bg-navy-lighter/60 text-foreground border border-gold/5 flex items-center gap-1"><FileText className="w-2.5 h-2.5 text-gold" /> Reports</Badge>}
                    
                    {u.perm_teams === false && u.perm_players === false && u.perm_auction === false && u.perm_sponsors === false && u.perm_analytics === false && u.perm_reports === false && (
                      <span className="text-[10px] text-red-400 font-medium italic">No features enabled</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
