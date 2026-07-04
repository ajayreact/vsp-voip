'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  className?: string;
  headerClassName?: string;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  render?: (row: T) => React.ReactNode;
};

export type DataTableProps<T> = {
  title: string;
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  emptyMessage?: React.ReactNode;
  action?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  searchable?: boolean;
  paginated?: boolean;
  className?: string;
};

const DEFAULT_PAGE_SIZES = [7, 10, 25, 50];

function cellText(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function compareValues(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  title,
  data,
  columns,
  getRowId,
  emptyMessage = 'No records found.',
  action,
  toolbar,
  footer,
  defaultPageSize = 7,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  searchable = true,
  paginated = true,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const searchableColumns = columns.filter((col) => col.searchable !== false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      searchableColumns.some((col) => {
        const raw = col.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[col.key];
        return cellText(raw).toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchableColumns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[col.key];
      const bv = col.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[col.key];
      const cmp = compareValues(av, bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const total = sorted.length;
  const totalPages = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = paginated ? Math.min(page, totalPages) : 1;

  const pageRows = useMemo(() => {
    if (!paginated) return sorted;
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, paginated, currentPage, pageSize]);

  const rangeStart = total === 0 ? 0 : paginated ? (currentPage - 1) * pageSize + 1 : 1;
  const rangeEnd = paginated ? Math.min(currentPage * pageSize, total) : total;

  function toggleSort(key: string, sortable?: boolean) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
    setPage(1);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function onPageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set<number>([1, totalPages, currentPage]);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);
    return Array.from(pages).sort((a, b) => a - b);
  }, [totalPages, currentPage]);

  return (
    <div className={cn('panel-card overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
        <h3 className="section-title">{title}</h3>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>

      {toolbar ? <div className="border-b border-slate-100 px-3 py-3 sm:px-5">{toolbar}</div> : null}

      {(searchable || paginated) ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-5">
          {paginated ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>entries</span>
            </label>
          ) : (
            <span className="text-sm text-slate-500">{total} record{total === 1 ? '' : 's'}</span>
          )}

          {searchable ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Search:</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter records…"
                  className="w-44 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:w-56"
                />
              </div>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="datatable min-w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      col.headerClassName,
                      col.sortable && 'cursor-pointer select-none hover:bg-slate-100',
                    )}
                    onClick={() => toggleSort(col.key, col.sortable)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable ? (
                        <span className="text-slate-400">
                          {active ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                            )
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5 opacity-30" />
                          )}
                        </span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : cellText((row as Record<string, unknown>)[col.key]) || '—'}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {paginated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-3 sm:px-5">
          <p className="text-sm text-slate-600">
            Showing {rangeStart} to {rangeEnd} of {total} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="datatable-page-btn"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((n, idx) => {
              const prev = pageNumbers[idx - 1];
              const showEllipsis = prev != null && n - prev > 1;
              return (
                <span key={n} className="flex items-center gap-1">
                  {showEllipsis ? <span className="px-1 text-slate-400">…</span> : null}
                  <button
                    type="button"
                    onClick={() => setPage(n)}
                    className={cn('datatable-page-btn', currentPage === n && 'datatable-page-btn-active')}
                  >
                    {n}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="datatable-page-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {footer ? <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{footer}</div> : null}
    </div>
  );
}
