'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api, { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Heart, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';

const DEFAULT_SPONSOR_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><path d='M50 30c-5-5-15-5-20 0s-5 15 0 20l20 20 20-20c5-5 5-15 0-20s-15-5-20 0z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

interface Sponsor {
  id: number;
  tournament_id: number;
  name: string;
  logo: string | null;
  url: string | null;
  tier: string;
  description?: string | null;
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const getTournamentId = () => {
    return localStorage.getItem('selected_tournament_id');
  };

  const loadSponsors = useCallback(async () => {
    const tid = getTournamentId();
    if (!tid) return;
    setLoading(true);
    try {
      const res = await api.get(`/tournaments/${tid}/sponsors`);
      setSponsors(res.data.sponsors || []);
    } catch {
      toast.error('Failed to load sponsors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tid = getTournamentId();
    if (!tid) {
      toast.error('No tournament selected');
      return;
    }

    if (!name.trim()) {
      toast.error('Sponsor name is required');
      return;
    }

    // Client-side logo validation
    if (logoFile) {
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      const fileExt = logoFile.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExts.includes(fileExt)) {
        toast.error('Invalid logo format. Only JPG, JPEG, PNG, and WEBP images are supported.');
        return;
      }
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (logoFile.size > maxSize) {
        toast.error('Logo size too large. Please upload an image smaller than 10MB.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      if (editing) {
        await api.put(`/tournaments/${tid}/sponsors/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Sponsor updated successfully');
      } else {
        await api.post(`/tournaments/${tid}/sponsors`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Sponsor added successfully');
      }

      setOpen(false);
      resetForm();
      loadSponsors();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to save sponsor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s: Sponsor) => {
    setEditing(s);
    setName(s.name);
    setDescription(s.description || '');
    setLogoFile(null);
    setLogoPreview(s.logo ? getImageUrl(s.logo) : null);
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sponsor?')) return;
    const tid = getTournamentId();
    if (!tid) return;

    try {
      await api.delete(`/tournaments/${tid}/sponsors/${id}`);
      toast.success('Sponsor deleted successfully');
      loadSponsors();
    } catch {
      toast.error('Failed to delete sponsor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Sponsors</h1>
          <p className="text-sm text-muted-foreground">Manage and promote tournament sponsors.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger render={<Button className="bg-gold hover:bg-gold-dark text-navy font-semibold"><Plus className="w-4 h-4 mr-1" /> Add Sponsor</Button>} />
          <DialogContent className="glass border-gold/10 max-w-md animate-in fade-in zoom-in duration-200">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Add'} Sponsor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sponsor-name">Sponsor Name *</Label>
                <Input
                  id="sponsor-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lakshya Sports Academy"
                  required
                  className="bg-navy-lighter/50"
                />
              </div>

              <div>
                <Label htmlFor="sponsor-desc">Description / Details</Label>
                <textarea
                  id="sponsor-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe details about the sponsor..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-navy-lighter/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <Label>Sponsor Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-20 h-20 rounded-lg bg-navy-lighter/50 border border-gold/10 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Preview"
                        className="w-full h-full object-contain aspect-square"
                        style={{ objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_SPONSOR_LOGO; }}
                      />
                    ) : (
                      <img src={DEFAULT_SPONSOR_LOGO} alt="" className="w-full h-full object-contain aspect-square" style={{ objectFit: 'contain' }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center justify-center px-4 py-2 rounded-lg bg-navy-lighter hover:bg-navy-lighter/80 border border-gold/15 text-xs text-foreground transition-all">
                      Choose Image File
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Recommended: Square or horizontal transparent PNG</p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {editing ? 'Updating' : 'Creating'} Sponsor...
                  </>
                ) : (
                  `${editing ? 'Update' : 'Create'} Sponsor`
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="glass-card border-0 animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : sponsors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sponsors.map((s) => (
            <Card key={s.id} className="glass-card border border-gold/5 hover:border-gold/20 transition-all flex flex-col justify-between overflow-hidden group">
              <CardContent className="p-5 flex gap-4">
                <div className="w-16 h-16 rounded-xl bg-navy-lighter/50 border border-gold/10 flex items-center justify-center overflow-hidden shrink-0 p-1.5">
                  {s.logo ? (
                    <img
                      src={getImageUrl(s.logo)}
                      alt={s.name}
                      className="w-full h-full object-contain aspect-square"
                      style={{ objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_SPONSOR_LOGO; }}
                    />
                  ) : (
                    <img src={DEFAULT_SPONSOR_LOGO} alt="" className="w-full h-full object-contain aspect-square" style={{ objectFit: 'contain' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                    {s.description ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{s.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/40 mt-1 italic">No description</p>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end mt-4 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(s)} className="text-foreground/80 hover:text-gold">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(s.id)} className="text-red-400/80 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border border-dashed border-gold/10">
          <CardHeader className="text-center py-10">
            <Heart className="w-12 h-12 text-gold/20 mx-auto mb-3" />
            <CardTitle className="text-lg">No Sponsors Added</CardTitle>
            <CardDescription className="max-w-xs mx-auto">
              Add sponsors to this tournament to promote their logo and links on the tournament & live auction pages.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
