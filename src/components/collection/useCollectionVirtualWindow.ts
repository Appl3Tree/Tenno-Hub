import { useCallback, useEffect, useRef, useState } from "react";

export type CollectionVirtualWindow = {
  start: number;
  end: number;
  viewportHeight: number;
  rowScrollTop: number;
};

export function calculateCollectionVirtualWindow({
  totalRows,
  rowHeight,
  overscan,
  viewportHeight,
  scrollTop,
  rowsStart,
}: {
  totalRows: number;
  rowHeight: number;
  overscan: number;
  viewportHeight: number;
  scrollTop: number;
  rowsStart: number;
}): CollectionVirtualWindow {
  const rowScrollTop = Math.max(0, scrollTop - rowsStart);
  if (totalRows <= 0) return { start: 0, end: 0, viewportHeight, rowScrollTop: 0 };
  const start = Math.max(0, Math.floor(rowScrollTop / rowHeight) - overscan);
  const end = Math.min(totalRows, start + Math.ceil(viewportHeight / rowHeight) + overscan * 2);
  return { start, end, viewportHeight, rowScrollTop };
}

export function useCollectionVirtualWindow(
  totalRows: number,
  rowHeight: number,
  overscan: number,
) {
  const scrollportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const rowsAnchorRef = useRef<HTMLDivElement | null>(null);
  const [windowState, setWindowState] = useState<CollectionVirtualWindow>({
    start: 0,
    end: Math.min(totalRows, 50),
    viewportHeight: 0,
    rowScrollTop: 0,
  });

  const recompute = useCallback(() => {
    const scrollport = scrollportRef.current;
    const rowsAnchor = rowsAnchorRef.current;
    if (!scrollport || !rowsAnchor || totalRows === 0) {
      setWindowState((current) => {
        const next = { start: 0, end: Math.min(totalRows, 50), viewportHeight: scrollport?.clientHeight ?? 0, rowScrollTop: 0 };
        return current.start === next.start && current.end === next.end && current.viewportHeight === next.viewportHeight && current.rowScrollTop === next.rowScrollTop
          ? current
          : next;
      });
      return;
    }

    const viewportHeight = scrollport.clientHeight;
    const scrollportRect = scrollport.getBoundingClientRect();
    const rowsRect = rowsAnchor.getBoundingClientRect();
    const rowsTopInScrollport = rowsRect.top - scrollportRect.top + scrollport.scrollTop;
    const next = calculateCollectionVirtualWindow({
      totalRows,
      rowHeight,
      overscan,
      viewportHeight,
      scrollTop: scrollport.scrollTop,
      rowsStart: rowsTopInScrollport,
    });

    setWindowState((current) =>
      current.start === next.start && current.end === next.end && current.viewportHeight === next.viewportHeight && current.rowScrollTop === next.rowScrollTop
        ? current
        : next,
    );
  }, [overscan, rowHeight, totalRows]);

  const resetScroll = useCallback(() => {
    if (scrollportRef.current) scrollportRef.current.scrollTop = 0;
    requestAnimationFrame(recompute);
  }, [recompute]);

  useEffect(() => {
    const scrollport = scrollportRef.current;
    const content = contentRef.current;
    const rowsAnchor = rowsAnchorRef.current;
    if (!scrollport) return;

    let frame = 0;
    const scheduleRecompute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    };
    const resizeObserver = new ResizeObserver(scheduleRecompute);
    resizeObserver.observe(scrollport);
    if (content) resizeObserver.observe(content);
    if (rowsAnchor) resizeObserver.observe(rowsAnchor);
    window.addEventListener("resize", scheduleRecompute);
    scheduleRecompute();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleRecompute);
    };
  }, [recompute]);

  return { scrollportRef, contentRef, rowsAnchorRef, windowState, recompute, resetScroll };
}
