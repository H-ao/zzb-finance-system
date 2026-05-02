import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CurrencyDef } from "@/lib/types";
import { toast } from "sonner";

export default function Currencies() {
  const { currencies, transactions, addCurrency, updateCurrency, deleteCurrency } = useLedger();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CurrencyDef | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [defaultRate, setDefaultRate] = useState("");

  function openNew() {
    setEditing(null);
    setCode("");
    setName("");
    setSymbol("");
    setDefaultRate("");
    setOpen(true);
  }
  function openEdit(c: CurrencyDef) {
    setEditing(c);
    setCode(c.code);
    setName(c.name);
    setSymbol(c.symbol);
    setDefaultRate(String(c.defaultRate));
    setOpen(true);
  }
  function save() {
    const rate = parseFloat(defaultRate);
    if (!code.trim()) return toast.error("请填写货币代码");
    if (!name.trim()) return toast.error("请填写货币名称");
    if (!symbol.trim()) return toast.error("请填写货币符号");
    if (!rate || rate <= 0) return toast.error("请填写有效默认汇率");

    if (editing) {
      // 本位币不可改 code/symbol 的逻辑：仅允许改 name / 汇率
      const patch: Partial<CurrencyDef> = editing.isBase
        ? { name: name.trim() }
        : { name: name.trim(), symbol: symbol.trim(), defaultRate: rate };
      updateCurrency(editing.code, patch);
      toast.success("已更新货币");
      setOpen(false);
      return;
    }

    const res = addCurrency({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      defaultRate: rate,
    });
    if (!res.ok) return toast.error(res.error ?? "新增失败");
    toast.success("已新增货币");
    setOpen(false);
  }
  function remove(c: CurrencyDef) {
    if (c.isBase) return toast.error("本位币不可删除");
    if (!confirm(`删除货币「${c.name} (${c.code})」?`)) return;
    const res = deleteCurrency(c.code);
    if (!res.ok) return toast.error(res.error ?? "删除失败");
    toast.success("已删除");
  }

  return (
    <AppLayout
      title="货币管理"
      actions={
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> 新增货币
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold">已配置货币</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            人民币（CNY）为本位币，所有统计以人民币展示。其他货币需在录入交易时填写当时汇率。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-medium">代码</th>
                <th className="px-5 py-3 text-left font-medium">名称</th>
                <th className="px-5 py-3 text-left font-medium">符号</th>
                <th className="px-5 py-3 text-right font-medium">默认汇率（→ ¥）</th>
                <th className="px-5 py-3 text-right font-medium">使用笔数</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => {
                const used = transactions.filter((t) => t.currency === c.code).length;
                return (
                  <tr key={c.code} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-5 py-3">
                      {c.name}
                      {c.isBase && <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">本位币</span>}
                    </td>
                    <td className="px-5 py-3 text-lg">{c.symbol}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {c.isBase ? "—" : `1 ${c.symbol} = ¥${c.defaultRate}`}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{used}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-expense hover:text-expense disabled:opacity-30"
                          disabled={c.isBase}
                          onClick={() => remove(c)}
                        >
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑货币" : "新增货币"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>代码</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="如 USD"
                  maxLength={6}
                  disabled={!!editing}
                  className="font-mono uppercase"
                />
              </div>
              <div className="grid gap-2">
                <Label>符号</Label>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="如 $"
                  maxLength={3}
                  disabled={editing?.isBase}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 美元" />
            </div>
            <div className="grid gap-2">
              <Label>默认汇率（1 单位本币 = ? 人民币）</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="如 7.2"
                disabled={editing?.isBase}
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                仅作为录入新交易时的默认值，每条记录可覆盖。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? "保存" : "新增"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
