'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getImageUrl } from '@/lib/api';
import { Trophy, CheckCircle, Loader2, ArrowLeft, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Tournament } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';

function RegisterFormContent() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [form, setForm] = useState({
    name: '',
    village: '',
    mobile: '',
    playing_style: '',
    age: '',
    crickheroes_url: ''
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code') || '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiBase}/api/public/registration-tournament${code ? `?code=${code}` : ''}`)
      .then((res) => {
        if (!res.ok) throw new Error('Tournament not found');
        return res.json();
      })
      .then((data) => {
        setTournament(data.tournament);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    if (!photo) {
      toast.error('Profile photo is required');
      return;
    }

    // Client-side photo validation
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const fileExt = photo.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExts.includes(fileExt)) {
      toast.error('Invalid photo format. Only JPG, JPEG, PNG, and WEBP images are supported.');
      return;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (photo.size > maxSize) {
      toast.error('Photo size too large. Please upload an image smaller than 10MB.');
      return;
    }

    if (!form.name.trim()) {
      toast.error('Player name is required');
      return;
    }
    const mobileVal = form.mobile.trim();
    if (!mobileVal) {
      toast.error('Mobile number is required');
      return;
    }
    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(mobileVal)) {
      toast.error('Mobile number must be exactly 10 digits');
      return;
    }
    if (!form.village.trim()) {
      toast.error('Village / City is required');
      return;
    }
    if (!form.age.trim()) {
      toast.error('Age is required');
      return;
    }
    if (!form.playing_style) {
      toast.error('Playing style is required');
      return;
    }
    if (!form.crickheroes_url.trim()) {
      toast.error('CricHeroes profile URL is required');
      return;
    }

    setShowConfirmDialog(true);
  };

  const submitRegistration = async () => {
    if (!tournament) return;
    setSubmitting(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v) fd.append(k, v);
    });
    if (photo) fd.append('photo', photo);

    try {
      const res = await fetch(`${apiBase}/api/public/tournament/${tournament.id}/register-player`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }
      setSuccess(true);
      toast.success('Registration successful! Waiting for approval.');
      setShowConfirmDialog(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!tournament || !tournament.registration_open) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,168,67,0.05),transparent_60%)]" />
        <div className="w-full max-w-md text-center relative z-10 space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Registration Link Expired</h1>
            <p className="text-muted-foreground text-sm">
              This player registration link is no longer valid or has been closed by the tournament administrator.
            </p>
          </div>
          <Link href="/">
            <Button className="mt-4 bg-gold hover:bg-gold-dark text-navy font-bold">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,168,67,0.08),transparent_60%)]" />
        <div className="w-full max-w-md text-center relative z-10 space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gradient-gold">Registration Successful!</h1>
            <p className="text-muted-foreground text-sm">
              Your details have been successfully submitted for <strong className="text-foreground">{tournament.name}</strong>. You are now entered into the player pool.
            </p>
          </div>
          <div className="pt-4">
            <Link href={`/?tournament_id=${tournament.id}`}>
              <Button className="bg-gold hover:bg-gold-dark text-navy font-bold px-8">
                View Tournament Board
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,168,67,0.05),transparent_60%)]" />

      <div className="w-full max-w-xl relative z-10 space-y-6">
        <div className="text-center space-y-4">
          {tournament.logo ? (
            <img
              src={getImageUrl(tournament.logo)}
              alt={tournament.name}
              className="w-20 h-20 mx-auto rounded-2xl object-cover glow-gold-sm border border-gold/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8 text-gold" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gradient-gold">{tournament.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">Player Registration Portal</p>
          </div>
        </div>

        <Card className="glass border-gold/10">
          <CardHeader>
            <CardTitle className="text-xl text-center text-foreground">Submit Player Profile</CardTitle>
            <CardDescription className="text-center text-xs text-muted-foreground">
              Please enter your match history and contact details. This info will be visible to team owners during the live auction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Photo Upload Container */}
              <div className="flex flex-col items-center gap-2">
                <Label className="text-sm font-semibold text-foreground">Profile Image *</Label>
                <div className="relative group cursor-pointer w-24 h-24 rounded-full bg-navy-lighter/50 border-2 border-dashed border-gold/20 hover:border-gold/40 flex items-center justify-center overflow-hidden transition-all">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gold/30" />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
                <span className="text-xs text-muted-foreground">Click to upload photo</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      required
                      placeholder="Enter your name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-navy-lighter/50 border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      required
                      placeholder="10-digit mobile no"
                      value={form.mobile}
                      onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                      className="bg-navy-lighter/50 border-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="village">Village / City *</Label>
                    <Input
                      id="village"
                      required
                      placeholder="e.g. Rampur"
                      value={form.village}
                      onChange={(e) => setForm({ ...form, village: e.target.value })}
                      className="bg-navy-lighter/50 border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      required
                      placeholder="e.g. 24"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      className="bg-navy-lighter/50 border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playing_style">Playing Style *</Label>
                  <Select value={form.playing_style} onValueChange={(v) => setForm({ ...form, playing_style: v || '' })}>
                    <SelectTrigger className="bg-navy-lighter/50 border-border" id="playing_style">
                      <SelectValue placeholder="Select playing style" />
                    </SelectTrigger>
                    <SelectContent className="glass border-gold/10">
                      <SelectItem value="Batsman">Batsman</SelectItem>
                      <SelectItem value="Bowler">Bowler</SelectItem>
                      <SelectItem value="All-Rounder">All-Rounder</SelectItem>
                      <SelectItem value="Wicket-Keeper">Wicket-Keeper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crickheroes_url">CricHeroes Profile URL *</Label>
                  <Input
                    id="crickheroes_url"
                    required
                    placeholder="https://cricheroes.in/player/..."
                    value={form.crickheroes_url}
                    onChange={(e) => setForm({ ...form, crickheroes_url: e.target.value })}
                    className="bg-navy-lighter/50 border-border"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gold hover:bg-gold-dark text-navy font-bold h-11"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    'Register for Tournament'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 text-gold/70 hover:text-gold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Tournaments
          </Link>
        </p>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="glass border-gold/10 text-white max-w-md w-[95%] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gold flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Verify Your Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-300">
              Please double check your registration details. They cannot be changed after submission.
            </p>
            
            <div className="flex flex-col items-center justify-center py-2">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gold/50 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-navy-lighter flex items-center justify-center border-2 border-dashed border-gray-600">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <span className="text-xs text-gray-400 mt-1">Profile Photo</span>
            </div>

            <div className="space-y-2 text-sm bg-navy/60 p-3 rounded-lg border border-gold/5">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Full Name</span>
                <span className="font-semibold text-white">{form.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Mobile Number</span>
                <span className="font-semibold text-white">{form.mobile}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Village / City</span>
                <span className="font-semibold text-white">{form.village}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Age</span>
                <span className="font-semibold text-white">{form.age}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Playing Style</span>
                <span className="font-semibold text-white">{form.playing_style}</span>
              </div>
              <div className="flex flex-col py-1">
                <span className="text-gray-400 mb-0.5">CricHeroes Profile URL</span>
                <span className="font-mono text-xs text-gold truncate max-w-full block select-all">
                  {form.crickheroes_url}
                </span>
              </div>
            </div>
          </div>
          {submitting && (
            <div className="flex items-center justify-center gap-2 p-2.5 bg-gold/10 border border-gold/20 rounded-lg text-xs text-gold animate-pulse mt-3">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Uploading photo and details... Please keep this page open.</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              Edit Details
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={submitRegistration}
              className="flex-1 bg-gold hover:bg-gold-dark text-navy font-bold flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    }>
      <RegisterFormContent />
    </Suspense>
  );
}
