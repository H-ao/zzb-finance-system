import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLedger } from "@/contexts/LedgerContext";
import { Transaction, WAREHOUSE_SHOP_ID } from "@/lib/types";
import { formatCNY, formatDateLong } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source: Transaction | null;
}

/**
 * 分摊弹窗：把"待分配总仓"的一笔支出分摊到具体店铺。
 * 生成对冲凭证：
 *  1) 总仓侧记录一笔同分类的"收入"，金额 = 分摊成本，用于冲减总仓原支出；
 *  2) 目标店铺记录一笔同分类的"支出"，金额 = 分摊成本。
 * 净效果：总仓减少分摊成本，目标店铺增加同等支出，原始凭证保留可追溯。
 */
export function AllocateDialog({ open, onOpenChange, source }: Props) {
  const { shops, categories, addTransaction, transactions, getCategory } = useLedger();

  const [targetShopId, setTargetShopId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("");

  // 已分摊金额（仅本位币 CNY 视角）
  const allocatedSoFar = useMemo(() => {
    if (!source) return 0;
    return transactions
      .filter((t) => t.note?.includes(`[allocFrom:${source.id}]`) && t.type === "expense")
      .reduce((s, t) => s + t.amountCNY, 0);
  }, [transactions, source]);

  const remaining = source ? Math.max(0, source.amountCNY - allocatedSoFar) : 0;

  // 总仓单价：用剩余金额估算（剩余 / 1），用户可改
  useEffect(() => {
    if (open && source) {
      setTargetShopId(shops[0]?.id ?? "");
      setQuantity("1");
      setUnitPrice(remaining.toFixed(2));
    }
  }, [open, source, shops, remaining]);

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const cost = Math.round(qty * price * 100) / 100;
  const overflow = cost > remaining + 0.001;

  function findOffsetIncomeCategoryId(): string | null {
    const incomes = categories.filter((c) => c.type === "income");
    if (incomes.length === 0) return null;
    const refund = incomes.find((c) => c.name.includes("退款") || c.name.includes("冲销"));
    return (refund ?? incomes[0]).id;
  }

  function handleSubmit() {
    if (!source) return;
    if (!targetShopId) return toast.error("请选择目标店铺");
    if (qty <= 0) return toast.error("请输入有效的发货数量");
    if (price <= 0) return toast.error("请输入有效的货物单价");
    if (cost <= 0) return toast.error("分摊金额必须大于 0");
    if (overflow) return toast.error(`分摊金额超过总仓剩余 ${formatCNY(remaining)}`);

    const offsetCatId = findOffsetIncomeCategoryId();
    if (!offsetCatId) return toast.error("请先在分类管理中创建一个收入分类用于对冲");

    const sourceCat = getCategory(source.categoryId);
    const today = new Date().toISOString().slice(0, 10);
    const tag = `[allocFrom:${source.id}]`;
    const targetShopName = shops.find((s) => s.id === targetShopId)?.name ?? "";

    // 1) 总仓侧对冲收入
    addTransaction({
      date: today,
      shopId: WAREHOUSE_SHOP_ID,
      type: "income",
      categoryId: offsetCatId,
      paymentMethod: source.paymentMethod,
      amount: cost,
      currency: "CNY",
      amountCNY: cost,
      note: `${tag} 分摊出库到「${targetShopName}」 数量 ${qty} × 单价 ${price}`,
    });

    // 2) 目标店铺侧支出
    addTransaction({
      date: today,
      shopId: targetShopId,
      type: "expense",
      categoryId: sourceCat?.id ?? source.categoryId,
      paymentMethod: source.paymentMethod,
      amount: cost,
      currency: "CNY",
      amountCNY: cost,
      note: `${tag} 来自总仓分摊 数量 ${qty} × 单价 ${price}`,
    });

    toast.success("分摊成功，已生成对冲凭证");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>分摊到店铺</DialogTitle>
          <DialogDescription>将待分配总仓的采购按数量与单价分摊到指定店铺，生成对冲凭证。</DialogDescription>
        </DialogHeader>

        {source && (
          <div className="grid gap-4 py-2">
            {/* 原采购单信息 */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">原采购单</div>
              <div className="flex items-center justify-between">
                <span>{formatDateLong(source.date)}</span>
                <span className="font-semibold tabular-nums text-expense">-{formatCNY(source.amountCNY)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>分类：{getCategory(source.categoryId)?.name ?? "—"}</span>
                <span>剩余可分摊：<span className="font-medium text-foreground">{formatCNY(remaining)}</span></span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>目标店铺</Label>
              <Select value={targetShopId} onValueChange={setTargetShopId}>
                <SelectTrigger><SelectValue placeholder="选择目标店铺" /></SelectTrigger>
                <SelectContent>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>发货数量</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-2">
                <Label>货物单价 (¥)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2">
              <span className="text-sm text-muted-foreground">本次分摊成本</span>
              <span className={`text-lg font-semibold tabular-nums ${overflow ? "text-expense" : "text-primary"}`}>
                {formatCNY(cost)}
              </span>
            </div>
            {overflow && (
              <div className="text-xs text-expense">超出剩余可分摊金额 {formatCNY(remaining)}</div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={!source || overflow || cost <= 0}>确认分摊</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
