import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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

interface RoomCleanOptions { suction?: string; repeats: number }

export interface VacuumMapProps {
  cameraEntityId: string;
  suctionEntityId?: string;
  selectedRoomId?: number | null;
  onRoomClick?: (roomId: number) => void;
  onRoomClean?: (segmentId: number, options: RoomCleanOptions) => void;
  /** Base mirror/flip applied before rotationDeg */
  transform?: "none" | "mirrorH" | "mirrorV" | "rotate180";
  /** Additional clockwise rotation in degrees applied after transform */
  rotationDeg?: 0 | 90 | 180 | 270;
  /** Zoom factor: 1 = full map, 2 = 2× zoom in, 0.5 = zoom out */
  zoom?: number;
  /** Pan offset in SVG coordinate units */
  pan?: { x: number; y: number };
  /** Called with the new absolute pan offset after a drag */
  onPanChange?: (pan: { x: number; y: number }) => void;
  className?: string;
  showLabels?: boolean;
  showPopup?: boolean;
}

const ROOM_FILLS   = ["#dbeafe","#dcfce7","#fef3c7","#fce7f3","#e0e7ff","#fed7aa","#cffafe","#fef9c3"];
const ROOM_STROKES = ["#60a5fa","#4ade80","#fbbf24","#f472b6","#818cf8","#fb923c","#22d3ee","#facc15"];

function pickRoomIcon(name?: string): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (n.includes("baño")   || n.includes("bath"))    return "🛁";
  if (n.includes("cocina") || n.includes("kitchen"))  return "🍳";
  if (n.includes("living") || n.includes("sala"))     return "🛋️";
  if (n.includes("dormit") || n.includes("cuarto") || n.includes("habit") || n.includes("bedroom")) return "🛏️";
  if (n.includes("ofic")   || n.includes("office") || n.includes("escrit")) return "💻";
  if (n.includes("come")   || n.includes("dining"))  return "🍽️";
  if (n.includes("entrad") || n.includes("pasill") || n.includes("hall")) return "🚪";
  if (n.includes("balc")   || n.includes("terraz"))  return "🌿";
  return "";
}

function VacuumMapInner({
  cameraEntityId,
  suctionEntityId,
  selectedRoomId,
  onRoomClick,
  onRoomClean,
  transform   = "mirrorH",
  rotationDeg  = 0,
  zoom         = 1,
  pan,
  onPanChange,
  className    = "",
  showLabels  = true,
  showPopup   = false,
}: VacuumMapProps) {
  const { entity }             = useEntity(cameraEntityId);
  const { entity: suctionEnt } = useEntity(suctionEntityId ?? "");
  const attrs = entity?.attributes as Record<string, unknown> | undefined;

  const [svgRect,     setSvgRect]     = useState<{ width: number; height: number } | null>(null);
  const [popupSuction,setPopupSuction]= useState<string>("");
  const [popupRepeats,setPopupRepeats]= useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const dragStart   = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  // Ref (not state) so the click handler reads it synchronously before React re-renders
  const didDragRef  = useRef(false);

  // ── single memo: extract raw data → apply flip+rotation → compute viewBox → apply zoom ──
  const mapData = useMemo(() => {
    if (!attrs) return null;

    const roomsRaw = attrs.rooms as Record<string, Room> | Room[] | undefined;
    const rooms:     Room[]     = !roomsRaw ? [] : Array.isArray(roomsRaw) ? roomsRaw : Object.values(roomsRaw);
    const walls:     Wall[]     = (attrs.walls           as Wall[]     | undefined) ?? [];
    const noGo:      Area[]     = (attrs.no_go_areas     as Area[]     | undefined) ?? [];
    const noMop:     Area[]     = (attrs.no_mopping_areas as Area[]    | undefined) ?? [];
    const active:    Area[]     = (attrs.active_areas    as Area[]     | undefined) ?? [];
    const obstacles: Obstacle[] = (attrs.obstacles       as Obstacle[] | undefined) ?? [];
    const charger = attrs.charger_position as Point | undefined;
    const vacuum  = attrs.vacuum_position  as Point | undefined;

    // Collect raw bounds to determine pivot
    const rx: number[] = [];
    const ry: number[] = [];
    rooms.forEach(r    => { rx.push(r.x0, r.x1); ry.push(r.y0, r.y1); });
    walls.forEach(w    => { rx.push(w.x0, w.x1); ry.push(w.y0, w.y1); });
    [...noGo, ...noMop, ...active].forEach(a => {
      rx.push(a.x0, a.x1, a.x2, a.x3); ry.push(a.y0, a.y1, a.y2, a.y3);
    });
    if (charger)   { rx.push(charger.x); ry.push(charger.y); }
    if (vacuum)    { rx.push(vacuum.x);  ry.push(vacuum.y);  }
    obstacles.forEach(o => { rx.push(o.x); ry.push(o.y); });
    if (rx.length === 0) return null;

    // Pivot = center of raw bounding box
    const pcx = (Math.min(...rx) + Math.max(...rx)) / 2;
    const pcy = (Math.min(...ry) + Math.max(...ry)) / 2;

    const flipX = transform === "mirrorH" || transform === "rotate180";
    const flipY = transform === "mirrorV" || transform === "rotate180";

    // Combined transform: flip then rotate clockwise by rotationDeg
    const applyT = (x: number, y: number): [number, number] => {
      const fx = flipX ? 2 * pcx - x : x;
      const fy = flipY ? 2 * pcy - y : y;
      if (!rotationDeg) return [fx, fy];
      const dx = fx - pcx, dy = fy - pcy;
      if (rotationDeg === 90)  return [pcx + dy, pcy - dx];
      if (rotationDeg === 180) return [pcx - dx, pcy - dy];
      if (rotationDeg === 270) return [pcx - dy, pcy + dx];
      return [fx, fy];
    };

    const applyAngle = (a?: number): number | undefined => {
      if (a === undefined) return undefined;
      let angle = a;
      if (flipX && !flipY)  angle = (180 - angle + 360) % 360;  // mirrorH
      else if (flipY && !flipX) angle = (360 - angle) % 360;    // mirrorV
      else if (flipX && flipY)  angle = (angle + 180) % 360;    // rotate180
      return (angle - (rotationDeg ?? 0) + 360) % 360;
    };

    // Transform all elements
    const tRooms = rooms.map(r => {
      const corners: [number, number][] = [
        applyT(r.x0, r.y0), applyT(r.x0, r.y1),
        applyT(r.x1, r.y0), applyT(r.x1, r.y1),
      ];
      const xs = corners.map(c => c[0]);
      const ys = corners.map(c => c[1]);
      const [cx, cy] = r.x !== undefined && r.y !== undefined ? applyT(r.x, r.y)
        : [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      return { ...r, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), x: cx, y: cy };
    });
    const tWalls    = walls.map(w => { const [a, b] = applyT(w.x0, w.y0); const [c, d] = applyT(w.x1, w.y1); return { x0: a, y0: b, x1: c, y1: d }; });
    const tArea     = (a: Area) => { const [x0,y0]=applyT(a.x0,a.y0),[x1,y1]=applyT(a.x1,a.y1),[x2,y2]=applyT(a.x2,a.y2),[x3,y3]=applyT(a.x3,a.y3); return {x0,y0,x1,y1,x2,y2,x3,y3}; };
    const tNoGo     = noGo.map(tArea);
    const tNoMop    = noMop.map(tArea);
    const tActive   = active.map(tArea);
    const tObstacles= obstacles.map(o => { const [tx, ty] = applyT(o.x, o.y); return { ...o, x: tx, y: ty }; });
    const tCharger  = charger ? (() => { const [tx, ty] = applyT(charger.x, charger.y); return { ...charger, x: tx, y: ty, a: applyAngle(charger.a) }; })() : undefined;
    const tVacuum   = vacuum  ? (() => { const [tx, ty] = applyT(vacuum.x,  vacuum.y);  return { ...vacuum,  x: tx, y: ty, a: applyAngle(vacuum.a)  }; })() : undefined;

    // ViewBox from transformed content
    const tx: number[] = [];
    const ty: number[] = [];
    tRooms.forEach(r     => { tx.push(r.x0, r.x1); ty.push(r.y0, r.y1); });
    tWalls.forEach(w     => { tx.push(w.x0, w.x1); ty.push(w.y0, w.y1); });
    [...tNoGo,...tNoMop,...tActive].forEach(a => { tx.push(a.x0,a.x1,a.x2,a.x3); ty.push(a.y0,a.y1,a.y2,a.y3); });
    if (tCharger)  { tx.push(tCharger.x);  ty.push(tCharger.y);  }
    if (tVacuum)   { tx.push(tVacuum.x);   ty.push(tVacuum.y);   }
    tObstacles.forEach(o => { tx.push(o.x); ty.push(o.y); });

    const bw  = Math.max(...tx) - Math.min(...tx);
    const bh  = Math.max(...ty) - Math.min(...ty);
    const padX = bw * 0.06, padY = bh * 0.06;
    const baseVB = { x: Math.min(...tx) - padX, y: Math.min(...ty) - padY, w: bw + padX * 2, h: bh + padY * 2 };

    // Apply zoom (shrink viewBox around its center), then pan
    const z  = Math.max(0.1, Math.min(10, zoom ?? 1));
    const vb = {
      x: baseVB.x + (baseVB.w * (1 - 1 / z)) / 2 - (pan?.x ?? 0),
      y: baseVB.y + (baseVB.h * (1 - 1 / z)) / 2 - (pan?.y ?? 0),
      w: baseVB.w / z,
      h: baseVB.h / z,
    };

    return { viewBox: vb, rooms: tRooms, walls: tWalls, noGo: tNoGo, noMop: tNoMop, active: tActive, obstacles: tObstacles, charger: tCharger, vacuum: tVacuum };
  }, [attrs, transform, rotationDeg, zoom, pan]);

  // Callback ref: ResizeObserver on SVG element — no dep on map data to avoid loop
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setSvgRect(prev => (prev?.width === w && prev?.height === h ? prev : { width: w, height: h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  useEffect(() => () => { observerRef.current?.disconnect(); }, []);

  useEffect(() => {
    if (selectedRoomId == null) { setPopupRepeats(1); setPopupSuction(""); }
    else { setPopupSuction((suctionEnt?.state as string | undefined) ?? ""); setPopupRepeats(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId]);

  const suctionOptions = (suctionEnt?.attributes?.options as string[] | undefined) ?? [];

  // Drag handlers — convert pixel delta to SVG coordinate delta using the current viewBox
  const handlePointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    didDragRef.current = false;
    dragStart.current = { clientX: e.clientX, clientY: e.clientY, panX: pan?.x ?? 0, panY: pan?.y ?? 0 };
    setIsDragging(true);
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragStart.current || !mapData || !svgRect) return;
    const { clientX, clientY, panX, panY } = dragStart.current;
    const dx = e.clientX - clientX;
    const dy = e.clientY - clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true;
    // Scale pixel delta to SVG units using rendered size
    const vb = mapData.viewBox;
    const vbAspect = vb.w / vb.h;
    const ctxAspect = svgRect.width / svgRect.height;
    const renderedW = vbAspect > ctxAspect ? svgRect.width : svgRect.height * vbAspect;
    const renderedH = vbAspect > ctxAspect ? svgRect.width / vbAspect : svgRect.height;
    onPanChange?.({ x: panX + dx * (vb.w / renderedW), y: panY + dy * (vb.h / renderedH) });
  };

  const handlePointerUp = () => {
    dragStart.current = null;
    setIsDragging(false);
    // didDragRef stays true until next pointerDown; click fires synchronously after
    // pointerUp so it will read the correct ref value before we reset it
  };

  if (!entity) return (
    <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs p-4 ${className}`}>
      Cargando mapa...
    </div>
  );
  if (!mapData) return (
    <div className={`flex items-center justify-center bg-bg-tertiary text-text-secondary text-xs p-4 ${className}`}>
      Sin mapa guardado
    </div>
  );

  const { viewBox, rooms, walls, noGo, noMop, active, obstacles, charger, vacuum } = mapData;
  const maxDim     = Math.max(viewBox.w, viewBox.h);
  const wallStroke = maxDim * 0.012;
  const obstacleR  = maxDim * 0.008;
  const chargerR   = maxDim * 0.022;
  const vacuumR    = maxDim * 0.028;
  const dotSpacing = maxDim * 0.04;
  const dotR       = maxDim * 0.0025;

  const selectedRoom = selectedRoomId != null ? rooms.find(r => r.room_id === selectedRoomId) : undefined;

  let popupStyle: React.CSSProperties | undefined;
  if (showPopup && selectedRoom && svgRect && svgRect.width > 0 && svgRect.height > 0) {
    const vbAspect  = viewBox.w / viewBox.h;
    const ctxAspect = svgRect.width / svgRect.height;
    let renderedW: number, renderedH: number, offX: number, offY: number;
    if (vbAspect > ctxAspect) {
      renderedW = svgRect.width; renderedH = svgRect.width / vbAspect;
      offX = 0; offY = (svgRect.height - renderedH) / 2;
    } else {
      renderedH = svgRect.height; renderedW = svgRect.height * vbAspect;
      offX = (svgRect.width - renderedW) / 2; offY = 0;
    }
    const cxPx = offX + ((((selectedRoom.x0 + selectedRoom.x1) / 2) - viewBox.x) / viewBox.w) * renderedW;
    const cyPx = offY + ((((selectedRoom.y0 + selectedRoom.y1) / 2) - viewBox.y) / viewBox.h) * renderedH;
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
        className="w-full h-full block"
        style={{ background: "var(--color-bg-tertiary)", cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
          {rooms.map(room => {
            const id  = room.room_id ?? -1;
            const ci  = (room.color_index ?? id) % ROOM_FILLS.length;
            const sel = id === selectedRoomId;
            return (
              <rect key={`r-${id}`}
                x={room.x0} y={room.y0} width={room.x1 - room.x0} height={room.y1 - room.y0}
                rx={maxDim * 0.005}
                fill={sel ? "rgba(59,130,246,0.35)" : ROOM_FILLS[ci]}
                stroke={sel ? "rgb(37 99 235)" : ROOM_STROKES[ci]}
                strokeWidth={sel ? wallStroke * 0.8 : wallStroke * 0.4}
                onClick={() => { if (!didDragRef.current) onRoomClick?.(id); }}
                style={{ cursor: onRoomClick ? (isDragging ? "grabbing" : "pointer") : "default" }}
              />
            );
          })}
        </g>

        {showLabels && rooms.map(room => {
          const id   = room.room_id ?? -1;
          const cx   = room.x ?? (room.x0 + room.x1) / 2;
          const cy   = room.y ?? (room.y0 + room.y1) / 2;
          const size = Math.min(Math.max(Math.min(room.x1-room.x0, room.y1-room.y0) * 0.13, 180), 380);
          const icon = pickRoomIcon(room.name);
          return (
            <g key={`l-${id}`} pointerEvents="none">
              {icon && <text x={cx} y={cy - size * 0.7} textAnchor="middle" dominantBaseline="middle" fontSize={size * 1.4} style={{ userSelect: "none" }}>{icon}</text>}
              {room.name && <text x={cx} y={icon ? cy + size * 0.6 : cy} textAnchor="middle" dominantBaseline="middle" fontSize={size} fontWeight="600" fill="#1f2937" style={{ textTransform: "capitalize", userSelect: "none" }}>{room.name}</text>}
            </g>
          );
        })}

        {walls.map((w, i)  => <line key={`w-${i}`}  x1={w.x0} y1={w.y0} x2={w.x1} y2={w.y1} stroke="#1f2937" strokeWidth={wallStroke} strokeLinecap="round" />)}

        {noGo.map((a, i)   => <polygon key={`ng-${i}`}  points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`} fill="rgba(248,113,113,0.25)" stroke="rgb(220 38 38)"  strokeWidth={wallStroke*0.5} strokeDasharray={`${wallStroke*4} ${wallStroke*2}`} />)}
        {noMop.map((a, i)  => <polygon key={`nm-${i}`}  points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`} fill="rgba(96,165,250,0.25)"  stroke="rgb(37 99 235)"   strokeWidth={wallStroke*0.5} strokeDasharray={`${wallStroke*4} ${wallStroke*2}`} />)}
        {active.map((a, i) => <polygon key={`aa-${i}`}  points={`${a.x0},${a.y0} ${a.x1},${a.y1} ${a.x2},${a.y2} ${a.x3},${a.y3}`} fill="rgba(74,222,128,0.3)"   stroke="rgb(22 163 74)"   strokeWidth={wallStroke*0.5} />)}

        {obstacles.map((o, i) => (
          <circle key={`o-${i}`} cx={o.x} cy={o.y} r={obstacleR} fill="rgb(251 146 60)" stroke="rgb(194 65 12)" strokeWidth={wallStroke*0.25}>
            {o.type && <title>{o.type}</title>}
          </circle>
        ))}

        {charger && (
          <g transform={`translate(${charger.x},${charger.y})`}>
            <rect x={-chargerR} y={-chargerR*0.7} width={chargerR*2} height={chargerR*1.4} rx={chargerR*0.3} fill="#374151" stroke="#9ca3af" strokeWidth={wallStroke*0.3} />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={chargerR*1.2} fill="#fbbf24" fontWeight="700">⚡</text>
          </g>
        )}

        {vacuum && (
          <g transform={`translate(${vacuum.x},${vacuum.y}) rotate(${vacuum.a ?? 0})`}>
            <circle r={vacuumR}        fill="#e5e7eb" stroke="#374151" strokeWidth={wallStroke*0.5} />
            <circle r={vacuumR*0.55} cx={0} cy={-vacuumR*0.15} fill="#1f2937" />
            <circle r={vacuumR*0.22} cx={0} cy={-vacuumR*0.15} fill="#3b82f6" />
            <circle r={vacuumR*0.08} cx={0} cy={-vacuumR*0.15} fill="#dbeafe" />
            <path d={`M ${-vacuumR*0.4} ${vacuumR*0.55} L ${vacuumR*0.4} ${vacuumR*0.55}`} stroke="#6b7280" strokeWidth={wallStroke*0.6} strokeLinecap="round" />
          </g>
        )}
      </svg>

      {showPopup && selectedRoom && popupStyle && (
        <div className="absolute z-20 bg-bg-secondary border border-border-main rounded-xl shadow-2xl p-2.5 min-w-[180px] max-w-[240px]"
             style={popupStyle} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-primary capitalize truncate">
              {selectedRoom.name ?? `Habitación ${selectedRoom.room_id}`}
            </span>
            <button onClick={() => onRoomClick?.(selectedRoomId!)} className="p-0.5 rounded text-text-secondary hover:text-text-primary" aria-label="Cerrar"><X size={12} /></button>
          </div>

          {suctionOptions.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Succión</p>
              <div className="flex flex-wrap gap-1">
                {suctionOptions.map(opt => (
                  <button key={opt} onClick={() => setPopupSuction(opt)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${opt === popupSuction ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2.5">
            <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Pasadas</p>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setPopupRepeats(n)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${n === popupRepeats ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button onClick={launchClean}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-accent-green/20 text-accent-green text-xs font-medium hover:bg-accent-green/30 transition-all">
            <Play size={11} /> Limpiar
          </button>
        </div>
      )}
    </div>
  );
}

export const VacuumMap = memo(VacuumMapInner);
