import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Transaction } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCNY } from "@/lib/format";

type Range = "7d" | "30d" | "12m";

interface Props {
  transactions: Transaction[];
}

function bucketize(txs: Transaction[], range: Range) {
  const now = new Date();
  if (range === "12m") {
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: `${d.getMonth() + 1}月`, income: 0, expense: 0 });
    }
    const map = new Map(months.map((m) => [m.key, m]));
    txs.forEach((t) => {
      const k = t.date.slice(0, 7);
      const b = map.get(k);
      if (!b) return;
      if (t.type === "income") b.income += t.amountCNY;
      else b.expense += t.amountCNY;
    });
    return months;
  }

  const days = range === "7d" ? 7 : 30;
  const buckets: { key: string; label: string; income: number; expense: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: range === "7d" ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getDate()}`,
      income: 0,
      expense: 0,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  txs.forEach((t) => {
    const b = map.get(t.date);
    if (!b) return;
    if (t.type === "income") b.income += t.amountCNY;
    else b.expense += t.amountCNY;
  });
  return buckets;
}

export function TrendChart({ transactions }: Props) {
  const [range, setRange] = useState<Range>("30d");
  const data = useMemo(() => bucketize(transactions, range), [transactions, range]);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">收支趋势</h3>
          <div className="mt-3 flex gap-8">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{formatCNY(totalIncome)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">收入合计</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{formatCNY(totalExpense)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">支出合计</div>
            </div>
          </div>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="h-8">
            <TabsTrigger value="7d" className="text-xs">7 天</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs">30 天</TabsTrigger>
            <TabsTrigger value="12m" className="text-xs">12 月</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: 12,
              }}
              formatter={(v: number) => formatCNY(v)}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="income" name="收入" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="expense" name="支出" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} strokeDasharray="4 4" activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
