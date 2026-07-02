import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

function Skeleton({ className }) {
  return (
    <div className={clsx('animate-pulse rounded bg-surface-elevated', className)} />
  );
}

function TableSkeleton({ columns, rows = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {columns.map((col, colIdx) => (
            <td key={colIdx} className="px-4 py-3 border-t border-surface-border">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ message, colSpan }) {
  return (
    <tbody>
      <tr>
        <td colSpan={colSpan} className="border-t border-surface-border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
              <Inbox size={28} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">{message}</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

function SortIcon({ direction }) {
  if (!direction) {
    return (
      <span className="inline-flex flex-col mr-1 opacity-30">
        <ChevronUp size={10} />
        <ChevronDown size={10} className="-mt-1" />
      </span>
    );
  }

  return (
    <span className="inline-flex mr-1 text-brand-blue">
      {direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </span>
  );
}

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  onRowClick,
  pagination,
  onPageChange,
  emptyMessage = 'داده‌ای برای نمایش وجود ندارد',
  sortable = true,
  defaultSort,
  skeletonRows = 5,
}) {
  const [sortConfig, setSortConfig] = useState(
    defaultSort || { key: null, direction: null }
  );

  const handleSort = (column) => {
    if (!column.sortable && sortable === false) return;
    if (column.sortable === false) return;

    const key = column.accessor || column.key;
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
        return { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const col = columns.find(
        (c) => (c.accessor || c.key) === sortConfig.key
      );
      const key = sortConfig.key;

      let aVal = a[key];
      let bVal = b[key];

      if (col && col.sortValue) {
        aVal = col.sortValue(a);
        bVal = col.sortValue(b);
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr, 'fa');
      }
      return bStr.localeCompare(aStr, 'fa');
    });
  }, [data, sortConfig, columns]);

  const totalPages = pagination?.totalPages || 1;
  const currentPage = pagination?.page || 1;
  const totalItems = pagination?.totalItems;

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const isSortableColumn = (col) => {
    if (col.sortable !== undefined) return col.sortable;
    return sortable;
  };

  return (
    <div className="space-y-0">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col) => {
                const key = col.accessor || col.key;
                const isColumnSortable = isSortableColumn(col);
                const sortDir =
                  sortConfig.key === key ? sortConfig.direction : null;

                return (
                  <th
                    key={key}
                    className={clsx(
                      'px-4 py-3 text-right text-text-secondary font-medium whitespace-nowrap select-none',
                      isColumnSortable && 'cursor-pointer hover:text-text-primary transition-colors',
                      col.headerClassName
                    )}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    onClick={() => isColumnSortable && handleSort(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header || col.title}
                      {isColumnSortable && <SortIcon direction={sortDir} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton columns={columns} rows={skeletonRows} />
          ) : sortedData.length === 0 ? (
            <EmptyState message={emptyMessage} colSpan={columns.length} />
          ) : (
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={() => onRowClick && onRowClick(row, rowIdx)}
                  className={clsx(
                    'hover:bg-surface-hover transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => {
                    const key = col.accessor || col.key;
                    const cellValue = row[key];

                    return (
                      <td
                        key={key}
                        className={clsx(
                          'px-4 py-3 text-right border-t border-surface-border whitespace-nowrap',
                          col.cellClassName
                        )}
                      >
                        {col.render
                          ? col.render(cellValue, row, rowIdx)
                          : cellValue ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 px-1">
          {totalItems !== undefined && (
            <span className="text-xs text-text-muted">
              {toPersianDigits(totalItems)} مورد
            </span>
          )}
          <div className="flex items-center gap-1 mr-auto">
            <button
              onClick={() => onPageChange && onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>

            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => onPageChange && onPageChange(1)}
                  className="w-8 h-8 rounded-lg text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                >
                  {toPersianDigits(1)}
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="text-text-muted text-xs px-1">...</span>
                )}
              </>
            )}

            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => onPageChange && onPageChange(pageNum)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                  pageNum === currentPage
                    ? 'bg-brand-blue text-white'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                {toPersianDigits(pageNum)}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="text-text-muted text-xs px-1">...</span>
                )}
                <button
                  onClick={() => onPageChange && onPageChange(totalPages)}
                  className="w-8 h-8 rounded-lg text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                >
                  {toPersianDigits(totalPages)}
                </button>
              </>
            )}

            <button
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
