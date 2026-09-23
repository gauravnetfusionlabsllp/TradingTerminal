import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/error-boundary';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,              // 10 min — most data is date-seeded, changes daily
      gcTime: 5 * 60_000,                  // GC unused queries after 5 min (frees memory)
      refetchOnWindowFocus: false,          // Don't refetch on tab switch
      refetchIntervalInBackground: false,   // Don't refetch when tab is not visible
      retry: 1,                             // Reduce retries
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
