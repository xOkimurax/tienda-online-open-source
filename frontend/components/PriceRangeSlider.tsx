'use client';

type Props = {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

// Two overlapping <input type="range"> sharing one track (see .range-slider
// in globals.css). Whichever handle sits in the right half of the track gets
// the higher z-index — otherwise, once the two handles get close together,
// the one underneath becomes impossible to grab.
export function PriceRangeSlider({ min, max, value, onChange }: Props) {
  const [lo, hi] = value;
  const span = Math.max(1, max - min);
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;

  return (
    <div className="range-slider">
      <div className="range-track" />
      <div className="range-fill" style={{ left: `${loPct}%`, width: `${Math.max(0, hiPct - loPct)}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        value={lo}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
        style={{ zIndex: loPct > 50 ? 5 : 3 }}
        aria-label="Precio mínimo"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={hi}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
        style={{ zIndex: hiPct <= 50 ? 5 : 4 }}
        aria-label="Precio máximo"
      />
    </div>
  );
}
