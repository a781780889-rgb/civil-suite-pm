'use client';

export function NumberField({ label, unit, value, onChange, placeholder, step = 'any', min, help, required = true }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm font-medium text-ink mb-1">
        <span>
          {label}
          {required && <span className="text-rebar-600 mr-1">*</span>}
        </span>
        {unit && <span className="text-xs text-ink-soft font-mono" dir="ltr">{unit}</span>}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink font-mono text-left placeholder:text-concrete-300 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-shadow"
        dir="ltr"
      />
      {help && <span className="block mt-1 text-xs text-ink-soft">{help}</span>}
    </label>
  );
}

export function SelectField({ label, value, onChange, options, help }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-shadow"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {help && <span className="block mt-1 text-xs text-ink-soft">{help}</span>}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, required = false }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-rebar-600 mr-1">*</span>}
      </span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-shadow"
      />
    </label>
  );
}

export function FieldGroup({ title, cols = 2, children }) {
  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-600 border-b border-line pb-1.5">
          {title}
        </h4>
      )}
      <div className={`grid gap-3 ${cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {children}
      </div>
    </div>
  );
}

export function ToggleField({ label, checked, onChange, help }) {
  return (
    <label className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2.5 cursor-pointer">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2">
        {help && <span className="text-xs text-ink-soft">{help}</span>}
        <span
          onClick={(e) => {
            e.preventDefault();
            onChange(!checked);
          }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-navy-600' : 'bg-concrete-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? '-translate-x-4.5' : '-translate-x-1'}`} style={{ transform: checked ? 'translateX(-1.15rem)' : 'translateX(-0.15rem)' }} />
        </span>
      </span>
    </label>
  );
}
