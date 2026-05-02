import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Package, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLedger } from "@/contexts/LedgerContext";
import { Shipment, Shop } from "@/lib/types";
import { formatCNY, formatDateLong, formatWithSymbol } from "@/lib/format";
import { ShipmentDialog } from "./ShipmentDialog";
import { toast } from "sonner";

interface Props {
  shop: Shop;
}

function marginClass(margin: number | null) {
  if (margin === null) return "text-muted-foreground";
  if (margin < 0) return "text-expense";
  if (margin >= 30) return "text-income";
  return "text-primary";
}

export function ShopAccountingPanel({ shop }: Props) {
  const { shipments, deleteShipment, getCurrency } = useLedger();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shipment | null>(null);

  const list = useMemo(
    () => shipments.filter((s) => s.shopId === shop.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [shipments, shop.id],
  );

  const totals = useMemo(() => {
    let qty = 0, cost = 0, rev = 0;
    for (const s of list) {
      const pr = s.profitRate ?? 1;
      qty += s.quantity;
      cost += s.quantity * s.unitCost;
      rev += s.quantity * s.unitRevenue * pr;
    }
    const profit = rev - cost;
    const margin = rev > 0 ? (profit / rev) * 100 : null;
    return { qty, cost, rev, profit, margin };
  }, [list]);

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(s: Shipment) { setEditing(s); setDialogOpen(true); }
  function remove(s: Shipment) {
    if (!confirm(`删除 ${s.date} 的发货记录？`)) return;
    deleteShipment(s.id);
    toast.success("已删除");
  }

  function exportCsv() {
    if (list.length === 0) return toast.error("暂无数据可导出");
    const header = ["日期", "数量", "单只成本(¥)", "单价回款", "回款币种", "汇率", "完成率", "总成本(¥)", "预估回款(¥)", "毛利(¥)", "毛利率(%)", "备注"];
    const rows = list.map((s) => {
      const pr = s.profitRate ?? 1;
      const totalCost = s.quantity * s.unitCost;
      const totalRev = s.quantity * s.unitRevenue * pr;
      const profit = totalRev - totalCost;
      const margin = totalRev > 0 ? ((profit / totalRev) * 100).toFixed(2) : "";
      return [s.date, s.quantity, s.unitCost.toFixed(2), s.unitRevenueOriginal.toFixed(2), s.unitRevenueCurrency, s.unitRevenueRate ?? 1, pr, totalCost.toFixed(2), totalRev.toFixed(2), profit.toFixed(2), margin, s.note ?? ""];
    });
    const csv = [header, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${shop.name}-发货核算-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* 隔离声明 */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>本模块用于业务利润预估，与现金流/交易记录相互独立，<strong className="text-foreground">不会影响仪表盘统计</strong>。</span>
      </div>

      {/* 历史累计 4 卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="总发货量" value={`${totals.qty} 件`} />
        <SummaryCard label="总成本" value={formatCNY(totals.cost)} />
        <SummaryCard label="预估总回款" value={formatCNY(totals.rev)} />
        <SummaryCard
          label="预估毛利"
          value={formatCNY(totals.profit)}
          valueClass={totals.profit > 0 ? "text-income" : totals.profit < 0 ? "text-expense" : ""}
          sub={totals.margin === null ? "利润率 —" : `利润率 ${totals.margin.toFixed(1)}%`}
          subClass={marginClass(totals.margin)}
        />
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">发货批次（{list.length}）</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>导出 CSV</Button>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> 登记新发货
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="text-sm text-muted-foreground">还没有发货批次，点击「登记新发货」开始记录</div>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> 登记新发货
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">日期</th>
                <th className="px-3 py-2.5 text-right font-medium">数量</th>
                <th className="px-3 py-2.5 text-right font-medium">单只成本</th>
                <th className="px-3 py-2.5 text-right font-medium">单价回款</th>
                <th className="px-3 py-2.5 text-right font-medium">完成率</th>
                <th className="px-3 py-2.5 text-right font-medium">总成本</th>
                <th className="px-3 py-2.5 text-right font-medium">总回款</th>
                <th className="px-3 py-2.5 text-right font-medium">毛利</th>
                <th className="px-3 py-2.5 text-right font-medium">利润率</th>
                <th className="px-3 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const pr = s.profitRate ?? 1;
                const totalCost = s.quantity * s.unitCost;
                const totalRev = s.quantity * s.unitRevenue * pr;
                const profit = totalRev - totalCost;
                const margin = totalRev > 0 ? (profit / totalRev) * 100 : null;
                const cur = getCurrency(s.unitRevenueCurrency);
                const sym = cur?.symbol ?? "";
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2.5 tabular-nums">{formatDateLong(s.date)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCNY(s.unitCost)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <div>{formatWithSymbol(s.unitRevenueOriginal, sym)}</div>
                      {!cur?.isBase && (
                        <div className="text-xs text-muted-foreground">≈ {formatCNY(s.unitRevenue)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {(pr * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCNY(totalCost)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCNY(totalRev)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${profit >= 0 ? "text-income" : "text-expense"}`}>
                      {formatCNY(profit)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${marginClass(margin)}`}>
                      {margin === null ? "—" : `${margin.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-expense hover:text-expense" onClick={() => remove(s)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ShipmentDialog open={dialogOpen} onOpenChange={setDialogOpen} shopId={shop.id} editing={editing} />
    </div>
  );
}

function SummaryCard({ label, value, sub, valueClass, subClass }: { label: string; value: string; sub?: string; valueClass?: string; subClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-lg font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${subClass ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}
