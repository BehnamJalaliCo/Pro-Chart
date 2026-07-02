import { useState, useMemo, useCallback } from 'react';

export function usePagination({ totalItems = 0, pageSize = 20, initialPage = 1 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState(pageSize);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / size));
  }, [totalItems, size]);

  const currentPage = useMemo(() => {
    return Math.min(page, totalPages);
  }, [page, totalPages]);

  const next = useCallback(() => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prev = useCallback(() => {
    setPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback(
    (targetPage) => {
      const p = Math.max(1, Math.min(targetPage, totalPages));
      setPage(p);
    },
    [totalPages]
  );

  const setPageSize = useCallback(
    (newSize) => {
      setSize(newSize);
      setPage(1);
    },
    []
  );

  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, totalItems);

  const pageNumbers = useMemo(() => {
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

  return {
    page: currentPage,
    pageSize: size,
    totalPages,
    totalItems,
    hasNext,
    hasPrev,
    next,
    prev,
    goToPage,
    setPage,
    setPageSize,
    startIndex,
    endIndex,
    pageNumbers,
  };
}

export default usePagination;
