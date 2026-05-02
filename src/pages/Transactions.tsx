import { useMemo, useState } from "react";
import { Plus, Download, Search, Pencil, Trash2, Split } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Transaction, PAYMENT_METHOD_LABELS, TxType, WAREHOUSE_SHOP_ID } from "@/lib/types";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { AllocateDialog } from "@/components/transactions/AllocateDialog";
import { formatCNY, formatWithSymbol, formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 12;

export default function Transactions() {
  const { transactions, shops, allShops, categories, currencyMap, getShop, getCategory, deleteTransaction, deleteTransactions } = useLedger();

  const [search, setSearch] = useState("");
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocSource, setAllocSource] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (shopFilter !== "all" && t.shopId !== shopFilter) return false;
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          const shop = getShop(t.shopId)?.name.toLowerCase() ?? "";
          const cat = getCategory(t.categoryId)?.name.toLowerCase() ?? "";
          const note = t.note?.toLowerCase() ?? "";
          if (!shop.includes(s) && !cat.includes(s) && !note.includes(s) && !String(t.amount).includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }, [transactions, search, shopFilter, typeFilter, getShop, getCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function toggleSelectAll() {
    if (pageData.every((t) => selected.has(t.id))) {
      const next = new Set(selected);
      pageData.forEach((t) => next.delete(t.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageData.forEach((t) => next.add(t.id));
      setSelected(next);
    }
  }

  function handleDelete(id: string) {
    deleteTransaction(id);
    toast.success("已删除");
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    deleteTransactions(Array.from(selected));
    setSelected(new Set());
    toast.success(`已删除 ${selected.size} 条`);
  }

  function handleExport() {
    const headers = ["日期", "店铺", "类型", "分类", "支付方式", "币种", "原币金额", "汇率", "折合人民币", "备注"];
    const rows = filtered.map((t) => [
      t.date,
      getShop(t.shopId)?.name ?? "",
      t.type === "income" ? "收入" : "支出",
      getCategory(t.categoryId)?.name ?? "",
      PAYMENT_METHOD_LABELS[t.paymentMethod],
      t.currency,
      t.amount.toFixed(2),
      t.exchangeRate ? t.exchangeRate.toString() : "",
      t.amountCNY.toFixed(2),
      t.note ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出 CSV");
  }

  const allChecked = pageData.length > 0 && pageData.every((t) => selected.has(t.id));

  return (
    <AppLayout
      title="交易记录"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> 导出
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> 新增交易
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        {/* 筛选区 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索店铺、分类、备注或金额..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={shopFilter} onValueChange={(v) => { setShopFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="店铺" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部店铺</SelectItem>
              {allShops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="income">收入</SelectItem>
              <SelectItem value="expense">支出</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="gap-2 text-expense">
              <Trash2 className="h-4 w-4" /> 删除选中 ({selected.size})
            </Button>
          )}
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-3 text-left">
                  <Checkbox checked={allChecked} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 text-left font-medium">日期</th>
                <th className="px-4 py-3 text-left font-medium">店铺</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">分类</th>
                <th className="px-4 py-3 text-left font-medium">支付方式</th>
                <th className="px-4 py-3 text-right font-medium">金额</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((t) => {
                const shop = getShop(t.shopId);
                const cat = getCategory(t.categoryId);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDateLong(t.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: shop?.color ?? "#999" }} />
                        <span className="font-medium">{shop?.name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge name={cat?.name ?? "—"} color={cat?.color ?? "#888"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{PAYMENT_METHOD_LABELS[t.paymentMethod]}</td>
                    <td className={cn("px-4 py-3 text-right font-semibold tabular-nums",
                      t.type === "income" ? "text-income" : "text-expense")}
                    >
                      <div className="flex flex-col items-end leading-tight">
                        <span>
                          {t.type === "income" ? "+" : "-"}{formatWithSymbol(t.amount, currencyMap.get(t.currency)?.symbol ?? (t.currency + " "))}
                        </span>
                        {!currencyMap.get(t.currency)?.isBase && t.currency !== "CNY" && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ≈ {formatCNY(t.amountCNY)}
                            {t.exchangeRate ? ` · @${t.exchangeRate}` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {t.shopId === WAREHOUSE_SHOP_ID && t.type === "expense" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-primary hover:text-primary"
                            onClick={() => { setAllocSource(t); setAllocOpen(true); }}
                            title="分摊到店铺"
                          >
                            <Split className="h-3.5 w-3.5" />
                            <span className="text-xs">分摊</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-expense hover:text-expense" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <Button
                  key={p}
                  variant={p === page ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-8 w-8 p-0", p === page && "bg-primary-soft text-primary hover:bg-primary-soft")}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            {totalPages > 7 && <span className="px-2 text-muted-foreground">...</span>}
          </div>
          <div className="text-muted-foreground">{filtered.length} 条记录</div>
        </div>
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <AllocateDialog open={allocOpen} onOpenChange={setAllocOpen} source={allocSource} />
    </AppLayout>
  );
}

function TypeBadge({ type }: { type: TxType }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
    )}>
      {type === "income" ? "收入" : "支出"}
    </span>
  );
}

function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {name}
    </span>
  );
}
