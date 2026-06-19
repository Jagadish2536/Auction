'use client';

import { memo, useRef, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';

interface VirtualPlayerListProps<T> {
  items: T[];
  rowHeight?: number;
  bufferRows?: number;
  maxHeight?: string;
  renderRow: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  className?: string;
}

/**
 * VirtualPlayerList — High-performance virtualized list for player modals.
 * Only renders visible rows + buffer, keeping DOM light even with 1000+ items.
 */
function VirtualPlayerListInner<T>({
  items,
  rowHeight = 72,
  bufferRows = 10,
  maxHeight = '60vh',
  renderRow,
  keyExtractor,
  emptyMessage = 'No items found',
  emptyIcon,
  className = '',
}: VirtualPlayerListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Measure initial height
    setContainerHeight(el.clientHeight);

    const onScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const onResize = () => {
      setContainerHeight(el.clientHeight);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Reset scroll when items change (e.g. filter applied)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  const { startIndex, endIndex, visibleItems, totalHeight, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const end = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / rowHeight) + bufferRows);
    return {
      startIndex: start,
      endIndex: end,
      visibleItems: items.slice(start, end),
      totalHeight: items.length * rowHeight,
      offsetY: start * rowHeight,
    };
  }, [items, scrollTop, containerHeight, rowHeight, bufferRows]);

  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        {emptyIcon}
        <p className="text-muted-foreground text-sm mt-3">{emptyMessage}</p>
      </div>
    );
  }

  const bottomSpacerHeight = totalHeight - offsetY - visibleItems.length * rowHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight }}
    >
      {/* Top spacer */}
      {offsetY > 0 && <div style={{ height: offsetY }} />}

      {/* Visible rows */}
      {visibleItems.map((item, i) => (
        <div key={keyExtractor(item)} style={{ height: rowHeight }}>
          {renderRow(item, startIndex + i)}
        </div>
      ))}

      {/* Bottom spacer */}
      {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
    </div>
  );
}

// Memoize the component
const VirtualPlayerList = memo(VirtualPlayerListInner) as typeof VirtualPlayerListInner;

export default VirtualPlayerList;
