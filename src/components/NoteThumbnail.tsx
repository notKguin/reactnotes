import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { getBackground } from '../backgrounds';
import { PAGE } from '../theme';
import type { Note, Point } from '../types';

const THUMB_W = 56;
const THUMB_H = 72;

function toMiniPath(points: Point[], sx: number, sy: number) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const x = points[0].x * sx;
    const y = points[0].y * sy;
    return `M ${x} ${y} L ${x + 0.5} ${y + 0.5}`;
  }
  const [first, ...rest] = points;
  return `M ${first.x * sx} ${first.y * sy} ${rest
    .map((p) => `L ${p.x * sx} ${p.y * sy}`)
    .join(' ')}`;
}

export function NoteThumbnail({ note }: { note: Note }) {
  const bg = getBackground(note.background);
  const paper = note.paperColor || bg.paper;
  const sx = THUMB_W / (note.pageWidth || PAGE.minWidthTablet);
  const sy = THUMB_H / (note.pageHeight || PAGE.minHeight);

  const visibleLayerIds = new Set(
    (note.layers ?? []).filter((l) => l.visible !== false).map((l) => l.id),
  );
  const defaultLayerId = note.layers?.[0]?.id;

  const visibleStrokes = note.strokes.filter((s) =>
    visibleLayerIds.size === 0 ? true : visibleLayerIds.has(s.layerId ?? defaultLayerId ?? ''),
  );
  const visibleElements = note.elements.filter((el) =>
    visibleLayerIds.size === 0 ? true : visibleLayerIds.has(el.layerId ?? defaultLayerId ?? ''),
  );

  return (
    <View style={[styles.box, { backgroundColor: paper }]}>
      <Svg width={THUMB_W} height={THUMB_H}>
        <Rect x={0} y={0} width={THUMB_W} height={THUMB_H} fill={paper} />
        {visibleStrokes.slice(0, 40).map((s) => (
          <Path
            key={s.id}
            d={toMiniPath(s.points, sx, sy)}
            stroke={s.color}
            strokeWidth={Math.max(1, s.width * sx * 1.4)}
            strokeOpacity={s.opacity ?? 1}
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {visibleElements.slice(0, 12).map((el) => (
          <Rect
            key={el.id}
            x={el.x * sx}
            y={el.y * sy}
            width={Math.max(6, el.width * sx)}
            height={el.type === 'text' ? 6 : Math.max(6, (el.height ?? 60) * sy)}
            rx={2}
            fill={
              el.type === 'sticker'
                ? el.tone
                : el.type === 'image'
                  ? '#A1A1AA'
                  : el.color || bg.ink
            }
            opacity={el.type === 'text' ? 0.35 : 0.75}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4E4E0',
  },
});
