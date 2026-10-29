import type { Point, ShapeKind, Stroke } from './types';

export type SmoothingLevel = number;

export function dist(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return dist(p, a);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist(p, b);
  const t = c1 / c2;
  return dist(p, { x: a.x + t * vx, y: a.y + t * vy });
}

/** Удаляет целиком любой штрих/фигуру, которой коснулся ластик. */
export function eraseStrokesWhole(
  strokes: Stroke[],
  point: Point,
  radius: number,
): Stroke[] {
  let changed = false;
  const result: Stroke[] = [];

  for (const stroke of strokes) {
    const pts = stroke.points;
    let hit = false;
    for (let i = 0; i < pts.length; i += 1) {
      if (dist(pts[i], point) <= radius) {
        hit = true;
        break;
      }
      if (i > 0 && distToSegment(point, pts[i - 1], pts[i]) <= radius) {
        hit = true;
        break;
      }
    }
    if (hit) {
      changed = true;
    } else {
      result.push(stroke);
    }
  }

  return changed ? result : strokes;
}

/**
 * Частичное стирание: предварительно мелко дробит длинные отрезки (например у фигур),
 * чтобы стирался только кусок под курсором, а не вся сторона/фигура.
 */
function densifyPoints(points: Point[], maxStep = 6): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const d = dist(a, b);
    if (d > maxStep) {
      const steps = Math.ceil(d / maxStep);
      for (let s = 1; s < steps; s += 1) {
        const t = s / steps;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          width: b.width ?? a.width,
        });
      }
    }
    out.push(b);
  }
  return out;
}

export function eraseStrokesPartial(
  strokes: Stroke[],
  point: Point,
  radius: number,
): Stroke[] {
  let changed = false;
  const result: Stroke[] = [];

  for (const stroke of strokes) {
    const rawPts = stroke.points;
    if (rawPts.length === 1) {
      if (dist(rawPts[0], point) > radius) {
        result.push(stroke);
      } else {
        changed = true;
      }
      continue;
    }
    if (rawPts.length < 2) continue;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < rawPts.length; i += 1) {
      const p = rawPts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (
      point.x < minX - radius ||
      point.x > maxX + radius ||
      point.y < minY - radius ||
      point.y > maxY + radius
    ) {
      result.push(stroke);
      continue;
    }

    const pts = densifyPoints(rawPts, 5);
    const segments: Point[][] = [];
    let current: Point[] = [];
    let strokeHit = false;

    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (dist(p, point) <= radius) {
        strokeHit = true;
        if (current.length >= 2) segments.push(current);
        current = [];
      } else {
        current.push(p);
      }
    }
    if (current.length >= 2) segments.push(current);

    if (!strokeHit) {
      result.push(stroke);
      continue;
    }

    changed = true;
    for (const points of segments) {
      result.push({
        ...stroke,
        id: uid('stroke'),
        points,
      });
    }
  }

  return changed ? result : strokes;
}

export function pressureToWidth(baseWidth: number, pressure?: number | null) {
  if (pressure == null || Number.isNaN(pressure)) return baseWidth;
  const p = Math.min(1, Math.max(0.05, pressure));
  return Math.max(1, baseWidth * (0.35 + p * 1.4));
}

function chaikinOnce(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const w0 = p0.width;
    const w1 = p1.width;
    const wA = w0 != null && w1 != null ? w0 * 0.75 + w1 * 0.25 : w0 ?? w1;
    const wB = w0 != null && w1 != null ? w0 * 0.25 + w1 * 0.75 : w1 ?? w0;
    out.push(
      { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y, width: wA },
      { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y, width: wB },
    );
  }
  out.push(points[points.length - 1]);
  return out;
}

function movingAverageOnce(points: Point[], weight: number): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const avgX = (a.x + c.x) * 0.5;
    const avgY = (a.y + c.y) * 0.5;
    const w0 = a.width ?? b.width;
    const w1 = b.width;
    const w2 = c.width ?? b.width;
    const avgW =
      w0 != null && w1 != null && w2 != null ? (w0 + w1 * 2 + w2) * 0.25 : w1;
    out.push({
      x: b.x * (1 - weight) + avgX * weight,
      y: b.y * (1 - weight) + avgY * weight,
      width: avgW,
    });
  }
  out.push(points[points.length - 1]);
  return out;
}

function decimatePoints(points: Point[], minStep: number): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (dist(out[out.length - 1], points[i]) >= minStep) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function smoothPoints(points: Point[], level: SmoothingLevel): Point[] {
  const clamped = Math.max(0, Math.min(100, level));
  if (clamped <= 0 || points.length < 3) return points;

  const minStep = 1.1 + (clamped / 100) * 2.4;
  let current = decimatePoints(points, minStep);
  if (current.length < 3) return points;

  const weight = 0.28 + (clamped / 100) * 0.62;
  const avgPasses = clamped >= 65 ? 2 : 1;
  for (let i = 0; i < avgPasses; i += 1) {
    current = movingAverageOnce(current, weight);
  }
  if (clamped >= 40) current = chaikinOnce(current);
  return current;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const ccw = (p1: Point, p2: Point, p3: Point) =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function strokeInsidePolygon(stroke: Stroke, polygon: Point[]): boolean {
  const pts = stroke.points;
  if (pts.length === 0 || polygon.length < 3) return false;

  for (const p of pts) {
    if (pointInPolygon(p, polygon)) return true;
  }

  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pointInPolygon(mid, polygon)) return true;
    for (let j = 0; j < polygon.length; j += 1) {
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }

  return false;
}

export function strokeInsideRect(
  stroke: Stroke,
  start: Point,
  end: Point,
): boolean {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const rectPoly: Point[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  return strokeInsidePolygon(stroke, rectPoly);
}

export function boundsOfStrokes(strokes: Stroke[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (strokes.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxW = 4;
  for (const s of strokes) {
    if (s.width > maxW) maxW = s.width;
    for (const p of s.points) {
      if (p.width && p.width > maxW) maxW = p.width;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const pad = Math.ceil(maxW / 2) + 8;
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(24, maxX - minX + pad * 2),
    height: Math.max(24, maxY - minY + pad * 2),
  };
}

function strokeBBox(stroke: Stroke) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

export function strokesTouchOrIntersect(a: Stroke, b: Stroke): boolean {
  const pad = (a.width + b.width) / 2 + 5;
  const ba = strokeBBox(a);
  const bb = strokeBBox(b);
  if (
    ba.maxX + pad < bb.minX ||
    bb.maxX + pad < ba.minX ||
    ba.maxY + pad < bb.minY ||
    bb.maxY + pad < ba.minY
  ) {
    return false;
  }

  const ptsA = a.points;
  const ptsB = b.points;
  for (let i = 0; i < ptsA.length; i += 1) {
    const p = ptsA[i];
    for (let j = 0; j < ptsB.length; j += 1) {
      const q = ptsB[j];
      if (dist(p, q) <= pad) return true;
      if (j > 0 && distToSegment(p, ptsB[j - 1], q) <= pad) return true;
    }
    if (i > 0) {
      const p0 = ptsA[i - 1];
      for (let j = 1; j < ptsB.length; j += 1) {
        if (segmentsIntersect(p0, p, ptsB[j - 1], ptsB[j])) return true;
        if (distToSegment(ptsB[j], p0, p) <= pad) return true;
      }
    }
  }
  return false;
}

/**
 * Группирует все пересекающиеся штрихи в связные компоненты (единые фигуры).
 * Если ластик разрезал фигуру на две непересекающиеся части — они получат разные groupId.
 */
export function regroupIntersectingStrokes(strokes: Stroke[]): Stroke[] {
  const n = strokes.length;
  if (n === 0) return strokes;

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    let c = x;
    while (c !== r) {
      const nxt = parent[c];
      parent[c] = r;
      c = nxt;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (strokesTouchOrIntersect(strokes[i], strokes[j])) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const list = buckets.get(r);
    if (list) list.push(i);
    else buckets.set(r, [i]);
  }

  const usedGroupIds = new Set<string>();
  const out = [...strokes];

  for (const indices of buckets.values()) {
    let chosenId: string | undefined;
    let maxZ = 1;
    for (const idx of indices) {
      const gid = strokes[idx].groupId;
      if (gid && !usedGroupIds.has(gid) && !chosenId) {
        chosenId = gid;
      }
      const z = strokes[idx].zIndex ?? 1;
      if (z > maxZ) maxZ = z;
    }
    if (!chosenId) chosenId = uid('grp');
    usedGroupIds.add(chosenId);

    for (const idx of indices) {
      out[idx] = {
        ...strokes[idx],
        groupId: chosenId,
        zIndex: maxZ,
      };
    }
  }

  return out;
}

export function findStrokeGroupAtPoint(
  strokes: Stroke[],
  point: Point,
  extraRadius = 10,
): string | null {
  for (let sIdx = strokes.length - 1; sIdx >= 0; sIdx -= 1) {
    const s = strokes[sIdx];
    const r = s.width / 2 + extraRadius;
    const pts = s.points;
    for (let i = 0; i < pts.length; i += 1) {
      if (dist(pts[i], point) <= r) return s.groupId ?? s.id;
      if (i > 0 && distToSegment(point, pts[i - 1], pts[i]) <= r) {
        return s.groupId ?? s.id;
      }
    }
  }
  return null;
}

export function transformSelectedStrokes(
  strokes: Stroke[],
  selectedIds: Set<string>,
  params: {
    dx: number;
    dy: number;
    scale: number;
    rotationDeg: number;
    cx: number;
    cy: number;
  },
): Stroke[] {
  const { dx, dy, scale, rotationDeg, cx, cy } = params;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return strokes.map((s) => {
    if (!selectedIds.has(s.id)) return s;
    return {
      ...s,
      width: Math.max(1, s.width * scale),
      points: s.points.map((p) => {
        const rx = (p.x - cx) * scale;
        const ry = (p.y - cy) * scale;
        const tx = rx * cos - ry * sin + cx + dx;
        const ty = rx * sin + ry * cos + cy + dy;
        return {
          ...p,
          x: tx,
          y: ty,
          width: p.width != null ? Math.max(1, p.width * scale) : undefined,
        };
      }),
    };
  });
}

function regularPolygon(
  sides: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  startAngle = -Math.PI / 2,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= sides; i += 1) {
    const a = startAngle + (i / sides) * Math.PI * 2;
    out.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
      width,
    });
  }
  return densifyPoints(out, 6);
}

export function buildShapePoints(
  kind: ShapeKind,
  start: Point,
  end: Point,
  width: number,
): Point[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const w = Math.max(8, maxX - minX);
  const h = Math.max(8, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = w / 2;
  const ry = h / 2;

  if (kind === 'line' || kind === 'dashedLine') {
    return densifyPoints(
      [
        { x: start.x, y: start.y, width },
        { x: end.x, y: end.y, width },
      ],
      kind === 'dashedLine' ? 14 : 6,
    );
  }

  if (kind === 'arrow' || kind === 'doubleArrow') {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, width * 3.2);
    const a1 = angle - Math.PI * 0.82;
    const a2 = angle + Math.PI * 0.82;
    const p1 = { x: end.x + Math.cos(a1) * head, y: end.y + Math.sin(a1) * head, width };
    const p2 = { x: end.x + Math.cos(a2) * head, y: end.y + Math.sin(a2) * head, width };
    const pts: Point[] = [];
    if (kind === 'doubleArrow') {
      const b1 = angle + Math.PI - Math.PI * 0.82;
      const b2 = angle + Math.PI + Math.PI * 0.82;
      pts.push(
        { x: start.x + Math.cos(b1) * head, y: start.y + Math.sin(b1) * head, width },
        { x: start.x, y: start.y, width },
        { x: start.x + Math.cos(b2) * head, y: start.y + Math.sin(b2) * head, width },
      );
    }
    pts.push(
      { x: start.x, y: start.y, width },
      { x: end.x, y: end.y, width },
      p1,
      { x: end.x, y: end.y, width },
      p2,
    );
    return densifyPoints(pts, 6);
  }

  if (kind === 'rect') {
    return densifyPoints(
      [
        { x: minX, y: minY, width },
        { x: maxX, y: minY, width },
        { x: maxX, y: maxY, width },
        { x: minX, y: maxY, width },
        { x: minX, y: minY, width },
      ],
      6,
    );
  }

  if (kind === 'roundedRect') {
    const r = Math.min(rx, ry, Math.max(12, Math.min(w, h) * 0.22));
    const out: Point[] = [];
    const corners = [
      { x: maxX - r, y: minY + r, a0: -Math.PI / 2, a1: 0 },
      { x: maxX - r, y: maxY - r, a0: 0, a1: Math.PI / 2 },
      { x: minX + r, y: maxY - r, a0: Math.PI / 2, a1: Math.PI },
      { x: minX + r, y: minY + r, a0: Math.PI, a1: (Math.PI * 3) / 2 },
    ];
    for (const c of corners) {
      for (let s = 0; s <= 6; s += 1) {
        const a = c.a0 + (s / 6) * (c.a1 - c.a0);
        out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, width });
      }
    }
    out.push(out[0]);
    return densifyPoints(out, 6);
  }

  if (kind === 'triangle') {
    return densifyPoints(
      [
        { x: cx, y: minY, width },
        { x: maxX, y: maxY, width },
        { x: minX, y: maxY, width },
        { x: cx, y: minY, width },
      ],
      6,
    );
  }

  if (kind === 'rightTriangle') {
    return densifyPoints(
      [
        { x: minX, y: minY, width },
        { x: maxX, y: maxY, width },
        { x: minX, y: maxY, width },
        { x: minX, y: minY, width },
      ],
      6,
    );
  }

  if (kind === 'diamond') {
    return regularPolygon(4, cx, cy, rx, ry, width);
  }
  if (kind === 'pentagon') {
    return regularPolygon(5, cx, cy, rx, ry, width);
  }
  if (kind === 'hexagon') {
    return regularPolygon(6, cx, cy, rx, ry, width);
  }
  if (kind === 'octagon') {
    return regularPolygon(8, cx, cy, rx, ry, width, Math.PI / 8);
  }

  if (kind === 'star') {
    const out: Point[] = [];
    const spikes = 5;
    for (let i = 0; i <= spikes * 2; i += 1) {
      const rFactor = i % 2 === 0 ? 1 : 0.45;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      out.push({
        x: cx + Math.cos(a) * rx * rFactor,
        y: cy + Math.sin(a) * ry * rFactor,
        width,
      });
    }
    return densifyPoints(out, 6);
  }

  if (kind === 'heart') {
    const out: Point[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      );
      out.push({
        x: cx + (hx / 16) * rx,
        y: cy + (hy / 16) * ry,
        width,
      });
    }
    return densifyPoints(out, 6);
  }

  if (kind === 'cloud') {
    const out: Point[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      const bump = 1 + 0.18 * Math.sin(6 * t);
      out.push({
        x: cx + Math.cos(t) * rx * bump,
        y: cy + Math.sin(t) * ry * bump,
        width,
      });
    }
    return densifyPoints(out, 6);
  }

  if (kind === 'callout') {
    const bodyBottom = minY + h * 0.78;
    return densifyPoints(
      [
        { x: minX, y: minY, width },
        { x: maxX, y: minY, width },
        { x: maxX, y: bodyBottom, width },
        { x: minX + w * 0.45, y: bodyBottom, width },
        { x: minX + w * 0.25, y: maxY, width },
        { x: minX + w * 0.28, y: bodyBottom, width },
        { x: minX, y: bodyBottom, width },
        { x: minX, y: minY, width },
      ],
      6,
    );
  }

  if (kind === 'checkmark') {
    return densifyPoints(
      [
        { x: minX, y: minY + h * 0.55, width },
        { x: minX + w * 0.36, y: maxY, width },
        { x: maxX, y: minY, width },
      ],
      6,
    );
  }

  if (kind === 'cross') {
    return densifyPoints(
      [
        { x: minX, y: minY, width },
        { x: maxX, y: maxY, width },
        { x: cx, y: cy, width },
        { x: maxX, y: minY, width },
        { x: minX, y: maxY, width },
      ],
      6,
    );
  }

  if (kind === 'wave') {
    const out: Point[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      out.push({
        x: start.x + (end.x - start.x) * t,
        y: cy + Math.sin(t * Math.PI * 4) * ry,
        width,
      });
    }
    return out;
  }

  if (kind === 'bracket') {
    return densifyPoints(
      [
        { x: maxX, y: minY, width },
        { x: cx, y: minY, width },
        { x: cx, y: cy - h * 0.08, width },
        { x: minX, y: cy, width },
        { x: cx, y: cy + h * 0.08, width },
        { x: cx, y: maxY, width },
        { x: maxX, y: maxY, width },
      ],
      6,
    );
  }

  // ellipse
  const out: Point[] = [];
  const steps = 44;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    out.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
      width,
    });
  }
  return out;
}
