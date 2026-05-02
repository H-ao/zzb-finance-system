import { useMemo } from "react";
import { TrendingUp, TrendingDown, Wallet, HandCoins } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { BusinessSummaryCard } from "@/components/dashboard/BusinessSummaryCard";
import { ShopComparison } from "@/components/dashboard/ShopComparison";
import { ExpensePie } from "@/components/dashboard/ExpensePie";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { formatCNY, formatWithSymbol } from "@/lib/format";
import { BASE_CURRENCY } from "@/lib/types";

export default function Dashboard() {
  const { transactions, shops, categories, advances, currencyMap } = useLedger();

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const inMonth = (key: string) => transactions.filter((t) => t.date.startsWith(key));
    const sumCNY = (txs: typeof transactions, type: "income" | "expense") =>
      txs.filter((t) => t.type === type).reduce((s, t) => s + t.amountCNY, 0);

    const cur = inMonth(monthStart);
    const last = inMonth(lastMonthKey);

    const curIncome = sumCNY(cur, "income");
    const curExpense = sumCNY(cur, "expense");
    const lastIncome = sumCNY(last, "income");
    const lastExpense = sumCNY(last, "expense");

    const pct = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);

    // 按非本位币分组的本月汇总
    const byForeign = (type: "income" | "expense") => {
      const map = new Map<string, { original: number; cny: number }>();
      cur.filter((t) => t.type === type && t.currency !== BASE_CURRENCY).forEach((t) => {
        const entry = map.get(t.currency) ?? { original: 0, cny: 0 };
        entry.original += t.amount;
        entry.cny += t.amountCNY;
        map.set(t.currency, entry);
      });
      return map;
    };

    return {
      income: curIncome,
      incomeDelta: pct(curIncome, lastIncome),
      incomeForeign: byForeign("income"),
      expense: curExpense,
      expenseDelta: pct(curExpense, lastExpense),
      expenseForeign: byForeign("expense"),
      profit: curIncome - curExpense,
      profitDelta: pct(curIncome - curExpense, lastIncome - lastExpense),
    };
  }, [transactions]);

  const advanceOutstanding = useMemo(() => {
    return advances
      .filter((a) => !a.settled)
      .reduce((s, a) => s + Math.max(0, a.amount - (a.repaidAmount ?? 0)), 0);
  }, [advances]);
  const advanceOpenCount = useMemo(() => advances.filter((a) => !a.settled).length, [advances]);

  function buildForeignSub(map: Map<string, { original: number; cny: number }>): string | undefined {
    if (map.size === 0) return undefined;
    const parts: string[] = [];
    map.forEach((v, code) => {
      const def = currencyMap.get(code);
      const sym = def?.symbol ?? code + " ";
      parts.push(`含 ${formatWithSymbol(v.original, sym)} (折 ${formatCNY(v.cny)})`);
    });
    return parts.join(" · ");
  }
  const incomeSub = buildForeignSub(stats.incomeForeign);
  const expenseSub = buildForeignSub(stats.expenseForeign);

  return (
    <AppLayout
      title="仪表板"
      actions={
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          管理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* 顶部 4 个数据卡 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="本月总收入" value={formatCNY(stats.income)} subValue={incomeSub} delta={stats.incomeDelta} icon={TrendingUp} tone="income" />
          <StatCard label="本月总支出" value={formatCNY(stats.expense)} subValue={expenseSub} delta={stats.expenseDelta} icon={TrendingDown} tone="expense" />
          <StatCard label="本月净利润" value={formatCNY(stats.profit)} delta={stats.profitDelta} icon={Wallet} tone="primary" />
          <StatCard
            label="垫付待回款"
            value={formatCNY(advanceOutstanding)}
            subValue={advanceOpenCount > 0 ? `${advanceOpenCount} 笔未结` : "暂无未结垫付"}
            icon={HandCoins}
            tone="expense"
          />
        </div>

        {/* 趋势 + 近 7 天 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TrendChart transactions={transactions} />
          </div>
          <BusinessSummaryCard />
        </div>

        {/* 店铺对比 + 分类饼图 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ShopComparison shops={shops} transactions={transactions} />
          <ExpensePie categories={categories} transactions={transactions} />
        </div>
      </div>
    </AppLayout>
  );
}
