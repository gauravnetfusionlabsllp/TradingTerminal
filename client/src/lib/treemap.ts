// Treemap layout shared by the heat map panels: areas proportional to weight, splits chosen to keep tiles near-square

export interface TreemapItem { id: string; weight: number }
export interface TreemapRect { id: string; x: number; y: number; w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }

export function squarify(items: TreemapItem[], rect: Rect): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ id: items[0].id, x: rect.x, y: rect.y, w: rect.w, h: rect.h }];
  }

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) {
    // Distribute evenly if all weights are 0
    const n = items.length;
    const cols = Math.ceil(Math.sqrt(n));
    const cellW = rect.w / cols;
    const cellH = rect.h / Math.ceil(n / cols);
    return items.map((item, i) => ({
      id: item.id,
      x: rect.x + (i % cols) * cellW,
      y: rect.y + Math.floor(i / cols) * cellH,
      w: cellW,
      h: cellH,
    }));
  }

  // Sort descending by weight
  const sorted = [...items].sort((a, b) => b.weight - a.weight);

  // Slice-and-dice with aspect-ratio optimization
  const isHorizontal = rect.w >= rect.h;

  // Find the best split point that minimizes worst aspect ratio
  let bestSplit = 1;
  let bestRatio = Infinity;
  let runningWeight = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    runningWeight += sorted[i].weight;
    const fraction = runningWeight / totalWeight;

    // Calculate aspect ratios for both halves
    let r1w: number, r1h: number, r2w: number, r2h: number;
    if (isHorizontal) {
      r1w = rect.w * fraction;
      r1h = rect.h;
      r2w = rect.w * (1 - fraction);
      r2h = rect.h;
    } else {
      r1w = rect.w;
      r1h = rect.h * fraction;
      r2w = rect.w;
      r2h = rect.h * (1 - fraction);
    }

    const ar1 = Math.max(r1w / (r1h || 1), r1h / (r1w || 1));
    const ar2 = Math.max(r2w / (r2h || 1), r2h / (r2w || 1));
    const worstAr = Math.max(ar1, ar2);

    if (worstAr < bestRatio) {
      bestRatio = worstAr;
      bestSplit = i + 1;
    }
  }

  const left = sorted.slice(0, bestSplit);
  const right = sorted.slice(bestSplit);

  const leftWeight = left.reduce((s, i) => s + i.weight, 0);
  const fraction = leftWeight / totalWeight;

  let leftRect: Rect;
  let rightRect: Rect;

  if (isHorizontal) {
    const splitX = rect.x + rect.w * fraction;
    leftRect = { x: rect.x, y: rect.y, w: rect.w * fraction, h: rect.h };
    rightRect = { x: splitX, y: rect.y, w: rect.w * (1 - fraction), h: rect.h };
  } else {
    const splitY = rect.y + rect.h * fraction;
    leftRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h * fraction };
    rightRect = { x: rect.x, y: splitY, w: rect.w, h: rect.h * (1 - fraction) };
  }

  return [
    ...squarify(left, leftRect),
    ...squarify(right, rightRect),
  ];
}
