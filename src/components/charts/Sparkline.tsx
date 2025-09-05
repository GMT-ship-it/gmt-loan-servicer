import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { tooltipStyle } from './theme';

export default function Sparkline({
  data,
  dataKey = 'v',
  height = 44,
}: {
  data: Array<Record<string, number>>;
  dataKey?: string;
  height?: number;
}) {
  if (!data?.length) return null;
  return (
    <div className="h-[44px]">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E50914" stopOpacity={0.55}/>
              <stop offset="100%" stopColor="#E50914" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={tooltipStyle as any}
            labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
            formatter={(v: number) => [`${(v).toFixed(1)}%`, 'Utilization']}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="#E50914"
            fill="url(#sparkFill)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}