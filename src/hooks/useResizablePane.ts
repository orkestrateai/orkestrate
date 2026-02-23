import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizablePaneOptions {
    defaultPercent?: number;
    minPercent?: number;
    maxPercent?: number;
    direction?: 'horizontal' | 'vertical';
}

export function useResizablePane({
    defaultPercent = 50,
    minPercent = 20,
    maxPercent = 80,
    direction = 'horizontal'
}: UseResizablePaneOptions = {}) {
    const [splitPercent, setSplitPercent] = useState(defaultPercent);
    const isDragging = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    }, [direction]);

    const handleDoubleClick = useCallback(() => {
        setSplitPercent(defaultPercent);
    }, [defaultPercent]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            let percent: number;

            if (direction === 'horizontal') {
                percent = ((e.clientX - rect.left) / rect.width) * 100;
            } else {
                percent = ((e.clientY - rect.top) / rect.height) * 100;
            }

            // Clamp to min/max
            percent = Math.max(minPercent, Math.min(maxPercent, percent));
            setSplitPercent(percent);
        };

        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [direction, minPercent, maxPercent]);

    return {
        splitPercent,
        containerRef,
        gutterProps: {
            onMouseDown: handleMouseDown,
            onDoubleClick: handleDoubleClick,
            role: 'separator' as const,
            'aria-orientation': direction as 'horizontal' | 'vertical',
            'aria-valuenow': Math.round(splitPercent),
            'aria-valuemin': minPercent,
            'aria-valuemax': maxPercent,
        },
        leftStyle: { width: `${splitPercent}%` },
        rightStyle: { width: `${100 - splitPercent}%` },
    };
}
