import { useState } from 'react';
import { GlassCard } from '../common/glass-card';
import {
  useAlerts,
  useCreateAlert,
  useUpdateAlert,
  useDeleteAlert,
  type Alert,
} from '../../api/hooks/use-alerts';
import { useMt5Symbols, useMt5Quotes } from '../../api/hooks/use-mt5';
import { SymbolPicker } from '../trading/symbol-picker';
import { fmtPrice } from '../trading/mt5-trading';
import { useT } from '../../i18n';
import { Bell, Plus, Trash2, ChevronUp } from 'lucide-react';

// Evaluated server-side on every live MT5 bid; one-shot (firing disables the alert)
const ALERT_TYPES = [
  { value: 'price_cross', key: 'priceCross' },
  { value: 'price_change_pct', key: 'priceChangePct' },
] as const;

type AlertType = typeof ALERT_TYPES[number]['value'];

const inputCls = 'bg-black/40 border border-border/50 px-2 py-1 text-mini font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50';

function AlertRow({ alert: a, onToggle, onDelete }: {
  alert: Alert;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const typeKey = ALERT_TYPES.find((x) => x.value === a.type)?.key;
  let condition = a.condition;
  try {
    const c = JSON.parse(a.condition);
    if (a.type === 'price_cross') condition = `${t(c.direction === 'below' ? 'below' : 'above')} ${fmtPrice(c.price)}`;
    else if (a.type === 'price_change_pct') condition = `±${c.pct}% · ${fmtPrice(c.basePrice)}`;
  } catch {
    // legacy/invalid JSON: show raw
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-border/10 hover:bg-accent/[0.04] transition-colors ${
        !a.enabled ? 'opacity-40' : ''
      }`}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`w-6 h-3 rounded-full relative transition-colors shrink-0 ${
          a.enabled ? 'bg-bullish/60' : 'bg-neutral/20'
        }`}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-all ${
            a.enabled ? 'left-3' : 'left-0.5'
          }`}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-mini font-mono font-bold text-gray-200 truncate">{a.name}</span>
          {a.triggerCount > 0 && (
            <span className="px-1 py-0.5 text-micro font-mono font-bold bg-accent/20 text-accent-ink border border-accent/30 shrink-0">
              {a.triggerCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-micro font-mono text-neutral/40 uppercase">{typeKey ? t(typeKey) : a.type}</span>
          {a.symbol && (
            <span className="text-micro font-mono text-accent-ink/60">{a.symbol}</span>
          )}
          <span className="text-micro font-mono text-neutral/30 truncate">{condition}</span>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1 text-neutral/30 hover:text-bearish transition-colors shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function CreateAlertForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState<AlertType>('price_cross');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [value, setValue] = useState('');
  const { data: symbols } = useMt5Symbols();
  const bid = useMt5Quotes(symbol ? [symbol] : []).data?.[symbol]?.bid;
  const createAlert = useCreateAlert();

  const num = Number(value);
  const valid = !!name.trim() && !!symbol && value.trim() !== '' && num > 0;

  const handleSubmit = () => {
    if (!valid) return;
    createAlert.mutate(
      type === 'price_cross'
        ? { name: name.trim(), type, symbol, direction, price: num }
        : { name: name.trim(), type, symbol, pct: num },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="px-3 py-2 bg-accent/5 border-b border-accent/20 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-mini font-mono font-bold text-accent-ink uppercase tracking-wider">
          {t('newAlert')}
        </span>
        <button onClick={onClose} className="text-neutral/40 hover:text-white transition-colors">
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('alertName')}
        className={`w-full ${inputCls}`}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-mono text-neutral/40 uppercase">{t('alertTypeLabel')}</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as AlertType); setValue(''); }}
            className={`${inputCls} appearance-none`}
          >
            {ALERT_TYPES.map((at) => (
              <option key={at.value} value={at.value}>{t(at.key)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-mono text-neutral/40 uppercase">{t('symbol')}</label>
          <SymbolPicker symbols={symbols ?? []} value={symbol} onSelect={setSymbol} placeholder="EURUSD" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className="flex justify-between text-micro font-mono text-neutral/40 uppercase">
          <span>{t('condition')}</span>
          {bid != null && <span className="normal-case">Bid {fmtPrice(bid)}</span>}
        </label>
        {type === 'price_cross' ? (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'above' | 'below')}
              className={`${inputCls} appearance-none`}
            >
              <option value="above">{t('above')}</option>
              <option value="below">{t('below')}</option>
            </select>
            <input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={bid != null ? fmtPrice(bid) : t('price')}
              aria-label={t('price')}
              className={inputCls}
            />
          </div>
        ) : (
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="±% e.g. 0.5"
            aria-label={t('priceChangePct')}
            className={`w-full ${inputCls}`}
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!valid || createAlert.isPending}
        className="w-full py-1.5 bg-accent/20 text-accent-ink text-mini font-mono font-bold uppercase tracking-wider hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {createAlert.isPending ? t('creating') : t('createAlert')}
      </button>

      {createAlert.isError && (
        <p role="alert" className="text-micro font-mono text-bearish">{createAlert.error.message}</p>
      )}
    </div>
  );
}

export function AlertsPanel() {
  const t = useT();
  const [showCreate, setShowCreate] = useState(false);
  const { data: alerts, isLoading, error } = useAlerts();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Bell className="w-3 h-3" />
          {t('alerts')}
        </span>
      }
      headerRight={
        <div className="flex items-center gap-2">
          <span className="text-micro font-mono text-neutral/50">
            {alerts?.length ?? 0}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-0.5 text-neutral hover:text-accent-ink transition-colors"
          >
            {showCreate ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
      className="h-full"
    >
      {/* Create form */}
      {showCreate && <CreateAlertForm onClose={() => setShowCreate(false)} />}

      {/* Re-enabling re-arms server-side and can be refused (e.g. price already past the level) */}
      {updateAlert.isError && (
        <p role="alert" className="px-3 py-1 border-b border-border/10 text-micro font-mono text-bearish">
          {updateAlert.error.message}
        </p>
      )}

      {/* Alert list */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-mini font-mono text-neutral/40 uppercase tracking-widest">
            {t('loading')}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-mini font-mono text-bearish/60 uppercase tracking-widest">
            {t('failedToLoadAlerts')}
          </div>
        )}
        {!isLoading && !error && (!alerts || alerts.length === 0) && (
          <div className="flex items-center justify-center py-8 text-mini font-mono text-neutral/40 uppercase tracking-widest">
            {t('noAlertsConfigured')}
          </div>
        )}
        {alerts?.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onToggle={() => updateAlert.mutate({ id: alert.id, enabled: !alert.enabled })}
            onDelete={() => deleteAlert.mutate(alert.id)}
          />
        ))}
      </div>
    </GlassCard>
  );
}
