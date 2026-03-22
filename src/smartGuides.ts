export interface Guide {
  lineGuide: number;
  offset: number;
  orientation: 'V' | 'H';
  snap: 'start' | 'center' | 'end';
  type: 'vertical' | 'horizontal';
}

export function calculateSmartGuides(
  blockId: string,
  element: { id: string; x: number; y: number; width: number; height: number },
  otherElements: { id: string; x: number; y: number; width: number; height: number }[],
  threshold: number = 5
) {
  const guides: Guide[] = [];
  let snappedX = element.x;
  let snappedY = element.y;

  const eLeft = element.x;
  const eCenter = element.x + element.width / 2;
  const eRight = element.x + element.width;

  const eTop = element.y;
  const eMiddle = element.y + element.height / 2;
  const eBottom = element.y + element.height;

  otherElements.forEach(other => {
    const oLeft = other.x;
    const oCenter = other.x + other.width / 2;
    const oRight = other.x + other.width;

    const oTop = other.y;
    const oMiddle = other.y + other.height / 2;
    const oBottom = other.y + other.height;

    [
      { snap: 'start', eVal: eLeft, oVal: oLeft, offset: 0 },
      { snap: 'center', eVal: eCenter, oVal: oCenter, offset: element.width / 2 },
      { snap: 'end', eVal: eRight, oVal: oRight, offset: element.width }
    ].forEach(v => {
      const diff = Math.abs(v.eVal - v.oVal);
      if (diff < threshold) {
        snappedX = v.oVal - v.offset;
        guides.push({ lineGuide: v.oVal, offset: v.offset, orientation: 'V', snap: v.snap as any, type: 'vertical' });
      }
    });

    [
      { snap: 'start', eVal: eTop, oVal: oTop, offset: 0 },
      { snap: 'center', eVal: eMiddle, oVal: oMiddle, offset: element.height / 2 },
      { snap: 'end', eVal: eBottom, oVal: oBottom, offset: element.height }
    ].forEach(h => {
      const diff = Math.abs(h.eVal - h.oVal);
      if (diff < threshold) {
        snappedY = h.oVal - h.offset;
        guides.push({ lineGuide: h.oVal, offset: h.offset, orientation: 'H', snap: h.snap as any, type: 'horizontal' });
      }
    });
  });

  return { snappedX, snappedY, guides };
}
