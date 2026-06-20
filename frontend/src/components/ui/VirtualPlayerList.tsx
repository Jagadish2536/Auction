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
  maxHeight = '60dvh',
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

    // Helper to measure and update height
    const measureHeight = () => {
      const height = el.clientHeight;
      if (height > 0) {
        setContainerHeight(height);
      }
    };

    // 1. Initial measurement
    measureHeight();

    // 2. Listen to scroll events
    const onScroll = () => {
      setScrollTop(el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    // 3. ResizeObserver for layout changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.clientHeight;
        if (height > 0) {
          setContainerHeight(height);
        }
      }
    });
    resizeObserver.observe(el);

    // 4. Recalculate after dialog animation/transition completes
    const popup = el.closest('[role="dialog"]') || el.closest('[data-slot="dialog-content"]');
    if (popup) {
      popup.addEventListener('animationend', measureHeight);
      popup.addEventListener('transitionend', measureHeight);
    }

    // 5. Fallback timeouts to measure height as the dialog animates
    const timeoutIds = [50, 100, 200, 400, 800].map(delay =>
      setTimeout(measureHeight, delay)
    );

    // 6. iOS Safari touchstart hook: recalculate on first touch
    const handleTouchStart = () => {
      measureHeight();
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: true });

    // 7. Window, orientation, and visualViewport resize hooks for iOS bar transitions
    window.addEventListener('resize', measureHeight);
    window.addEventListener('orientationchange', measureHeight);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', measureHeight);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('resize', measureHeight);
      window.removeEventListener('orientationchange', measureHeight);
      if (vv) {
        vv.removeEventListener('resize', measureHeight);
      }
      resizeObserver.disconnect();
      if (popup) {
        popup.removeEventListener('animationend', measureHeight);
        popup.removeEventListener('transitionend', measureHeight);
      }
      timeoutIds.forEach(clearTimeout);
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
      className={`overflow-y-auto overscroll-contain ${className}`}
      style={{
        maxHeight,
        overflowY: 'auto',
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
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
