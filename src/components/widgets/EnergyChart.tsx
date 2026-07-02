import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useEntity } from "../../hooks/useEntity";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useCollapseStore } from "../../store/collapse-store";

// Accent colours are fixed Tailwind hex values (not CSS vars), so use the literals
// directly — `var(--color-accent-*)` does not resolve as an SVG/inline style colour.
const TARIFF_COLORS: Record<string, string> = {
  Punta: "#ef4444", // accent-red
  Llano: "#eab308", // accent-yellow
  Valle: "#10b981", // accent-green
};

function fmtProxima(isoStr: string | undefined): string {
  if (!isoStr || isoStr === 'unavailable' || isoStr === 'unknown') return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const time = d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === new Date(now.getTime() + 86_400_000).toDateString()) return `mañana ${time}`;
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }) + ' ' + time;
}

interface EnergyChartProps {
  actualEntityId?: string;
  puntaEntityId?: string;
  llanoEntityId?: string;
  valleEntityId?: string;
  gastoEntityId?: string;
  deudaEntityId?: string;
  historialEntityId?: string;
  facturacionEntityId?: string;
  proximaEntityId?: string;
}

export function EnergyChart({
  actualEntityId = "sensor.ute_8647965855_consumo_actual",
  puntaEntityId = "sensor.ute_8647965855_consumo_punta",
  llanoEntityId = "sensor.ute_8647965855_consumo_llano",
  valleEntityId = "sensor.ute_8647965855_consumo_valle",
  gastoEntityId = "sensor.ute_8647965855_gasto_actual",
  deudaEntityId = "sensor.ute_8647965855_deuda_total",
  historialEntityId = "sensor.ute_8647965855_historial_mensual",
  facturacionEntityId = "sensor.ute_8647965855_historial_facturacion",
  proximaEntityId = "sensor.ute_8647965855_proxima_actualizacion",
}: EnergyChartProps) {
  const actual = useEntity(actualEntityId);
  const punta = useEntity(puntaEntityId);
  const llano = useEntity(llanoEntityId);
  const valle = useEntity(valleEntityId);
  const gasto = useEntity(gastoEntityId);
  const deuda = useEntity(deudaEntityId);
  const historial = useEntity(historialEntityId);
  const facturacion = useEntity(facturacionEntityId);
  const proxima = useEntity(proximaEntityId);

  const entities = [actual, punta, llano, valle, gasto, deuda, historial, facturacion, proxima];
  const loading = entities.some(e => e.loading);

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary animate-pulse space-y-3">
        <div className="h-6 w-32 rounded bg-gray-600" />
        <div className="h-24 rounded bg-gray-600" />
      </div>
    );
  }

  const consumptionData = [
    { label: "Punta", value: parseFloat(punta.entity?.state || "0") },
    { label: "Llano", value: parseFloat(llano.entity?.state || "0") },
    { label: "Valle", value: parseFloat(valle.entity?.state || "0") },
  ];

  const totalConsumption = consumptionData.reduce((sum, d) => sum + d.value, 0);

  let rawHistory: { month: string; kwh: number }[] = [];
  try {
    if (historial.state && historial.state !== "unavailable") {
      rawHistory = JSON.parse(historial.state);
    }
  } catch {
    // state no es JSON válido
  }

  // Historial de facturación: monto real por ciclo de cierre (ver Ute2MQTT).
  // Se mapea por la misma clave "YYYY-MM" que monthly_history.
  let rawBilling: { cycle: string; amount: number }[] = [];
  try {
    if (facturacion.state && facturacion.state !== "unavailable") {
      rawBilling = JSON.parse(facturacion.state);
    }
  } catch {
    // state no es JSON válido
  }
  const billedByCycle = new Map(rawBilling.map((b) => [b.cycle, b.amount]));

  // Estimado del mes en curso (cuando aún no hay factura): current_spending.
  const currentEstimate = gasto.entity?.state ? parseFloat(gasto.entity.state) : null;

  const sortedHistory = [...rawHistory].sort((a, b) => a.month.localeCompare(b.month));
  const historyData = sortedHistory.map(({ month, kwh }, i) => {
    const billed = billedByCycle.get(month);
    const isLast = i === sortedHistory.length - 1;
    // Mes cerrado y facturado → monto real. Mes en curso sin factura → estimado.
    const estimated = billed == null;
    const amount = billed != null ? billed : isLast ? currentEstimate : null;
    return {
      kwh,
      amount,
      estimated,
      label: new Date(month + "-01").toLocaleDateString("es-UY", {
        month: "short",
        year: "2-digit",
      }),
    };
  });

  const fmtMoney = (v: number) =>
    `$${Math.round(v).toLocaleString("es-UY")}`;

  // Etiqueta de monto sobre cada barra ($ real, o ≈$ si es estimado).
  const renderAmountLabel = (props: {
    x?: number; y?: number; width?: number; index?: number;
  }) => {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const d = historyData[index];
    if (!d || d.amount == null) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={d.estimated ? "var(--color-text-secondary)" : "var(--color-accent-yellow)"}
      >
        {d.estimated ? `≈${fmtMoney(d.amount)}` : fmtMoney(d.amount)}
      </text>
    );
  };

  const toggleEnergy = useCollapseStore((s) => s.toggle);
  const energyCollapsed = useCollapseStore((s) => s.isCollapsed('energy'));

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-accent-yellow" />
          <h3 className="text-text-primary font-semibold">Energía UTE</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{actual.entity?.state ?? "—"} W</span>
          <button onClick={() => toggleEnergy('energy')} className="p-1 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            {energyCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!energyCollapsed && <><div className="space-y-2 mb-4">
        {consumptionData.map((d) => {
          const pct = totalConsumption > 0 ? (d.value / totalConsumption) * 100 : 0;
          return (
            <div key={d.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">{d.label}</span>
                <span className="text-text-primary font-medium tabular-nums">
                  {d.value.toFixed(1)} kWh
                  <span className="text-text-secondary/60 text-xs ml-1.5">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%`, background: TARIFF_COLORS[d.label] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border-main">
        <div>
          <p className="text-xs text-text-secondary">Gasto actual</p>
          <p className="text-lg font-semibold text-text-primary">
            {gasto.entity?.state ? `$${parseFloat(gasto.entity.state).toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Deuda total</p>
          <p className="text-lg font-semibold text-accent-red">
            {deuda.entity?.state ? `$${parseFloat(deuda.entity.state).toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Próxima actualiz.</p>
          <p className="text-lg font-semibold text-text-primary tabular-nums">
            {fmtProxima(proxima.entity?.state)}
          </p>
        </div>
      </div>

      {historyData.length > 0 && (
        <div className="pt-3 border-t border-border-main">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-text-secondary">Historial mensual</p>
            <p className="text-[10px] text-text-secondary/70">kWh · gasto facturado</p>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={historyData} barCategoryGap="25%" margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) => `${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border-main)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v, _name, item) => {
                  const d = item?.payload as (typeof historyData)[number] | undefined;
                  if (d?.amount != null) {
                    const money = d.estimated ? `≈${fmtMoney(d.amount)} estimado` : fmtMoney(d.amount);
                    return [`${v ?? 0} kWh · ${money}`, "Consumo · gasto"];
                  }
                  return [`${v ?? 0} kWh`, "Consumo"];
                }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar dataKey="kwh" radius={[3, 3, 0, 0]}>
                {historyData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.estimated ? "rgba(234,179,8,0.30)" : "var(--color-accent-yellow)"}
                    stroke={d.estimated ? "var(--color-accent-yellow)" : undefined}
                    strokeWidth={d.estimated ? 1 : 0}
                    strokeDasharray={d.estimated ? "3 2" : undefined}
                  />
                ))}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="amount" content={renderAmountLabel as never} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      </>}
    </div>
  );
}
