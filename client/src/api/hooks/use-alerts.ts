import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Alert {
  id: number;
  name: string;
  type: string;
  symbol: string | null;
  condition: string; // JSON built by the server: {direction, price} | {pct, basePrice}
  enabled: boolean;
  triggerCount: number;
  createdAt: string;
}

export type NewAlert = { name: string; symbol: string } & (
  | { type: 'price_cross'; direction: 'above' | 'below'; price: number }
  | { type: 'price_change_pct'; pct: number }
);

export function useAlerts() {
  return useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts'),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewAlert) =>
      api.post('/alerts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; enabled: boolean }) =>
      api.put(`/alerts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
