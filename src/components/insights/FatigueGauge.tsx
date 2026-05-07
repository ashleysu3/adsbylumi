import { fatigueZoneColors, gaugeAngle, type FatigueLevel } from '@/lib/fatigue';

interface FatigueGaugeProps {
  frequency: number | null | undefined;
  level: FatigueLevel;
  size?: number;
}

/**
 * Plain-English creative fatigue gauge — like a car's oil-temp dial.
 * 180° semicircle, green → yellow → orange → red, with a needle at
 * the campaign's current frequency. Threshold ticks at 2.5 / 3.5 / 4.5
 * mirror the bands defined in lib/fatigue.ts.
 */
export function FatigueGauge({ frequency, level, size = 180 }: FatigueGaugeProps) {
  const w = size;
  const h = size / 2 + 28; // arc + room for caption
  const cx = w / 2;
  const cy = size / 2 + 4;
  const r = size / 2 - 12;

  // Build colored arc segments. Each band corresponds to a fatigue level.
  // Boundaries (in frequency units, scale 0–6): 0, 2.5, 3.5, 4.5, 6
  const bands: Array<{ from: number; to: number; color: string }> = [
    { from: 0, to: 2.5, color: fatigueZoneColors.none },
    { from: 2.5, to: 3.5, color: fatigueZoneColors.early },
    { from: 3.5, to: 4.5, color: fatigueZoneColors.building },
    { from: 4.5, to: 6, color: fatigueZoneColors.high },
  ];

  const polar = (deg: number, radius = r) => {
    // 0° = far left (180° in standard math), 180° = far right (0° in math)
    const rad = ((180 - deg) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  const arcPath = (startDeg: number, endDeg: number) => {
    const s = polar(startDeg);
    const e = polar(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needleDeg = gaugeAngle(frequency);
  const needleEnd = polar(needleDeg, r - 6);
  const f = typeof frequency === 'number' && frequency > 0 ? frequency : 0;
  const needleColor = fatigueZoneColors[level];

  return (
    <div className="flex flex-col items-center" style={{ width: w }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Creative fatigue gauge: ${f.toFixed(1)} views per person`}>
        {/* Colored arc bands */}
        {bands.map((b, i) => (
          <path
            key={i}
            d={arcPath((b.from / 6) * 180, (b.to / 6) * 180)}
            stroke={b.color}
            strokeWidth={12}
            fill="none"
            strokeLinecap="butt"
          />
        ))}
        {/* Tick marks */}
        {[2.5, 3.5, 4.5].map((tick) => {
          const deg = (tick / 6) * 180;
          const inner = polar(deg, r - 12);
          const outer = polar(deg, r + 2);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          );
        })}
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={needleColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={needleColor} />
        {/* Number caption */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontSize="20"
          fontWeight={600}
          fill="hsl(var(--foreground))"
        >
          {f > 0 ? f.toFixed(1) : '—'}
        </text>
      </svg>
      <div className="text-[10px] text-muted-foreground -mt-1 tracking-wide uppercase">
        Views per person
      </div>
    </div>
  );
}
