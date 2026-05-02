import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shop, Transaction } from "@/lib/types";
import { formatCNY } from "@/lib/format";

interface Props {
  shops: Shop[];
  transactions: Transaction[];
}

export function ShopComparison({ shops, transactions }: Props) {
  const data = useMemo(() => {
    return shops.map((s) => {
      const shopTxs = transactions.filter((t) => t.shopId === s.id);
      const income = shopTxs.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amountCNY, 0);
      const expense = shopTxs.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amountCNY, 0);
      return { name: s.name, 收入: income, 支出: expense, 利润: income - expense };
    });
  }, [shops, transactions]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h3 className="text-base font-semibold">店铺对比</h3>
      <p className="mt-1 text-xs text-muted-foreground">收入 / 支出 / 利润</p>
      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => formatCNY(v)}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="收入" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="支出" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="利润" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
