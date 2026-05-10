import { useEntity } from "../../hooks/useEntity";
import { Zap } from "lucide-react";

interface EnergyChartProps {
  actualEntityId?: string;
  puntaEntityId?: string;
  llanoEntityId?: string;
  valleEntityId?: string;
  gastoEntityId?: string;
  deudaEntityId?: string;
}

export function EnergyChart({
  actualEntityId = "sensor.ute_8647965855_consumo_actual",
  puntaEntityId = "sensor.ute_8647965855_consumo_punta",
  llanoEntityId = "sensor.ute_8647965855_consumo_llano",
  valleEntityId = "sensor.ute_8647965855_consumo_valle",
  gastoEntityId = "sensor.ute_8647965855_gasto_actual",
  deudaEntityId = "sensor.ute_8647965855_deuda_total",
}: EnergyChartProps) {
  const actual = useEntity(actualEntityId);
  const punta = useEntity(puntaEntityId);
  const llano = useEntity(llanoEntityId);
  const valle = useEntity(valleEntityId);
  const gasto = useEntity(gastoEntityId);
  const deuda = useEntity(deudaEntityId);

  const entities = [actual, punta, llano, valle, gasto, deuda];
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
    { label: "Punta", value: punta.entity?.state, color: "bg-accent-red" },
    { label: "Llano", value: llano.entity?.state, color: "bg-accent-yellow" },
    { label: "Valle", value: valle.entity?.state, color: "bg-accent-green" },
  ];

  const maxConsumption = Math.max(
    ...consumptionData.map(d => parseFloat(d.value || "0")),
    0.1
  );

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-accent-yellow" />
          <h3 className="text-white font-semibold">Energía UTE</h3>
        </div>
        <span className="text-sm text-gray-400">
          {actual.entity?.state ?? "—"} W
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {consumptionData.map((d) => {
          const numValue = parseFloat(d.value || "0");
          const pct = (numValue / maxConsumption) * 100;
          return (
            <div key={d.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">{d.label}</span>
                <span className="text-white font-medium">{numValue.toFixed(1)} kWh</span>
              </div>
              <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${d.color}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bg-tertiary">
        <div>
          <p className="text-xs text-gray-500">Gasto actual</p>
          <p className="text-lg font-semibold text-white">
            {gasto.entity?.state ? `$${parseFloat(gasto.entity.state).toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Deuda total</p>
          <p className="text-lg font-semibold text-accent-red">
            {deuda.entity?.state ? `$${parseFloat(deuda.entity.state).toFixed(2)}` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
