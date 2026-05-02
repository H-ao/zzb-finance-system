import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Briefcase, Loader2, AlertCircle } from "lucide-react";
import { formatCNY } from "@/lib/format";

interface ApiBusinessSummary {
  total_estimated_profit: number;
  total_estimated_rev: number;
  total_cost: number;
  record_count: number;
}

export function BusinessSummaryCard() {
  const [data, setData] = useState<ApiBusinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard/business_summary");
        if (!response.ok) {
          throw new Error("API 请求失败");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络错误");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.record_count === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">业务预估总收益</h3>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          暂无业务核算数据
        </div>
      </div>
    );
  }

  const profit = data.total_estimated_rev - data.total_cost;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Briefcase className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">业务预估总收益</h3>
          <p className="text-[11px] text-muted-foreground">
            {data.record_count} 条记录
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-semibold tabular-nums" style={{ color: "hsl(var(--income))" }}>
          {formatCNY(data.total_estimated_rev)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">预估回款总额</div>
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold tabular-nums text-muted-foreground">
          {formatCNY(data.total_cost)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          发货总成本 · 预估毛利{" "}
          <span style={{ color: profit >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" }}>
            {formatCNY(profit, { sign: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BusinessSummaryCard() {
  const { shipments, shops } = useLedger();
  const [apiData, setApiData] = useState<ApiBusinessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard/business_summary");
        if (response.ok) {
          const data = await response.json();
          setApiData(data);
        } else {
          setError("API请求失败");
        }
      } catch (err) {
        setError("网络错误，使用本地计算");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [shipments]);

  const { totalRev, totalCost, perShop } = useMemo(() => {
    let totalRev = 0;
    let totalCost = 0;
    const map = new Map<string, { rev: number; cost: number }>();
    for (const s of shipments) {
      const pr = s.profitRate ?? 1;
      const rev = s.quantity * s.unitRevenue * pr;
      const cost = s.quantity * s.unitCost;
      totalRev += rev;
      totalCost += cost;
      const e = map.get(s.shopId) ?? { rev: 0, cost: 0 };
      e.rev += rev;
      e.cost += cost;
      map.set(s.shopId, e);
    }
    const perShop = Array.from(map.entries())
      .map(([shopId, v]) => {
        const shop = shops.find((x) => x.id === shopId);
        return {
          shopId,
          name: shop?.name ?? "未知店铺",
          color: shop?.color ?? "hsl(var(--muted-foreground))",
          rev: v.rev,
          cost: v.cost,
          profit: v.rev - v.cost,
        };
      })
      .filter((x) => x.rev > 0)
      .sort((a, b) => b.rev - a.rev);
    return { totalRev, totalCost, perShop };
  }, [shipments, shops]);

  const displayRev = apiData?.total_estimated_rev ?? totalRev;
  const displayCost = apiData?.total_cost ?? totalCost;
  const profit = displayRev - displayCost;
  const hasData = perShop.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Briefcase className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">业务预估总收益</h3>
          {error && (
            <p className="text-[11px] text-muted-foreground">{error}</p>
          )}
          {apiData && (
            <p className="text-[11px] text-muted-foreground">
              {apiData.record_count} 条记录
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="text-2xl font-semibold tabular-nums" style={{ color: "hsl(var(--income))" }}>
              {formatCNY(displayRev)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">预估回款总额</div>
          </div>

          <div className="mt-3">
            <div className="text-base font-semibold tabular-nums text-muted-foreground">
              {formatCNY(displayCost)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              发货总成本 · 预估毛利{" "}
              <span style={{ color: profit >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" }}>
                {formatCNY(profit, { sign: true })}
              </span>
            </div>
          </div>

          <div className="mt-4 h-32 border-t border-border pt-3">
            {!hasData ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                暂无业务核算数据
              </div>
            ) : (
              <div className="flex h-full items-center gap-3">
                <div className="h-full w-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={perShop} dataKey="rev" nameKey="name" innerRadius={22} outerRadius={42} paddingAngle={2} stroke="none">
                        {perShop.map((d) => (
                          <Cell key={d.shopId} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--foreground))", border: "none", borderRadius: 6, fontSize: 11, color: "hsl(var(--background))" }}
                        formatter={(v: number) => [formatCNY(v), "预估回款"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {perShop.slice(0, 4).map((d) => {
                    const pct = displayRev > 0 ? (d.rev / displayRev) * 100 : 0;
                    return (
                      <div key={d.shopId} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                        <span className="flex-1 truncate text-foreground">{d.name}</span>
                        <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {perShop.length > 4 && (
                    <div className="text-[11px] text-muted-foreground">+{perShop.length - 4} 个店铺…</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
