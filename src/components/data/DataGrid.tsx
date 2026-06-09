import React, { useState, useEffect } from 'react';
import { PagedRequest, PagedResult } from '../../types/user';

interface ColumnDef<T> {
  header: string;
  key: keyof T | string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataGridProps<T> {
  fetchData: (params: PagedRequest) => Promise<PagedResult<T>>;
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  refreshTrigger?: boolean;
}

export function DataGrid<T>({
  fetchData,
  columns,
  searchPlaceholder = 'Search records...',
  refreshTrigger = false,
}: DataGridProps<T>) {
  const [data, setData] = useState<PagedResult<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Input debouncing for search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchTerm);
      setPage(1); // Reset page on search trigger
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchData({
        page,
        pageSize,
        search: search || undefined,
        sortBy,
        sortDirection,
      });
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch database records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, search, sortBy, sortDirection, refreshTrigger]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Header Panel */}
      <div className="flex justify-between align-center">
        <input
          type="text"
          className="form-control"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '300px' }}
        />
        {loading && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Syncing...</span>}
      </div>

      {error && (
        <div className="alert alert-danger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Responsive Table grid container (Rule 07 UX/UI) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th
                  key={index}
                  onClick={() => col.sortable !== false && handleSort(col.key as string)}
                  style={{ cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none' }}
                >
                  <div className="flex align-center gap-2">
                    {col.header}
                    {col.sortable !== false && sortBy === col.key && (
                      <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loader Skeletons (Rule 07 / UI2)
              Array.from({ length: pageSize }).map((_, rIndex) => (
                <tr key={rIndex}>
                  {columns.map((_, cIndex) => (
                    <td key={cIndex}>
                      <div
                        style={{
                          height: '16px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          animation: 'pulse 1.5s infinite',
                          width: `${40 + Math.random() * 50}%`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data || data.items.length === 0 ? (
              // Empty State (Rule 07 / Empty State checklist)
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)' }}>
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No records found</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Try refining your search queries.</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Data rows mapping
              data.items.map((row, rIndex) => (
                <tr key={rIndex}>
                  {columns.map((col, cIndex) => (
                    <td key={cIndex}>
                      {col.render ? col.render(row) : (row[col.key as keyof T] as unknown as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer Panel (Rule 06 / A3) */}
        {data && data.totalPages > 0 && (
          <div className="pagination-panel">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.totalCount} total records)
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                disabled={page === data.totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
