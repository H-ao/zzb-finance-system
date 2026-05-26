import { useMemo, useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Store as StoreIcon, Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Shop } from "@/lib/types";
import { formatCNY } from "@/lib/format";
import { ShopAccountingPanel } from "@/components/shops/ShopAccountingPanel";
import { toast } from "sonner";

const PRESET_COLORS = ["#3B5BFF", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#EF4444", "#84CC16"];
const PAGE_SIZE = 9;

export default function Shops() {
  const { shops, transactions, shipments, addShop, updateShop, deleteShop } = useLedger();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [accountingShop, setAccountingShop] = useState<Shop | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return shops.map((s) => {
      const monthTxs = transactions.filter((t) => t.shopId === s.id && t.date.startsWith(monthKey));
      const income = monthTxs.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amountCNY, 0);
      const expense = monthTxs.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amountCNY, 0);
      const total = transactions.filter((t) => t.shopId === s.id).length;
      const shopShipments = shipments.filter((sh) => sh.shopId === s.id);
      const shipQty = shopShipments.reduce((n, sh) => n + sh.quantity, 0);
      const shipCost = shopShipments.reduce((n, sh) => n + sh.quantity * sh.unitCost, 0);
      const shipRev = shopShipments.reduce((n, sh) => n + sh.quantity * sh.unitRevenue * (sh.profitRate ?? 1), 0);
      const shipProfit = shipRev - shipCost;
      return { shop: s, income, expense, profit: income - expense, count: total, shipQty, shipProfit, shipCount: shopShipments.length };
    });
  }, [shops, transactions, shipments]);

  const filteredStats = useMemo(() => {
    if (!searchTerm.trim()) return stats;
    return stats.filter((s) =>
      s.shop.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats, searchTerm]);

  // 计算总页数：每页固定 9 个
  const totalPages = Math.max(1, Math.ceil(filteredStats.length / PAGE_SIZE));

  const paginatedStats = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredStats.slice(start, end);
  }, [filteredStats, currentPage]);

  // 是否显示新增卡片：仅当当前页少于 9 个或数据为空时显示
  const showAddCard = paginatedStats.length < PAGE_SIZE;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 键盘快捷键翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用户在输入框中，不响应快捷键
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault();
        goToPage(currentPage + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  function openNew() {
    // 如果当前页已满 9 个，跳转到下一页再打开弹窗
    if (paginatedStats.length >= PAGE_SIZE) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      // 等待状态更新后再打开弹窗
      setTimeout(() => {
        setEditing(null);
        setName("");
        setColor(PRESET_COLORS[0]);
        setOpen(true);
      }, 50);
    } else {
      setEditing(null);
      setName("");
      setColor(PRESET_COLORS[0]);
      setOpen(true);
    }
  }
  
  function openEdit(s: Shop) {
    setEditing(s);
    setName(s.name);
    setColor(s.color);
    setOpen(true);
  }
  
  function save() {
    if (!name.trim()) return toast.error("请输入店铺名称");
    if (editing) {
      updateShop(editing.id, { name: name.trim(), color });
      toast.success("已更新");
    } else {
      addShop({ name: name.trim(), color });
      toast.success("已新增店铺");
    }
    setOpen(false);
    // 新增后如果当前页已满，自动跳转到新店铺所在的页
    if (!editing) {
      const newTotal = filteredStats.length + 1;
      const newLastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (newTotal > PAGE_SIZE && paginatedStats.length >= PAGE_SIZE) {
        setCurrentPage(newLastPage);
      }
    }
  }
  
  function remove(s: Shop) {
    if (!confirm(`删除店铺「${s.name}」?该店铺下的所有交易也将被删除。`)) return;
    deleteShop(s.id);
    toast.success("已删除");
  }

  return (
    <AppLayout
      title="店铺管理"
      actions={
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="搜索店铺..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-48"
          />
          <Button size="sm" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> 新增店铺
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedStats.map(({ shop, income, expense, profit, count, shipQty, shipProfit, shipCount }) => (
          <div key={shop.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${shop.color}20`, color: shop.color }}>
                  <StoreIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{shop.name}</div>
                  <div className="text-xs text-muted-foreground">{count} 笔交易</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(shop)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-expense hover:text-expense" onClick={() => remove(shop)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">本月</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">收入</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-income">{formatCNY(income)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">支出</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-expense">{formatCNY(expense)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">利润</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums" style={{ color: profit >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" }}>
                    {formatCNY(profit)}
                  </div>
                </div>
              </div>
            </div>

            {/* 业务核算迷你汇总 + 入口 */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-soft/60 px-2 py-1.5">
              <div className="text-xs">
                <div className="text-muted-foreground">业务核算</div>
                <div className="mt-0.5 tabular-nums">
                  {shipCount === 0 ? (
                    <span className="text-muted-foreground">尚无发货</span>
                  ) : (
                    <>累计 <strong>{shipQty}</strong> 件 · 预估毛利{" "}
                      <strong className={shipProfit >= 0 ? "text-income" : "text-expense"}>{formatCNY(shipProfit)}</strong>
                    </>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAccountingShop(shop)}>
                <Calculator className="h-3.5 w-3.5" /> 业务核算
              </Button>
            </div>
          </div>
        ))}

        {/* 新增卡片 */}
        {showAddCard && (
          <button
            onClick={openNew}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm">新增店铺</span>
          </button>
        )}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className="w-8"
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            {totalPages > 7 && (
              <span className="px-2 text-muted-foreground">...</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 分页信息 */}
      {filteredStats.length > 0 ? (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          显示 {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredStats.length)}-{Math.min(currentPage * PAGE_SIZE, filteredStats.length)} / 共 {filteredStats.length} 个店铺
        </div>
      ) : (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          无匹配结果
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editing ? "编辑店铺" : "新增店铺"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>店铺名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：南山旗舰店" />
            </div>
            <div className="grid gap-2">
              <Label>主题色</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-full ring-offset-2 transition-all"
                    style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? "保存" : "新增"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 业务核算抽屉式弹窗 */}
      <Dialog open={!!accountingShop} onOpenChange={(v) => !v && setAccountingShop(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {accountingShop && (
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accountingShop.color }} />
              )}
              {accountingShop?.name} · 业务核算
            </DialogTitle>
            <DialogDescription>登记发货批次并实时预估毛利与利润率。</DialogDescription>
          </DialogHeader>
          {accountingShop && <ShopAccountingPanel shop={accountingShop} />}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
