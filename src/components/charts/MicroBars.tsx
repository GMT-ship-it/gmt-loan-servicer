import { Bar, BarChart, ResponsiveContainer } from 'recharts';

export default function MicroBars({ data }: { data: { v: number }[] }) {
  if (!data?.length) return null;
  return (
    <div className="h-[36px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" fill="#E50914" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}