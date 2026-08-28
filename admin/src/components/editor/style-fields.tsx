interface ColorFieldProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value = '#111827', onChange }: ColorFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={value.startsWith('#') ? value : '#111827'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--pb-border)' }}
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

interface SizeFieldProps {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function SizeField({ label, value = 14, min = 10, max = 32, onChange }: SizeFieldProps) {
  return (
    <div className="field">
      <label>
        {label} ({value}px)
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
