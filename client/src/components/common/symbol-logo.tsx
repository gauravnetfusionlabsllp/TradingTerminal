import { logoFor } from '../../lib/logos';

// nvstly logos are white-on-transparent for dark UIs: a fixed dark disc (not a theme token) keeps them visible in light mode
const DISC = '#0c1320';

function Disc({ src, size, className = '' }: { src: string; size: number; className?: string }) {
  const flag = src.includes('/fx/'); // flags fill the tile; marks get a margin. Square, like every tile in the panels
  return (
    <img
      src={src} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false}
      className={`absolute ${flag ? 'object-cover' : 'object-contain'} ${className}`}
      style={{ width: size, height: size, background: DISC, padding: flag ? 0 : Math.round(size * 0.15) }}
    />
  );
}

/** Square logo slot for an MT5 symbol: an FX pair shows two overlapping flags. Empty but sized when there's no logo, so rows align. */
export function SymbolLogo({ symbol, size = 14, className = '' }: { symbol: string; size?: number; className?: string }) {
  const [a, b] = logoFor(symbol);
  const small = Math.round(size * 0.7);
  return (
    <span aria-hidden className={`relative inline-block shrink-0 align-middle ${className}`} style={{ width: size, height: size }}>
      {b ? (
        <>
          <Disc src={a} size={small} className="left-0 top-0" />
          <Disc src={b} size={small} className="right-0 bottom-0 ring-1 ring-panel" />
        </>
      ) : a && <Disc src={a} size={size} className="inset-0" />}
    </span>
  );
}
