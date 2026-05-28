import { memo, useMemo } from "react";
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

interface VacuumMapProps {
  cameraEntityId: string;
  selectedRoomId?: number | null;
  onRoomClick?: (roomId: number) => void;
  className?: string;
  showLabels?: boolean;
}

const ROOM_FILLS = [
  "#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3",
  "#e0e7ff", "#fed7aa", "#cffafe", "#fef9c3",
];
const ROOM_STROKES = [
  "#93c5fd", "#86efac", "#fcd34d", "#f9a8d4",
  "#a5b4fc", "#fdba74", "#67e8f9", "#fde047",
];

function VacuumMapInner({
  cameraEntityId,
  selectedRoomId,
  onRoomClick,
  className = "",
  showLabels = true,
}: VacuumMapProps) {
  const { entity } = useEntity(cameraEntityId);
  const attrs = entity?.attributes as Record<string, unknown> | undefined;

  const rooms = useMemo<Room[]>(() => {
    const raw = attrs?.rooms as Record<string, Room> | Room[] | undefined;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : Object.values(raw);
  }, [attrs?.rooms]);

  const walls = (attrs?.walls as Wall[] | undefined) ?? [];
  const noGoAreas = (attrs?.no_go_areas as Area[] | undefined) ?? [];
  const noMopAreas = (attrs?.no_mopping_areas as Area[] | undefined) ?? [];
  const activeAreas = (attrs?.active_areas as Area[] | undefined) ?? [];
  const obstacles = (attrs?.obstacles as Obstacle[] | undefined) ?? [];
  const chargerPos = attrs?.charger_position as Point | undefined;
  const vacuumPos = attrs?.vacuum_position as Point | undefined;

  const viewBox = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    rooms.forEach((r) => { xs.push(r.x0, r.x1); ys.push(r.y0, r.y1); });
    walls.forEach((w) => { xs.push(w.x0, w.x1); ys.push(w.y0, w.y1); });
    [...noGoAreas, ...noMopAreas, ...activeAreas].forEach((a) => {
      xs.push(a.x0, a.x1, a.x2, a.x3);
      ys.push(a.y0, a.y1, a.y2, a.y3);
    });
    if (chargerPos) { xs.push(chargerPos.x); ys.push(chargerPos.y); }
    if (vacuumPos) { xs.push(vacuumPos.x); ys.push(vacuumPos.y); }
    obstacles.forEach((o) => { xs.push(o.x); ys.push(o.y); });

    if (xs.length === 0 || ys.length === 0) return null;

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    const padX = w * 0.05;
    const padY = h * 0.05;
    return { x: minX - padX, y: minY - padY, w: w + padX * 2, h: h + padY * 2 };
  }, [rooms, walls, noGoAreas, noMopAreas, activeAreas, obstacles, chargerPos, vacuumPos]);

  if (!entity) {
    return (
      <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs ${className}`}>
        Cargando mapa...
      </div>
    );
  }
  if (!viewBox) {
    return (
      <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs p-4 ${className}`}>
        Sin mapa guardado
      </div>
    );
  }

  const wallStroke = Math.max(viewBox.w, viewBox.h) * 0.008;
  const obstacleR = Math.max(viewBox.w, viewBox.h) * 0.008;
  const chargerR = Math.max(viewBox.w, viewBox.h) * 0.018;
  const vacuumR = Math.max(viewBox.w, viewBox.h) * 0.025;

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-auto block ${className}`}
      style={{ background: "var(--color-bg-tertiary)" }}
    >
      {rooms.map((room) => {
        const id = room.room_id ?? -1;
        const ci = (room.color_index ?? 0) % ROOM_FILLS.length;
        const selected = id === selectedRoomId;
        const fill = selected ? "rgb(59 130 246 / 0.35)" : ROOM_FILLS[ci];
        const stroke = selected ? "rgb(59 130 246)" : ROOM_STROKES[ci];
        const cx = room.x ?? (room.x0 + room.x1) / 2;
        const cy = room.y ?? (room.y0 + room.y1) / 2;
        const w = room.x1 - room.x0;
        const h = room.y1 - room.y0;
        const labelSize = Math.min(Math.max(Math.min(w, h) * 0.12, 150), 400);
        return (
          <g key={id} onClick={() => onRoomClick?.(id)} style={{ cursor: onRoomClick ? "pointer" : "default" }}>
            <rect
              x={room.x0}
              y={room.y0}
              width={w}
              height={h}
              fill={fill}
              stroke={stroke}
              strokeWidth={selected ? wallStroke * 1.5 : wallStroke * 0.6}
            />
            {showLabels && room.name && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelSize}
                fontWeight="500"
                fill="#0f172a"
                pointerEvents="none"
                style={{ textTransform: "capitalize" }}
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

      {noGoAreas.map((a, i) => (
        <polygon
          key={`ng-${i}`}
          points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
          fill="rgb(248 113 113 / 0.25)"
          stroke="rgb(220 38 38)"
          strokeWidth={wallStroke * 0.5}
          strokeDasharray={`${wallStroke * 4} ${wallStroke * 2}`}
        />
      ))}

      {noMopAreas.map((a, i) => (
        <polygon
          key={`nm-${i}`}
          points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
          fill="rgb(96 165 250 / 0.25)"
          stroke="rgb(37 99 235)"
          strokeWidth={wallStroke * 0.5}
          strokeDasharray={`${wallStroke * 4} ${wallStroke * 2}`}
        />
      ))}

      {activeAreas.map((a, i) => (
        <polygon
          key={`aa-${i}`}
          points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`}
          fill="rgb(74 222 128 / 0.3)"
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
          strokeWidth={wallStroke * 0.3}
        >
          {o.type && <title>{o.type}</title>}
        </circle>
      ))}

      {chargerPos && (
        <g transform={`translate(${chargerPos.x}, ${chargerPos.y})`}>
          <circle r={chargerR} fill="rgb(34 197 94)" stroke="#fff" strokeWidth={wallStroke * 0.3} />
          <text
            x={0} y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={chargerR * 1.2}
            fill="#fff"
            fontWeight="700"
            pointerEvents="none"
          >
            ⚡
          </text>
        </g>
      )}

      {vacuumPos && (
        <g transform={`translate(${vacuumPos.x}, ${vacuumPos.y}) rotate(${vacuumPos.a ?? 0})`}>
          <circle r={vacuumR} fill="rgb(59 130 246)" stroke="#fff" strokeWidth={wallStroke * 0.4} />
          <polygon
            points={`0,${-vacuumR * 0.6} ${vacuumR * 0.5},${vacuumR * 0.4} ${-vacuumR * 0.5},${vacuumR * 0.4}`}
            fill="#fff"
          />
        </g>
      )}
    </svg>
  );
}

export const VacuumMap = memo(VacuumMapInner);
