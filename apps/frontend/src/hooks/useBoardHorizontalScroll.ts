import React from 'react';

// Makes a horizontally scrollable container respond to vertical wheel input
// (standard kanban UX: scroll the board sideways with a normal mouse wheel).
// Does not hijack the wheel when the pointer is over a vertically-scrollable
// list (e.g. the cards inside a column).
export function useBoardHorizontalScroll<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);

  const onWheel = React.useCallback((e: React.WheelEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    let node = e.target as HTMLElement | null;
    while (node && node !== el) {
      const overflowY = getComputedStyle(node).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return;
      node = node.parentElement;
    }
    el.scrollLeft += e.deltaY + e.deltaX;
  }, []);

  return { ref, onWheel };
}