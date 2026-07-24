'use client';

export default function TitleBlock({ sheetNumber, sheetTitle, sheetSubtitle, projectName, onProjectNameChange, engineerName, onEngineerNameChange, dateLabel }) {
  return (
    <div className="rounded-sheet border border-navy-700 bg-white overflow-hidden shadow-sheet">
      <div className="bg-navy-700 text-white px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold bg-white/10 border border-white/25 rounded px-2 py-0.5 tabular-figure" dir="ltr">
            {sheetNumber}
          </span>
          <div>
            <h1 className="text-base font-bold leading-tight">{sheetTitle}</h1>
            {sheetSubtitle && <p className="text-xs text-navy-100/80 leading-tight">{sheetSubtitle}</p>}
          </div>
        </div>
        <span className="hidden sm:block text-[11px] font-mono text-navy-100/70 tabular-figure" dir="ltr">
          {dateLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 divide-x divide-x-reverse divide-line bg-concrete-50/60">
        <div className="px-4 py-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-soft mb-1">اسم المشروع</span>
          <input
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="أدخل اسم المشروع"
            className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none placeholder:text-concrete-300 placeholder:font-normal"
          />
        </div>
        <div className="px-4 py-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-soft mb-1">المهندس المسؤول</span>
          <input
            value={engineerName}
            onChange={(e) => onEngineerNameChange(e.target.value)}
            placeholder="أدخل اسم المهندس"
            className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none placeholder:text-concrete-300 placeholder:font-normal"
          />
        </div>
      </div>
    </div>
  );
}
