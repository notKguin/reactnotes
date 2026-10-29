import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { getBackground } from '../../backgrounds';
import type { BackgroundId } from '../../types';

type Props = {
  background: BackgroundId;
  paperColor?: string;
  lineColor?: string;
  width: number;
  height: number;
};

export const BackgroundLayer = memo(function BackgroundLayer({
  background,
  paperColor,
  lineColor,
  width,
  height,
}: Props) {
  const tpl = getBackground(background);
  const paper = paperColor || tpl.paper;
  const line = lineColor || tpl.line;

  return (
    <View style={[styles.root, { width, height, backgroundColor: paper }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={paper} />

        {(background === 'lined' || background === 'kraft' || background === 'dark') &&
          Array.from({ length: Math.ceil(height / 32) }, (_, i) => (
            <Line
              key={`l-${i}`}
              x1={24}
              y1={48 + i * 32}
              x2={width - 24}
              y2={48 + i * 32}
              stroke={line}
              strokeWidth={1}
            />
          ))}

        {background === 'wideLined' &&
          Array.from({ length: Math.ceil(height / 48) }, (_, i) => (
            <Line
              key={`wl-${i}`}
              x1={24}
              y1={56 + i * 48}
              x2={width - 24}
              y2={56 + i * 48}
              stroke={line}
              strokeWidth={1.2}
            />
          ))}

        {background === 'grid' && (
          <>
            {Array.from({ length: Math.ceil(width / 28) }, (_, i) => (
              <Line
                key={`gx-${i}`}
                x1={i * 28}
                y1={0}
                x2={i * 28}
                y2={height}
                stroke={line}
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: Math.ceil(height / 28) }, (_, i) => (
              <Line
                key={`gy-${i}`}
                x1={0}
                y1={i * 28}
                x2={width}
                y2={i * 28}
                stroke={line}
                strokeWidth={1}
              />
            ))}
          </>
        )}

        {background === 'dots' &&
          Array.from({ length: Math.ceil(height / 24) }, (_, row) =>
            Array.from({ length: Math.ceil(width / 24) }, (_, col) => (
              <Circle
                key={`d-${row}-${col}`}
                cx={12 + col * 24}
                cy={12 + row * 24}
                r={1.5}
                fill={line}
              />
            )),
          )}

        {background === 'isometric' &&
          Array.from({ length: Math.ceil(height / 22) }, (_, row) =>
            Array.from({ length: Math.ceil(width / 26) }, (_, col) => (
              <Circle
                key={`iso-${row}-${col}`}
                cx={(row % 2 === 0 ? 12 : 25) + col * 26}
                cy={14 + row * 22}
                r={1.4}
                fill={line}
              />
            )),
          )}

        {background === 'cornell' && (
          <>
            <Line x1={24} y1={96} x2={width - 24} y2={96} stroke={line} strokeWidth={1.5} />
            <Line
              x1={Math.round(width * 0.3)}
              y1={96}
              x2={Math.round(width * 0.3)}
              y2={height - 140}
              stroke={line}
              strokeWidth={1.5}
            />
            <Line
              x1={24}
              y1={height - 140}
              x2={width - 24}
              y2={height - 140}
              stroke={line}
              strokeWidth={1.5}
            />
            {Array.from({ length: Math.max(0, Math.floor((height - 260) / 32)) }, (_, i) => (
              <Line
                key={`c-${i}`}
                x1={Math.round(width * 0.3) + 12}
                y1={128 + i * 32}
                x2={width - 24}
                y2={128 + i * 32}
                stroke={line}
                strokeWidth={1}
              />
            ))}
          </>
        )}

        {background === 'music' &&
          Array.from({ length: Math.floor(height / 110) }, (_, staff) =>
            Array.from({ length: 5 }, (__, l) => {
              const y = 48 + staff * 110 + l * 10;
              return (
                <Line
                  key={`m-${staff}-${l}`}
                  x1={24}
                  y1={y}
                  x2={width - 24}
                  y2={y}
                  stroke={line}
                  strokeWidth={1}
                />
              );
            }),
          )}

        {background === 'checklist' &&
          Array.from({ length: Math.ceil(height / 40) }, (_, i) => {
            const y = 44 + i * 40;
            return (
              <Line
                key={`cl-${i}`}
                x1={56}
                y1={y + 18}
                x2={width - 24}
                y2={y + 18}
                stroke={line}
                strokeWidth={1}
              />
            );
          })}
        {background === 'checklist' &&
          Array.from({ length: Math.ceil(height / 40) }, (_, i) => {
            const y = 44 + i * 40;
            return (
              <Rect
                key={`cb-${i}`}
                x={26}
                y={y + 4}
                width={16}
                height={16}
                rx={4}
                stroke={line}
                strokeWidth={1.3}
                fill="none"
              />
            );
          })}

        {background === 'columns' && (
          <>
            <Line
              x1={width / 2}
              y1={24}
              x2={width / 2}
              y2={height - 24}
              stroke={line}
              strokeWidth={1.5}
            />
            {Array.from({ length: Math.ceil(height / 32) }, (_, i) => (
              <Line
                key={`col-${i}`}
                x1={24}
                y1={48 + i * 32}
                x2={width - 24}
                y2={48 + i * 32}
                stroke={line}
                strokeWidth={1}
              />
            ))}
          </>
        )}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
});
