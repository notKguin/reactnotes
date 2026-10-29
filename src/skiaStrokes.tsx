import { Path, Skia } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import type { Point, Stroke } from './types';

function skPath(points: Point[], ox: number, oy: number) {
  const path = Skia.PathBuilder.Make();
  if (points.length === 0) return path.detach();
  const x0 = points[0].x - ox;
  const y0 = points[0].y - oy;
  path.moveTo(x0, y0);
  if (points.length === 1) {
    path.lineTo(x0 + 0.1, y0 + 0.1);
    return path.detach();
  }
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x - ox, points[i].y - oy);
  }
  return path.detach();
}

function ink(
  key: string,
  points: Point[],
  color: string,
  width: number,
  opacity: number,
  ox: number,
  oy: number,
) {
  return (
    <Path
      key={key}
      path={skPath(points, ox, oy)}
      color={color}
      style="stroke"
      strokeWidth={width}
      strokeCap="round"
      strokeJoin="round"
      opacity={opacity}
    />
  );
}

export function renderSkiaStroke(stroke: Stroke, ox = 0, oy = 0): ReactNode[] {
  const points = stroke.points;
  const opacity = stroke.opacity ?? 1;
  if (points.length === 0) return [];

  if (points.length === 1) {
    const w = points[0].width ?? stroke.width;
    return [ink(`${stroke.id}-dot`, points, stroke.color, w, opacity, ox, oy)];
  }

  const firstW = points[0].width ?? stroke.width;
  const uniform = points.every((p) => Math.abs((p.width ?? stroke.width) - firstW) < 0.35);
  if (uniform) {
    return [ink(stroke.id, points, stroke.color, firstW, opacity, ox, oy)];
  }

  const parts = [];
  let bucketPoints: Point[] = [points[0]];
  let bucketW = Math.round((points[0].width ?? stroke.width) / 0.8) * 0.8;

  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    const w = Math.round((p.width ?? stroke.width) / 0.8) * 0.8;
    bucketPoints.push(p);
    if (Math.abs(w - bucketW) >= 0.8 && i < points.length - 1) {
      parts.push(ink(`${stroke.id}-${i}`, bucketPoints, stroke.color, bucketW, opacity, ox, oy));
      bucketPoints = [p];
      bucketW = w;
    }
  }

  if (bucketPoints.length >= 2) {
    parts.push(ink(`${stroke.id}-tail`, bucketPoints, stroke.color, bucketW, opacity, ox, oy));
  }

  return parts;
}
