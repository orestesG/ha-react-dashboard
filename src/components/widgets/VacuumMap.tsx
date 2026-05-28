import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { useEntity } from "../../hooks/useEntity";

interface Point { x: number; y: number; a?: number }
interface Room {
  room_id?: number;
  x0: number; y0: number; x1: number; y1: number;
  x?: number; y?: number;
  name?: string;
  color_index?: number;
}
interface Wall { x0: number; y0: number; x1: number; y1: number }
interface Area {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}
interface Obstacle { x: number; y: number; type?: string }

interface RoomCleanOptions {
  suction?: string;
  repeats: number;
}

interface VacuumMapProps {
  cameraEntityId: string;
  suctionEntityId?: string;
  selectedRoomId?: number | null;
  onRoomClick?: (roomId: number) => void;
  onRoomClean?: (segmentId: number, options: RoomCleanOptions) => void;
  rotation?: 0 | 90 | 180 | 270;
  className?: string;
  showLabels?: boolean;
  showPopup?: boolean;
}

const ROOM_FILLS = [
  "#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3",
  "#e0e7ff", "#fed7aa", "#cffafe", "#fef9c3",
];
const ROOM_STROKES = [
  "#60a5fa", "#4ade80", "#fbbf24", "#f472b6",
  "#818cf8", "#fb923c", "#22d3ee", "#facc15",
];

function pickRoomIcon(name?: string): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (n.includes("baño") || n.includes("bath")) return "🛁";
  if (n.includes("cocina") || n.includes("kitchen")) return "🍳";
  if (n.includes("living") || n.includes("sala")) return "🛋️";
  if (n.includes("dormit") || n.includes("cuarto") || n.includes("habit") || n.includes("bedroom")) return "🛏️";
  if (n.includes("ofic") || n.includes("office") || n.includes("escrit")) return "💻";
  if (n.includes("come") || n.includes("dining")) return "🍽️";
  if (n.includes("entrad") || n.includes("pasill") || n.includes("hall")) return "🚪";
  if (n.includes("balc") || n.includes("terraz")) return "🌿";
  return "";
}

function VacuumMapInner({
  cameraEntityId,
  suctionEntityId,
  selectedRoomId,
  onRoomClick,
  onRoomClean,
  rotation = 180,
  className = "",
  showLabels = true,
  showPopup = false,
}: VacuumMapProps) {
  const { entity } = useEntity(cameraEntityId);
  const { entity: suctionEnt } = useEntity(suctionEntityId ?? "");
  const attrs = entity?.attributes as Record<string, unknown> | undefined;

  const [svgRect, setSvgRect] = useState<{ width: number; height: number; left: number; top: number } | null>(null);
  const [popupSuction, setPopupSuction] = useState<string>("");
  const [popupRepeats, setPopupRepeats] = useState(1);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<SVGSVGElement | null>(null);

  // Consolidate all map data extraction + flip into a single memo depending only on attrs.
  // Inline `?? []` expressions outside of useMemo would create new array refs every render,
  // which previously thrashed downstream memos and triggered an infinite re-render loop.
  const mapData = useMemo(() => {
    if (!attrs) return null;

    const roomsRaw = attrs.rooms as Record<string, Room> | Room[] | undefined;
    const rooms: Room[] = !roomsRaw
      ? []
      : Array.isArray(roomsRaw)
      ? roomsRaw
      : Object.values(roomsRaw);
    const walls = (attrs.walls as Wall[] | undefined) ?? [];
    const noGo = (attrs.no_go_areas as Area[] | undefined) ?? [];
    const noMop = (attrs.no_mopping_areas as Area[] | undefined) ?? [];
    const active = (attrs.active_areas as Area[] | undefined) ?? [];
    const obstacles = (attrs.obstacles as Obstacle[] | undefined) ?? [];
    const charger = attrs.charger_position as Point | undefined;
    const vacuum = attrs.vacuum_position as Point | undefined;

    const xs: number[] = [];
    const ys: number[] = [];
    rooms.forEach((r) => { xs.push(r.x0, r.x1); ys.push(r.y0, r.y1); });
    walls.forEach((w) => { xs.push(w.x0, w.x1); ys.push(w.y0, w.y1); });
    [...noGo, ...noMop, ...active].forEach((a) => {
      xs.push(a.x0, a.x1, a.x2, a.x3);
      ys.push(a.y0, a.y1, a.y2, a.y3);
    });
    if (charger) { xs.push(charger.x); ys.push(charger.y); }
    if (vacuum) { xs.push(vacuum.x); ys.push(vacuum.y); }
    obstacles.forEach((o) => { xs.push(o.x); ys.push(o.y); });

    if (xs.length === 0 || ys.length === 0) return null;

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    const padX = w * 0.06;
    const padY = h * 0.06;
    const viewBox = { x: minX - padX, y: minY - padY, w: w + padX * 2, h: h + padY * 2 };

    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    const flip = rotation === 180;
    const fx = (x: number) => (flip ? 2 * cx - x : x);
    const fy = (y: number) => (flip ? 2 * cy - y : y);
    const fa = (a?: number) => (a === undefined ? undefined : flip ? (a + 180) % 360 : a);

    return {
      viewBox,
      rooms: rooms.map((r) => ({
        ...r,
        x0: Math.min(fx(r.x0), fx(r.x1)),
        x1: Math.max(fx(r.x0), fx(r.x1)),
        y0: Math.min(fy(r.y0), fy(r.y1)),
        y1: Math.max(fy(r.y0), fy(r.y1)),
        x: r.x !== undefined ? fx(r.x) : undefined,
        y: r.y !== undefined ? fy(r.y) : undefined,
      })),
      walls: walls.map((w2) => ({ x0: fx(w2.x0), y0: fy(w2.y0), x1: fx(w2.x1), y1: fy(w2.y1) })),
      noGo: noGo.map((a) => ({
        x0: fx(a.x0), y0: fy(a.y0), x1: fx(a.x1), y1: fy(a.y1),
        x2: fx(a.x2), y2: fy(a.y2), x3: fx(a.x3), y3: fy(a.y3),
      })),
      noMop: noMop.map((a) => ({
        x0: fx(a.x0), y0: fy(a.y0), x1: fx(a.x1), y1: fy(a.y1),
        x2: fx(a.x2), y2: fy(a.y2), x3: fx(a.x3), y3: fy(a.y3),
      })),
      active: active.map((a) => ({
        x0: fx(a.x0), y0: fy(a.y0), x1: fx(a.x1), y1: fy(a.y1),
        x2: fx(a.x2), y2: fy(a.y2), x3: fx(a.x3), y3: fy(a.y3),
      })),
      obstacles: obstacles.map((o) => ({ ...o, x: fx(o.x), y: fy(o.y) })),
      charger: charger ? { ...charger, x: fx(charger.x), y: fy(charger.y), a: fa(charger.a) } : undefined,
      vacuum: vacuum ? { ...vacuum, x: fx(vacuum.x), y: fy(vacuum.y), a: fa(vacuum.a) } : undefined,
    };
  }, [attrs, rotation]);

  // Callback ref: attach observer when SVG mounts, detach on unmount. No dep on map data.
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    elementRef.current = el;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSvgRect((prev) => {
        if (prev && prev.width === r.width && prev.height === r.height && prev.left === r.left && prev.top === r.top) {
          return prev;
        }
        return { width: r.width, height: r.height, left: r.left, top: r.top };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // Reset popup defaults only when the selection changes.
  useEffect(() => {
    if (selectedRoomId == null) {
      setPopupRepeats(1);
      setPopupSuction("");
    } else {
      const fallback = (suctionEnt?.state as string | undefined) ?? "";
      setPopupSuction(fallback);
      setPopupRepeats(1);
    }
    // intentionally exclude suctionEnt to avoid resetting on every entity tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId]);

  const suctionOptions = (suctionEnt?.attributes?.options as string[] | undefined) ?? [];

  if (!entity) {
    return (
      <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs p-4 ${className}`}>
        Cargando mapa...
      </div>
    );
  }
  if (!mapData) {
    return (
      <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs p-4 ${className}`}>
        Sin mapa guardado
      </div>
    );
  }

  const { viewBox, rooms, walls, noGo, noMop, active, obstacles, charger, vacuum } = mapData;
  const maxDim = Math.max(viewBox.w, viewBox.h);
  const wallStroke = maxDim * 0.012;
  const obstacleR = maxDim * 0.008;
  const chargerR = maxDim * 0.022;
  const vacuumR = maxDim * 0.028;
  const dotSpacing = maxDim * 0.04;
  const dotR = maxDim * 0.0025;

  const selectedRoom = selectedRoomId != null ? rooms.find((r) => r.room_id === selectedRoomId) : undefined;

  let popupStyle: React.CSSProperties | undefined;
  if (showPopup && selectedRoom && svgRect && svgRect.width > 0 && svgRect.height > 0) {
    const vbAspect = viewBox.w / viewBox.h;
    const containerAspect = svgRect.width / svgRect.height;
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (vbAspect > containerAspect) {
      renderedW = svgRect.width;
      renderedH = svgRect.width / vbAspect;
      offsetX = 0;
      offsetY = (svgRect.height - renderedH) / 2;
    } else {
      renderedH = svgRect.height;
      renderedW = svgRect.height * vbAspect;
      offsetX = (svgRect.width - renderedW) / 2;
      offsetY = 0;
    }
    const cxMm = (selectedRoom.x0 + selectedRoom.x1) / 2;
    const cyMm = (selectedRoom.y0 + selectedRoom.y1) / 2;
    const cxPx = offsetX + ((cxMm - viewBox.x) / viewBox.w) * renderedW;
    const cyPx = offsetY + ((cyMm - viewBox.y) / viewBox.h) * renderedH;
    popupStyle = { left: `${cxPx}px`, top: `${cyPx}px`, transform: "translate(-50%, -50%)" };
  }

  const launchClean = () => {
    if (!onRoomClean || selectedRoomId == null) return;
    onRoomClean(selectedRoomId, { suction: popupSuction || undefined, repeats: popupRepeats });
  };

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto block"
        style={{ background: "var(--color-bg-tertiary)" }}
      >
        <defs>
          <pattern id="map-grid" width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
            <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR} fill="#9ca3af" opacity="0.35" />
          </pattern>
          <filter id="room-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy={wallStroke * 0.2} stdDeviation={wallStroke * 0.3} floodOpacity="0.15" />
          </filter>
        </defs>

        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#map-grid)" />

        <g filter="url(#room-shadow)">
          {rooms.map((room) => {
            const id = room.room_id ?? -1;
            const ci = (room.color_index ?? id) % ROOM_FILLS.length;
            const selected = id === selectedRoomId;
            const fill = selected ? "rgba(59,130,246,0.35)" : ROOM_FILLS[ci];
            const stroke = selected ? "rgb(37 99 235)" : ROOM_STROKES[ci];
            const w = room.x1 - room.x0;
            const h = room.y1 - room.y0;
            return (
              <rect
                key={`r-${id}`}
                x={room.x0}
                y={room.y0}
                width={w}
                height={h}
                rx={maxDim * 0.005}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? wallStroke * 0.8 : wallStroke * 0.4}
                onClick={() => onRoomClick?.(id)}
                style={{ cursor: onRoomClick ? "pointer" : "default" }}
              />
            );
          })}
        </g>

        {showLabels && rooms.map((room) => {
          const id = room.room_id ?? -1;
          const cx = room.x ?? (room.x0 + room.x1) / 2;
          const cy = room.y ?? (room.y0 + room.y1) / 2;
          const w = room.x1 - room.x0;
          const h = room.y1 - room.y0;
          const labelSize = Math.min(Math.max(Math.min(w, h) * 0.13, 180), 380);
          const icon = pickRoomIcon(room.name);
          return (
            <g key={`l-${id}`} pointerEvents="none">
              {icon && (
                <text
                  x={cx}
                  y={cy - labelSize * 0.7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelSize * 1.4}
                  style={{ userSelect: "none" }}
                >
                  {icon}
                </text>
              )}
              {room.name && (
                <text
                  x={cx}
                  y={icon ? cy + labelSize * 0.6 : cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelSize}
                  fontWeight="600"
                  fill="#1f2937"
                  style={{ textTransform: "capitalize", userSelect: "none" }}
                >
                  {room.name}
                </text>
              )}
            </g>
          );
        })}

        {walls.map((w, i) => (
          <line
            key={`w-${i}`}
            x1={w.x0} y1={w.y0} x2={w.x1} y2={w.y1}
            stroke="#1f2937"
            strokeWidth={wallStroke}
            strokeLinecap="round"
          />
        ))}

        {noGo.map((a, i) => (
          <polygon
            key={`ng-${i}`}
            points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
            fill="rgba(248,113,113,0.25)"
            stroke="rgb(220 38 38)"
            strokeWidth={wallStroke * 0.5}
            strokeDasharray={`${wallStroke * 4} ${wallStroke * 2}`}
          />
        ))}

        {noMop.map((a, i) => (
          <polygon
            key={`nm-${i}`}
            points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
            fill="rgba(96,165,250,0.25)"
            stroke="rgb(37 99 235)"
            strokeWidth={wallStroke * 0.5}
            strokeDasharray={`${wallStroke * 4} ${wallStroke * 2}`}
          />
        ))}

        {active.map((a, i) => (
          <polygon
            key={`aa-${i}`}
            points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
            fill="rgba(74,222,128,0.3)"
            stroke="rgb(22 163 74)"
            strokeWidth={wallStroke * 0.5}
          />
        ))}

        {obstacles.map((o, i) => (
          <circle
            key={`o-${i}`}
            cx={o.x} cy={o.y} r={obstacleR}
            fill="rgb(251 146 60)"
            stroke="rgb(194 65 12)"
            strokeWidth={wallStroke * 0.25}
          >
            {o.type && <title>{o.type}</title>}
          </circle>
        ))}

        {charger && (
          <g transform={`translate(${charger.x}, ${charger.y})`}>
            <rect
              x={-chargerR} y={-chargerR * 0.7}
              width={chargerR * 2} height={chargerR * 1.4}
              rx={chargerR * 0.3}
              fill="#374151"
              stroke="#9ca3af"
              strokeWidth={wallStroke * 0.3}
            />
            <text
              x={0} y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={chargerR * 1.2}
              fill="#fbbf24"
              fontWeight="700"
            >
              ⚡
            </text>
          </g>
        )}

        {vacuum && (
          <g transform={`translate(${vacuum.x}, ${vacuum.y}) rotate(${vacuum.a ?? 0})`}>
            <circle r={vacuumR} fill="#e5e7eb" stroke="#374151" strokeWidth={wallStroke * 0.5} />
            <circle r={vacuumR * 0.55} cx={0} cy={-vacuumR * 0.15} fill="#1f2937" />
            <circle r={vacuumR * 0.22} cx={0} cy={-vacuumR * 0.15} fill="#3b82f6" />
            <circle r={vacuumR * 0.08} cx={0} cy={-vacuumR * 0.15} fill="#dbeafe" />
            <path
              d={`M ${-vacuumR * 0.4} ${vacuumR * 0.55} L ${vacuumR * 0.4} ${vacuumR * 0.55}`}
              stroke="#6b7280"
              strokeWidth={wallStroke * 0.6}
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {showPopup && selectedRoom && popupStyle && (
        <div
          className="absolute z-20 bg-bg-secondary border border-border-main rounded-xl shadow-2xl p-2.5 min-w-[180px] max-w-[240px]"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-primary capitalize truncate">
              {selectedRoom.name ?? `Habitación ${selectedRoom.room_id}`}
            </span>
            <button
              onClick={() => onRoomClick?.(selectedRoomId!)}
              className="p-0.5 rounded text-text-secondary hover:text-text-primary"
              aria-label="Cerrar"
            >
              <X size={12} />
            </button>
          </div>

          {suctionOptions.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Succión</p>
              <div className="flex flex-wrap gap-1">
                {suctionOptions.map((opt) => {
                  const active = opt === popupSuction;
                  return (
                    <button
                      key={opt}
                      onClick={() => setPopupSuction(opt)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${
                        active
                          ? "bg-accent-blue/20 text-accent-blue"
                          : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-2.5">
            <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Pasadas</p>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => {
                const active = n === popupRepeats;
                return (
                  <button
                    key={n}
                    onClick={() => setPopupRepeats(n)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      active
                        ? "bg-accent-blue/20 text-accent-blue"
                        : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={launchClean}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-accent-green/20 text-accent-green text-xs font-medium hover:bg-accent-green/30 transition-all"
          >
            <Play size={11} /> Limpiar
          </button>
        </div>
      )}
    </div>
  );
}

export const VacuumMap = memo(VacuumMapInner);
