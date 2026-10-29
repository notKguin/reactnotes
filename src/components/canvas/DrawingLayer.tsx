import { memo, useMemo } from 'react';
import { Canvas, DashPathEffect, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { renderSkiaStroke } from '../../skiaStrokes';
import type { Point, Stroke } from '../../types';

type LassoBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  strokes: Stroke[];
  lassoPath?: Point[] | null;
  lassoBox?: LassoBox | null;
  width: number;
  height: number;
};

function lassoOutline(points: Point[]) {
  const path = Skia.PathBuilder.Make();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y);
  }
  path.close();
  return path.detach();
}

export const DrawingLayer = memo(function DrawingLayer({
  strokes,
  lassoPath,
  lassoBox,
  width,
  height,
}: Props) {
  const ink = useMemo(() => strokes.flatMap((stroke) => renderSkiaStroke(stroke)), [strokes]);
  const lasso = lassoPath && lassoPath.length > 1 ? lassoOutline(lassoPath) : null;

  return (
    <Canvas
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
      pointerEvents="none"
    >
      {ink}
      {lasso ? <Path path={lasso} color="rgba(63,63,70,0.06)" style="fill" /> : null}
      {lasso ? (
        <Path path={lasso} color="#3F3F46" style="stroke" strokeWidth={1.5}>
          <DashPathEffect intervals={[6, 4]} />
        </Path>
      ) : null}
      {lassoBox ? (
        <RoundedRect
          x={lassoBox.x}
          y={lassoBox.y}
          width={lassoBox.width}
          height={lassoBox.height}
          r={6}
          color="rgba(39,39,42,0.05)"
        />
      ) : null}
      {lassoBox ? (
        <RoundedRect
          x={lassoBox.x}
          y={lassoBox.y}
          width={lassoBox.width}
          height={lassoBox.height}
          r={6}
          color="#27272A"
          style="stroke"
          strokeWidth={1.5}
        >
          <DashPathEffect intervals={[6, 4]} />
        </RoundedRect>
      ) : null}
    </Canvas>
  );
});

type LiveInkProps = {
  path: SharedValue<SkPath>;
  color: SharedValue<string>;
  width: SharedValue<number>;
  opacity: SharedValue<number>;
  pageWidth: number;
  pageHeight: number;
};

export function LiveInk({ path, color, width, opacity, pageWidth, pageHeight }: LiveInkProps) {
  return (
    <Canvas
      style={{ position: 'absolute', left: 0, top: 0, width: pageWidth, height: pageHeight }}
      pointerEvents="none"
    >
      <Path
        path={path}
        color={color}
        style="stroke"
        strokeWidth={width}
        opacity={opacity}
        strokeCap="round"
        strokeJoin="round"
      />
    </Canvas>
  );
}
