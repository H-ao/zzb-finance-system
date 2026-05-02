import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Category, Transaction } from "@/lib/types";
import { formatCNY } from "@/lib/format";

interface Props {
  categories: Category[];
  transactions: Transaction[];
}

export function ExpensePie({ categories, transactions }: Props) {
  const { data, total } = useMemo(() => {
    const expenseCats = categories.filter((c) => c.type === "expense");
    const arr = expenseCats
      .map((c) => {
        const value = transactions
          .filter((t) => t.categoryId === c.id && t.type === "expense")
          .reduce((s, t) => s + t.amountCNY, 0);
        return { name: c.name, value, color: c.color };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);
    return { data: arr, total };
  }, [categories, transactions]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h3 className="text-base font-semibold">支出分类占比</h3>
      <p className="mt-1 text-xs text-muted-foreground">总支出 {formatCNY(total)}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="hsl(var(--card))" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCNY(v)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col justify-center gap-2">
          {data.slice(0, 6).map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-foreground">{d.name}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {total > 0 ? ((d.value / total) * 100).toFixed(1) : "0"}%
              </span>
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-muted-foreground">暂无支出数据</p>}
        </div>
      </div>
    </div>
  );
}
