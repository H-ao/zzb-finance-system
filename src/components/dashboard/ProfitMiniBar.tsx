import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Transaction } from "@/lib/types";
import { formatCNY } from "@/lib/format";

interface Props {
  transactions: Transaction[];
}

export function ProfitMiniBar({ transactions }: Props) {
  const data = useMemo(() => {
    const now = new Date();
    const days: { key: string; label: string; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: `${d.getDate()}`, profit: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    transactions.forEach((t) => {
      const b = map.get(t.date);
      if (!b) return;
      b.profit += t.type === "income" ? t.amountCNY : -t.amountCNY;
    });
    return days;
  }, [transactions]);

  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const totalIncome = transactions
    .filter((t) => data.some((d) => d.key === t.date) && t.type === "income")
    .reduce((s, t) => s + t.amountCNY, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h3 className="text-base font-semibold">近 7 天</h3>
      <div className="mt-4">
        <div className="text-2xl font-semibold tabular-nums">{formatCNY(totalIncome)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">收入</div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold tabular-nums" style={{ color: totalProfit >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" }}>
          {formatCNY(totalProfit, { sign: true })}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">净利润</div>
      </div>
      <div className="mt-4 h-28 border-t border-border pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{ backgroundColor: "hsl(var(--foreground))", border: "none", borderRadius: 6, fontSize: 11, color: "hsl(var(--background))" }}
              labelStyle={{ color: "hsl(var(--background))" }}
              formatter={(v: number) => [formatCNY(v), "净利润"]}
            />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.profit >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
