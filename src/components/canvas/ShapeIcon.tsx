import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { buildShapePoints } from '../../strokeUtils';
import type { Point, ShapeKind } from '../../types';

function toPath(points: Point[]) {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

export const ShapeIcon = memo(function ShapeIcon({
  kind,
  size = 26,
  color = '#27272A',
}: {
  kind: ShapeKind;
  size?: number;
  color?: string;
}) {
  const pad = 4;
  const d = useMemo(() => {
    const pts = buildShapePoints(
      kind,
      { x: pad, y: pad },
      { x: size - pad, y: size - pad },
      1.8,
    );
    return toPath(pts);
  }, [kind, size]);

  return (
    <Svg width={size} height={size}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={1.8}
        strokeDasharray={kind === 'dashedLine' ? '3 2.5' : undefined}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});
