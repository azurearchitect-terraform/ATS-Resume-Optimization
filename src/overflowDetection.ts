import { LayoutBlock } from './types';

export interface OverflowStatus {
  isOverflowing: boolean;
  pageCount: number;
  overflowingElements: string[];
}

export function detectOverflow(pages: LayoutBlock[][], maxPages: number = 2): OverflowStatus {
  const isOverflowing = pages.length > maxPages;
  const overflowingElements: string[] = [];

  if (isOverflowing) {
    for (let i = maxPages; i < pages.length; i++) {
      pages[i].forEach(el => overflowingElements.push(el.id));
    }
  }

  return {
    isOverflowing,
    pageCount: pages.length,
    overflowingElements
  };
}
