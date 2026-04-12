interface ChartSkeletonProps {
  type: "gauge" | "bar" | "line" | "donut" | "area" | "cards";
  className?: string;
}

export function ChartSkeleton({ type, className }: ChartSkeletonProps): React.JSX.Element {
  const base = `animate-pulse ${className ?? ""}`;

  switch (type) {
    case "gauge":
      return (
        <div className={`flex items-center justify-center h-[180px] ${base}`}>
          <div className="w-32 h-16 rounded-t-full bg-surface animate-pulse" />
        </div>
      );
    case "donut":
      return (
        <div className={`flex items-center justify-center h-[220px] ${base}`}>
          <div className="w-28 h-28 rounded-full border-8 border-surface bg-transparent animate-pulse" />
        </div>
      );
    case "bar":
      return (
        <div className={`flex items-end justify-center gap-2 h-[220px] p-4 ${base}`}>
          {[60, 80, 45, 90, 55, 70].map((h, i) => (
            <div key={i} className="w-8 rounded-t bg-surface animate-pulse" style={{ height: `${h}%` }} />
          ))}
        </div>
      );
    case "line":
    case "area":
      return (
        <div className={`h-[220px] p-4 ${base}`}>
          <div className="w-full h-full rounded bg-surface animate-pulse" />
        </div>
      );
    case "cards":
      return (
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${base}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      );
    default:
      return <div className={`h-[220px] rounded bg-surface ${base}`} />;
  }
}
