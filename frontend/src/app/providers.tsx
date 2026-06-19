'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,       // 60s — cached data reused without refetching
            gcTime: 5 * 60 * 1000,      // 5 min — keep in memory after unmount
            retry: 1,
            refetchOnWindowFocus: false, // Don't refetch on tab switch
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster
          position="top-right"
          duration={4000}
          toastOptions={{
            style: {
              background: 'rgba(19, 34, 64, 0.95)',
              border: '1px solid rgba(212, 168, 67, 0.2)',
              color: '#e5e7eb',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
