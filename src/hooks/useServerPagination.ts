import { useState, useCallback, useMemo } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface UseServerPaginationOptions {
  defaultPageSize?: number;
}

export interface UseServerPaginationReturn {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  resetPage: () => void;
  rangeFrom: number;
  rangeTo: number;
}

export function useServerPagination(options?: UseServerPaginationOptions): UseServerPaginationReturn {
  const defaultPageSize = options?.defaultPageSize ?? 10;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  // Supabase range values (0-indexed)
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const resetPage = useCallback(() => setPage(1), []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  return useMemo(() => ({
    page,
    pageSize,
    totalCount,
    totalPages,
    from,
    to,
    setPage,
    setPageSize,
    setTotalCount,
    resetPage,
    rangeFrom,
    rangeTo,
  }), [page, pageSize, totalCount, totalPages, from, to, rangeFrom, rangeTo, setPageSize, resetPage]);
}
