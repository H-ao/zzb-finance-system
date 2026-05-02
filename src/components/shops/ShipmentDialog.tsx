import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLedger } from "@/contexts/LedgerContext";
import { Shipment } from "@/lib/types";
import { formatCNY } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shopId: string;
  editing: Shipment | null;
}

export function ShipmentDialog({ open, onOpenChange, shopId, editing }: Props) {
  const { currencies, getCurrency, addShipment, updateShipment } = useLedger();

  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [revCurrency, setRevCurrency] = useState("CNY");
  const [revAmount, setRevAmount] = useState("");
  const [revRate, setRevRate] = useState("1");
  const [completionRate, setCompletionRate] = useState("0.2");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.date);
      setQuantity(String(editing.quantity));
      setUnitCost(String(editing.unitCost));
      setRevCurrency(editing.unitRevenueCurrency);
      setRevAmount(String(editing.unitRevenueOriginal));
      setRevRate(String(editing.unitRevenueRate ?? 1));
      setCompletionRate(String(editing.profitRate ?? 1));
      setNote(editing.note ?? "");
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setQuantity("");
      setUnitCost("");
      setRevCurrency("CNY");
      setRevAmount("");
      setRevRate("1");
      setCompletionRate("0.2");
      setNote("");
    }
  }, [open, editing]);

  useEffect(() => {
    const c = getCurrency(revCurrency);
    if (!c) return;
    if (c.isBase) setRevRate("1");
    else if (!editing) setRevRate(String(c.defaultRate));
  }, [revCurrency, getCurrency, editing]);

  const qty = parseFloat(quantity) || 0;
  const cost = parseFloat(unitCost) || 0;
  const rev = parseFloat(revAmount) || 0;
  const rate = parseFloat(revRate) || 0;
  const cr = parseFloat(completionRate);
  const crSafe = Number.isFinite(cr) ? cr : 0;
  const isBase = getCurrency(revCurrency)?.isBase;
  const revCNY = isBase ? rev : rev * rate;

  const totals = useMemo(() => {
    const totalCost = qty * cost;
    // 预估回款 = 数量 × 每单回款 × 完成率
    const totalRev = qty * revCNY * crSafe;
    const profit = totalRev - totalCost;
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : null;
    return { totalCost, totalRev, profit, margin };
  }, [qty, cost, revCNY, crSafe]);

  async function handleSubmit() {
    if (!date) return toast.error("请选择发货日期");
    if (qty <= 0 || !Number.isFinite(qty)) return toast.error("请输入有效的发货数量");
    if (cost < 0) return toast.error("成本不能为负");
    if (rev < 0) return toast.error("回款不能为负");
    if (!Number.isFinite(cr) || cr < 0) return toast.error("请填写有效的完成率");
    if (!isBase && rate <= 0) return toast.error("请填写有效的汇率");

    const payload: Omit<Shipment, "id" | "createdAt"> = {
      shopId,
      date,
      quantity: qty,
      unitCost: cost,
      unitRevenueCurrency: revCurrency,
      unitRevenueRate: isBase ? undefined : rate,
      unitRevenueOriginal: rev,
      unitRevenue: revCNY,
      profitRate: cr,
      note: note.trim() || undefined,
    };

    if (editing) {
      await updateShipment(editing.id, payload);
      toast.success("已更新发货批次");
    } else {
      await addShipment(payload);
      toast.success("已登记发货");
    }
    onOpenChange(false);
  }

  const profitColor = totals.profit > 0 ? "text-income" : totals.profit < 0 ? "text-expense" : "text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑发货" : "登记新发货"}</DialogTitle>
          <DialogDescription>仅用于业务利润预估，不会进入交易记录与现金流统计。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>发货日期</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>发货数量（件）</Label>
              <Input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>单只发货成本（CNY）</Label>
              <Input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="tabular-nums" />
            </div>
            <div className="grid gap-2">
              <Label>完成率（如 0.2 = 20%）</Label>
              <Input type="number" min="0" step="0.01" value={completionRate} onChange={(e) => setCompletionRate(e.target.value)} className="tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-2">
              <Label>每单回款金额</Label>
              <Input type="number" min="0" step="0.01" value={revAmount} onChange={(e) => setRevAmount(e.target.value)} className="tabular-nums" />
            </div>
            <div className="grid gap-2">
              <Label>币种</Label>
              <Select value={revCurrency} onValueChange={setRevCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isBase && (
            <div className="grid gap-2">
              <Label>汇率（1 {revCurrency} = ? CNY）</Label>
              <Input type="number" min="0" step="0.0001" value={revRate} onChange={(e) => setRevRate(e.target.value)} className="tabular-nums" />
              <div className="text-xs text-muted-foreground">折合每单回款：{formatCNY(revCNY)}</div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>备注（可选）</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">实时预览</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">发货总成本</span>
                <span className="font-semibold tabular-nums">{formatCNY(totals.totalCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">预估回款</span>
                <span className="font-semibold tabular-nums">{formatCNY(totals.totalRev)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">预估毛利润</span>
                <span className={`font-semibold tabular-nums ${profitColor}`}>{formatCNY(totals.profit)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">预估利润率</span>
                <span className={`font-semibold tabular-nums ${profitColor}`}>
                  {totals.margin === null ? "—" : `${totals.margin.toFixed(1)}%`}
                </span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              公式：预估回款 = 数量 × 每单回款 × 完成率
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>{editing ? "保存" : "登记发货"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
