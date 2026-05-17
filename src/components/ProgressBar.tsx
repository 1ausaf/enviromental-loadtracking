export function ProgressBar({
  completed,
  target,
  showLabel = true,
}: {
  completed: number;
  target: number;
  showLabel?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  const over = target > 0 && completed > target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-zinc-600">
        {showLabel ? (
          <span>
            <span className="font-medium text-zinc-900">{completed.toLocaleString()}</span>
            <span> / {target.toLocaleString()} loads</span>
          </span>
        ) : (
          <span />
        )}
        <span className={over ? "font-semibold text-emerald-700" : ""}>{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-2 rounded-full transition-[width] duration-500 ${
            over ? "bg-emerald-600" : pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-sky-500" : "bg-zinc-700"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
