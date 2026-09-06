import { useQuery } from '@tanstack/react-query';

export interface Batch {
  id: string;
  name: string;
  startYear?: number;
}

export interface Section {
  id: string;
  name: string;
  departmentId: string;
}

export interface Department {
  id: string;
  name: string;
  batchId: string;
  sections?: Section[];
}

const getBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Fetch all academic batches with 5-minute cache
 */
export const useBatches = () => {
  const baseUrl = getBaseUrl();

  const query = useQuery({
    queryKey: ['batches'],
    queryFn: async (): Promise<Batch[]> => {
      const res = await fetch(`${baseUrl}/api/v1/batches`);
      if (!res.ok) {
        throw new Error('Failed to fetch batches');
      }
      const json = await res.json();
      return json?.data?.batches || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    batches: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
};

/**
 * Fetch all departments (optionally filtered by batchId) with 5-minute cache
 */
export const useDepartments = (batchId?: string, options?: { enabled?: boolean }) => {
  const baseUrl = getBaseUrl();

  const query = useQuery({
    queryKey: ['departments', batchId || 'all'],
    queryFn: async (): Promise<Department[]> => {
      const url = batchId && batchId !== 'all' && batchId !== 'All Batches'
        ? `${baseUrl}/api/v1/departments?batchId=${encodeURIComponent(batchId)}`
        : `${baseUrl}/api/v1/departments`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch departments');
      }
      const json = await res.json();
      return json?.data?.departments || [];
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
  });

  return {
    departments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
};
