interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Reference level (e.g. previous close), drawn dashed and kept inside the vertical range */
  baseline?: number | null;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = 'currentColor',
  baseline,
}: SparklineProps) {
  if (data.length < 2) return null;

  const levels = baseline != null ? [...data, baseline] : data;
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const range = max - min || 1;
  // Inset by half the stroke so the line isn't clipped at the top and bottom edges
  const y = (v: number) => 0.75 + (height - 1.5) * (1 - (v - min) / range);

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${y(v)}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block align-middle overflow-visible" aria-hidden="true">
      {baseline != null && (
        <line
          x1={0} x2={width} y1={y(baseline)} y2={y(baseline)}
          style={{ stroke: 'var(--color-neutral)' }}
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <polyline
        points={points}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
