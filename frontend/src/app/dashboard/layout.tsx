'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { Tournament } from '@/types';
import {
  Gavel, LayoutDashboard, Trophy, Users, UserCircle,
  Radio, BarChart3, FileText, Settings, LogOut, Menu, X,
  ChevronRight, Shield, Heart, Home
} from 'lucide-react';

const managerNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/dashboard/teams', label: 'Teams', icon: Users },
  { href: '/dashboard/players', label: 'Players', icon: UserCircle },
  { href: '/dashboard/auction', label: 'Auction', icon: Radio },
  { href: '/dashboard/sponsors', label: 'Sponsors', icon: Heart },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/users', label: 'Users', icon: Shield },
];

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/teams', label: 'Teams', icon: Users },
  { href: '/dashboard/players', label: 'Players', icon: UserCircle },
  { href: '/dashboard/auction', label: 'Auction', icon: Radio },
  { href: '/dashboard/sponsors', label: 'Sponsors', icon: Heart },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, checkAuth, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/tournaments').then((r) => {
        const list = r.data.tournaments || [];
        setTournaments(list);
        const stored = localStorage.getItem('selected_tournament_id');
        if (user && user.role === 'admin' && user.tournament_id) {
          setSelectedTournamentId(user.tournament_id);
          localStorage.setItem('selected_tournament_id', String(user.tournament_id));
        } else if (stored && list.some((t: Tournament) => t.id === Number(stored))) {
          setSelectedTournamentId(Number(stored));
        } else if (list.length > 0) {
          setSelectedTournamentId(list[0].id);
          localStorage.setItem('selected_tournament_id', String(list[0].id));
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Gavel className="w-10 h-10 text-gold animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = user.role === 'manager'
    ? managerNav
    : adminNav.filter((item) => {
        if (item.href === '/dashboard/teams' && user.perm_teams === false) return false;
        if (item.href === '/dashboard/players' && user.perm_players === false) return false;
        if (item.href === '/dashboard/auction' && user.perm_auction === false) return false;
        if (item.href === '/dashboard/sponsors' && user.perm_sponsors === false) return false;
        if (item.href === '/dashboard/analytics' && user.perm_analytics === false) return false;
        if (item.href === '/dashboard/reports' && user.perm_reports === false) return false;
        return true;
      });

  const tournamentRequiredPaths = [
    '/dashboard',
    '/dashboard/teams',
    '/dashboard/players',
    '/dashboard/auction',
    '/dashboard/sponsors',
    '/dashboard/analytics',
    '/dashboard/reports'
  ];
  const isTournamentRequired = tournamentRequiredPaths.includes(pathname);
  const showSelectScreen = isTournamentRequired && !selectedTournamentId;

  const isForbidden = user.role === 'admin' && (
    (pathname === '/dashboard/teams' && user.perm_teams === false) ||
    (pathname === '/dashboard/players' && user.perm_players === false) ||
    (pathname === '/dashboard/auction' && user.perm_auction === false) ||
    (pathname === '/dashboard/sponsors' && user.perm_sponsors === false) ||
    (pathname === '/dashboard/analytics' && user.perm_analytics === false) ||
    (pathname === '/dashboard/reports' && user.perm_reports === false)
  );

  const renderContent = () => {
    if (isForbidden) {
      return (
        <div className="flex-1 overflow-auto p-4 lg:p-6 flex flex-col items-center justify-center max-w-4xl mx-auto w-full min-h-[70vh] animate-fade-in">
          <Shield className="w-16 h-16 text-red-500/40 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-center mb-8 max-w-md">
            You do not have permission to access this module. Please contact your manager.
          </p>
          <Link href="/dashboard">
            <Button className="bg-gold hover:bg-gold-dark text-navy font-semibold">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      );
    }

    if (showSelectScreen) {
      return (
        <div className="flex-1 overflow-auto p-4 lg:p-6 flex flex-col items-center justify-center max-w-4xl mx-auto w-full min-h-[70vh]">
          <Trophy className="w-16 h-16 text-gold/40 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-gradient-gold mb-2">Select Tournament</h2>
          <p className="text-muted-foreground text-center mb-8 max-w-md">
            Please select a tournament to manage its players, teams, auction settings, and analytics.
          </p>

          {tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {tournaments.map((t) => (
                <Card
                  key={t.id}
                  className="glass-card border border-gold/10 hover:border-gold/30 hover:glow-gold-sm transition-all cursor-pointer animate-fade-in"
                  onClick={() => {
                    localStorage.setItem('selected_tournament_id', String(t.id));
                    setSelectedTournamentId(t.id);
                    window.location.reload();
                  }}
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{t.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">{t.status.replace(/_/g, ' ')}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gold" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-6 bg-navy-lighter/30 rounded-xl border border-dashed border-gold/15 max-w-sm">
              <p className="text-sm text-muted-foreground mb-4">You have not created any tournaments yet.</p>
              <Link href="/dashboard/tournaments">
                <Button className="bg-gold hover:bg-gold-dark text-navy font-semibold">
                  Create First Tournament
                </Button>
              </Link>
            </div>
          )}
        </div>
      );
    }
    return children;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <img
                src="/lakshya_sports_logo.png"
                alt="Lakshya Sports Logo"
                className="w-8 h-8 rounded-full border border-gold/30 object-cover"
              />
              <span className="font-bold text-gradient-gold text-lg">Lakshya Sports</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground glow-gold-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                );
              })}

              <div className="pt-2 mt-2 border-t border-sidebar-border/50">
                <Link
                  href="/"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-gold hover:bg-sidebar-accent/50"
                >
                  <Home className="w-4 h-4 shrink-0 text-gold" />
                  Back to Homepage
                </Link>
              </div>
            </nav>
          </ScrollArea>

          {/* User Section */}
          <div className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gold/20 text-gold text-sm font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass border-gold/10">
                <DropdownMenuItem className="text-muted-foreground">
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-400">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-background/80 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            {navItems.find((n) => n.href === pathname)?.label || 'Dashboard'}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {isTournamentRequired && selectedTournamentId && tournaments.length > 0 && tournaments.some(t => t.id === selectedTournamentId) && (
              user.role === 'admin' ? (
                <div className="px-2 sm:px-3 py-1.5 rounded-lg bg-navy-lighter/30 border border-gold/10 text-xs text-foreground font-semibold flex items-center gap-1.5 max-w-[120px] sm:max-w-none truncate">
                  🏆 <span className="truncate">{tournaments.find(t => t.id === selectedTournamentId)?.name || "Tournament"}</span>
                </div>
              ) : (
                <Select
                  key={`${selectedTournamentId}-${tournaments.length}`}
                  value={String(selectedTournamentId)}
                  onValueChange={(v) => {
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('selected_tournament_id', v || '');
                      window.location.reload();
                    }
                    setSelectedTournamentId(Number(v));
                  }}
                >
                  <SelectTrigger className="w-28 xs:w-36 sm:w-48 bg-navy-lighter/30 border-gold/10 text-[10px] sm:text-xs text-foreground focus:ring-gold/30">
                    <SelectValue placeholder="Switch Tournament">
                      <span className="truncate">{tournaments.find(t => t.id === selectedTournamentId)?.name || "Switch Tournament"}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="glass border-gold/10">
                    {tournaments.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}

            <Link href="/" className="flex items-center">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 px-2">
                <Home className="w-3.5 h-3.5" /> <span className="hidden md:inline">Homepage</span>
              </Button>
            </Link>

            <Link href={selectedTournamentId ? `/live?tournament_id=${selectedTournamentId}` : '/live'} target="_blank" className="flex items-center">
              <Button variant="outline" size="sm" className="border-gold/30 text-gold hover:bg-gold/10 text-xs flex items-center px-2">
                <Radio className="w-3 h-3 md:mr-1.5" /> <span className="hidden md:inline">Live View</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
