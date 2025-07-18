import React, { useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  width?: number;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  height?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  getRowKey: (item: T) => string;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 50,
  height = 600,
  className,
  onRowClick,
  getRowKey,
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const totalWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (col.width || 150), 0),
    [columns]
  );

  const handleRowClick = useCallback(
    (item: T, index: number) => {
      if (onRowClick) {
        onRowClick(item, index);
      }
    },
    [onRowClick]
  );

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-muted border-b"
        style={{ width: totalWidth }}
      >
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                'px-4 py-3 font-medium text-sm',
                column.className
              )}
              style={{ width: column.width || 150 }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: totalWidth,
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index];
            const key = getRowKey(item);

            return (
              <div
                key={key}
                className={cn(
                  'absolute top-0 left-0 w-full flex border-b hover:bg-muted/50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => handleRowClick(item, virtualRow.index)}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-sm overflow-hidden text-ellipsis whitespace-nowrap',
                      column.className
                    )}
                    style={{ width: column.width || 150 }}
                  >
                    {column.render
                      ? column.render(item)
                      : (item as any)[column.key]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}