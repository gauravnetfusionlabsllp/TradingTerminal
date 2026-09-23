import { Landmark, RefreshCw } from 'lucide-react';
import { useMoneyMarketRates } from '../../api/hooks/use-money-market-rates';

// ── Formatting helpers ──

function fmtRate(n: number): string {
  return n.toFixed(2);
}

function fmtBps(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

function fmtVol(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  return `$${n.toFixed(1)}B`;
}

// ── Color helpers ──

function bpsColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function probColor(prob: number): string {
  if (prob >= 70) return 'text-green-400';
  if (prob >= 40) return 'text-yellow-400';
  if (prob >= 15) return 'text-orange-400';
  return 'text-neutral-500';
}

// ── Main Panel ──

export function MoneyMarketRatesPanel() {
  const { data: rawData, isLoading, refetch } = useMoneyMarketRates();
  const data = rawData;

  const sofrRate = data?.overnightRates?.find((r: any) => r.name === 'SOFR');
  const effrRate = data?.overnightRates?.find((r: any) => r.name === 'EFFR');

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Landmark className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-amber-400">
            Money Market Rates
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sofrRate && (
            <span className="px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30">
              SOFR {fmtRate(sofrRate.rate)}%
            </span>
          )}
          {effrRate && data.fedFundsTarget && (
            <span className="px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider text-neutral-400 bg-neutral-500/10 border border-neutral-500/30">
              FF {fmtRate(data.fedFundsTarget.lower)}–{fmtRate(data.fedFundsTarget.upper)}%
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-amber-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto no-scrollbar text-[9px] font-mono">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-amber-400 text-[9px] font-mono uppercase animate-pulse">
            Loading...
          </div>
        )}

        {!isLoading && !data && (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        )}

        {data && (
          <>
            {/* Section 1: Key Overnight Rates */}
            <OvernightRatesSection rates={data.overnightRates ?? []} />

            {/* Section 2: T-Bill Yields */}
            <TBillYieldsSection yields={data.tbillYields ?? []} />

            {/* Section 3: Repo Market */}
            {data.repoMarket && <RepoMarketSection repo={data.repoMarket} />}

            {/* Section 4: Commercial Paper & CD Rates */}
            <CommercialPaperSection instruments={data.commercialPaper ?? []} />

            {/* Section 5: Global Reference Rates */}
            <GlobalRatesSection rates={data.globalReferenceRates ?? []} />

            {/* Section 6: Fed Funds Futures */}
            <FedFundsFuturesSection contracts={data.fedFundsFutures ?? []} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Section: Key Overnight Rates ──

function OvernightRatesSection({ rates }: { rates: any[] }) {
  return (
    <div className="border-b border-amber-400/30">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Key Overnight Rates
        </span>
      </div>
      <div className="grid grid-cols-5 gap-px bg-border/10">
        {rates.map((r: any) => (
          <div key={r.name} className="bg-black px-2 py-1.5 hover:bg-amber-400/[0.02] transition-colors">
            <div className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">
              {r.name}
            </div>
            <div className="text-[13px] font-black text-white tabular-nums leading-tight">
              {fmtRate(r.rate)}%
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[8px] font-bold tabular-nums ${bpsColor(r.change)}`}>
                {fmtBps(r.change)}bp
              </span>
              <span className="text-[7px] text-neutral-600 tabular-nums">
                Prior {fmtRate(r.prior)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: T-Bill Yields ──

function TBillYieldsSection({ yields }: { yields: any[] }) {
  return (
    <div className="border-b border-amber-400/30">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Treasury Bill Yields
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[48px_1fr_1fr_1fr_56px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Tenor</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Yield</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Disc Rate</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Inv Rate</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Chg (bp)</span>
      </div>

      {/* Rows */}
      {yields.map((y: any) => (
        <div
          key={y.tenor}
          className="grid grid-cols-[48px_1fr_1fr_1fr_56px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors"
        >
          <span className="text-[8px] font-bold text-amber-400/80">{y.tenor}</span>
          <span className="text-[8px] text-neutral-300 text-right tabular-nums">{fmtRate(y.yield)}%</span>
          <span className="text-[8px] text-neutral-300 text-right tabular-nums">{fmtRate(y.discountRate)}%</span>
          <span className="text-[8px] text-neutral-300 text-right tabular-nums">{fmtRate(y.investmentRate)}%</span>
          <span className={`text-[8px] font-bold text-right tabular-nums ${bpsColor(y.change)}`}>
            {fmtBps(y.change)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Repo Market ──

function RepoMarketSection({ repo }: { repo: any }) {
  return (
    <div className="border-b border-amber-400/30">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Repo Market
        </span>
      </div>

      {/* Overnight + RRP summary */}
      <div className="grid grid-cols-3 gap-px bg-border/10">
        <div className="bg-black px-2 py-1.5">
          <div className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">O/N Repo</div>
          <div className="text-[12px] font-black text-white tabular-nums">{fmtRate(repo.overnightRepo)}%</div>
          <span className={`text-[8px] font-bold tabular-nums ${bpsColor(repo.overnightRepoChange)}`}>
            {fmtBps(repo.overnightRepoChange)}bp
          </span>
        </div>
        <div className="bg-black px-2 py-1.5">
          <div className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">RRP Vol</div>
          <div className="text-[12px] font-black text-white tabular-nums">{fmtVol(repo.rrpVolume)}</div>
          <span className="text-[8px] text-neutral-500 tabular-nums">{repo.rrpCounterparties} cpty</span>
        </div>
        <div className="bg-black px-2 py-1.5">
          <div className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">RRP Rate</div>
          <div className="text-[12px] font-black text-white tabular-nums">{fmtRate(repo.rrpRate)}%</div>
          <span className="text-[8px] text-neutral-600">ON RRP</span>
        </div>
      </div>

      {/* Term repo rates */}
      <div className="flex gap-0 border-t border-border/20">
        {(repo.termRepos ?? []).map((tr: any) => (
          <div key={tr.tenor} className="flex-1 px-2 py-1 border-r border-border/20 last:border-r-0 hover:bg-amber-400/[0.02] transition-colors">
            <div className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">{tr.tenor}</div>
            <div className="text-[9px] font-bold text-neutral-300 tabular-nums">{fmtRate(tr.rate)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Commercial Paper & CD Rates ──

function CommercialPaperSection({ instruments }: { instruments: any[] }) {
  return (
    <div className="border-b border-amber-400/30">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Commercial Paper & CD Rates
        </span>
      </div>

      {instruments.map((inst: any) => (
        <div key={inst.name} className="border-b border-border/20 last:border-b-0">
          <div className="px-3 py-0.5 bg-[#030303]">
            <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">{inst.name}</span>
          </div>
          <div className="flex gap-0">
            {inst.tenors.map((t: any) => (
              <div key={t.tenor} className="flex-1 px-2 py-1 border-r border-border/20 last:border-r-0 hover:bg-amber-400/[0.02] transition-colors">
                <div className="text-[7px] text-neutral-500 uppercase">{t.tenor}</div>
                <div className="text-[9px] font-bold text-neutral-300 tabular-nums">{fmtRate(t.rate)}%</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Global Reference Rates ──

function GlobalRatesSection({ rates }: { rates: any[] }) {
  return (
    <div className="border-b border-amber-400/30">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Global Reference Rates
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_40px_56px_56px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Rate</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">CCY</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Level</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Chg (bp)</span>
      </div>

      {rates.map((r: any) => (
        <div
          key={r.name}
          className="grid grid-cols-[1fr_40px_56px_56px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors"
        >
          <span className="text-[8px] font-bold text-neutral-300 truncate">{r.name}</span>
          <span className="text-[7px] text-neutral-500 text-center uppercase">{r.currency}</span>
          <span className="text-[8px] text-neutral-300 text-right tabular-nums">{fmtRate(r.rate)}%</span>
          <span className={`text-[8px] font-bold text-right tabular-nums ${bpsColor(r.change)}`}>
            {fmtBps(r.change)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Fed Funds Futures ──

function FedFundsFuturesSection({ contracts }: { contracts: any[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[#050505]">
        <div className="w-1 h-1 bg-amber-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
          Fed Funds Futures
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[72px_56px_56px_56px_56px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Contract</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Impl Rate</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Cut %</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Hold %</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Hike %</span>
      </div>

      {contracts.map((c: any) => (
        <div
          key={c.contract}
          className="grid grid-cols-[72px_56px_56px_56px_56px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors"
        >
          <span className="text-[8px] font-bold text-neutral-300">{c.contract}</span>
          <span className="text-[8px] text-neutral-300 text-right tabular-nums">{fmtRate(c.impliedRate)}%</span>
          <span className={`text-[8px] font-bold text-right tabular-nums ${probColor(c.cutProb)}`}>
            {c.cutProb.toFixed(1)}
          </span>
          <span className="text-[8px] text-neutral-400 text-right tabular-nums">
            {c.holdProb.toFixed(1)}
          </span>
          <span className={`text-[8px] font-bold text-right tabular-nums ${c.hikeProb > 0 ? 'text-red-400' : 'text-neutral-600'}`}>
            {c.hikeProb.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
