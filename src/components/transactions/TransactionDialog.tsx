import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLedger } from "@/contexts/LedgerContext";
import { Transaction, PaymentMethod, TxType, CurrencyCode, PAYMENT_METHOD_LABELS, BASE_CURRENCY } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCNY } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Transaction | null;
}

export function TransactionDialog({ open, onOpenChange, editing }: Props) {
  const { allShops, categories, currencies, currencyMap, addTransaction, updateTransaction } = useLedger();

  const [date, setDate] = useState<Date>(new Date());
  const [shopId, setShopId] = useState<string>("");
  const [type, setType] = useState<TxType>("income");
  const [categoryId, setCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [currency, setCurrency] = useState<CurrencyCode>(BASE_CURRENCY);
  const [amount, setAmount] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const currentCurrency = currencyMap.get(currency);
  const isBase = currentCurrency?.isBase ?? currency === BASE_CURRENCY;

  useEffect(() => {
    if (open) {
      if (editing) {
        setDate(new Date(editing.date));
        setShopId(editing.shopId ?? "");
        setType(editing.type);
        setCategoryId(editing.categoryId);
        setPaymentMethod(editing.paymentMethod);
        setCurrency(editing.currency ?? BASE_CURRENCY);
        setAmount(String(editing.amount));
        setExchangeRate(
          editing.exchangeRate
            ? String(editing.exchangeRate)
            : String(currencyMap.get(editing.currency ?? BASE_CURRENCY)?.defaultRate ?? ""),
        );
        setNote(editing.note ?? "");
      } else {
        setDate(new Date());
        setShopId("");
        setType("income");
        setCategoryId("");
        setPaymentMethod("wechat");
        setCurrency(BASE_CURRENCY);
        setAmount("");
        setExchangeRate("");
        setNote("");
      }
    }
  }, [open, editing, allShops, currencyMap]);

  // 切换货币时自动填默认汇率
  useEffect(() => {
    if (!open) return;
    const def = currencyMap.get(currency);
    if (def && !def.isBase) {
      setExchangeRate((prev) => (prev ? prev : String(def.defaultRate)));
    }
  }, [currency, currencyMap, open]);

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (categoryId && !filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? "");
    } else if (!categoryId && filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, categoryId]);

  const convertedCNY = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return 0;
    if (isBase) return amt;
    const rate = parseFloat(exchangeRate);
    if (!rate || rate <= 0) return 0;
    return Math.round(amt * rate * 100) / 100;
  }, [amount, isBase, exchangeRate]);

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!categoryId) return toast.error("请选择分类");
    if (!amt || amt <= 0) return toast.error("请输入有效金额");

    let amountCNY = amt;
    let rate: number | undefined;
    if (!isBase) {
      rate = parseFloat(exchangeRate);
      if (!rate || rate <= 0) return toast.error("请输入有效汇率");
      amountCNY = Math.round(amt * rate * 100) / 100;
    }

    const payload = {
      date: format(date, "yyyy-MM-dd"),
      shopId: shopId || undefined,
      type,
      categoryId,
      paymentMethod,
      amount: Math.round(amt * 100) / 100,
      currency,
      exchangeRate: rate,
      amountCNY,
      note: note.trim() || undefined,
    };

    if (editing) {
      updateTransaction(editing.id, payload);
      toast.success("已更新交易");
    } else {
      addTransaction(payload);
      toast.success("已新增交易");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑交易" : "新增交易"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as TxType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "yyyy-MM-dd") : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>店铺 <span className="text-xs font-normal text-muted-foreground">（可选）</span></Label>
            <Select value={shopId || "__none__"} onValueChange={(v) => setShopId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="选择店铺" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">不指定店铺</span>
                </SelectItem>
                {allShops.map((s) => (
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
              <Label>分类</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>支付方式</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>币种</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} {c.symbol} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>金额（{currentCurrency?.symbol ?? ""}）</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          {!isBase && (
            <div className="grid gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="grid gap-2">
                  <Label className="text-xs">汇率（1 {currentCurrency?.symbol ?? currency} = ? ¥）</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder={currentCurrency ? `如 ${currentCurrency.defaultRate}` : "如 0.21"}
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="tabular-nums h-9"
                  />
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">折合人民币</div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-primary">
                    {formatCNY(convertedCNY)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>备注（可选）</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="补充说明..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>{editing ? "保存" : "新增"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
