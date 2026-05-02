import { useEffect } from "react";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLedger } from "@/contexts/LedgerContext";
import { Advance } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Advance | null;
}

export function AdvanceDialog({ open, onOpenChange, editing }: Props) {
  const { addAdvance, updateAdvance } = useLedger();

  const [date, setDate] = useState<Date>(new Date());
  const [project, setProject] = useState("");
  const [amount, setAmount] = useState("");
  const [repaidAmount, setRepaidAmount] = useState("0");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      if (editing) {
        setDate(new Date(editing.date));
        setProject(editing.project);
        setAmount(String(editing.amount));
        setRepaidAmount(String(editing.repaidAmount ?? 0));
        setNote(editing.note ?? "");
      } else {
        setDate(new Date());
        setProject("");
        setAmount("");
        setRepaidAmount("0");
        setNote("");
      }
    }
  }, [open, editing]);

  function handleSubmit() {
    const amt = parseFloat(amount);
    const rep = parseFloat(repaidAmount) || 0;
    if (!project.trim()) return toast.error("请输入项目名称");
    if (!amt || amt <= 0) return toast.error("请输入有效金额");
    if (rep < 0) return toast.error("回款金额不能为负数");

    const payload = {
      date: format(date, "yyyy-MM-dd"),
      project: project.trim(),
      amount: Math.round(amt * 100) / 100,
      repaidAmount: Math.round(rep * 100) / 100,
      settled: editing?.settled ?? false,
      note: note.trim() || undefined,
    };

    if (editing) {
      updateAdvance(editing.id, payload);
      toast.success("已更新垫付记录");
    } else {
      addAdvance(payload);
      toast.success("已新增垫付记录");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑垫付记录" : "新增垫付记录"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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

          <div className="grid gap-2">
            <Label>项目</Label>
            <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="例如：代付供应商货款" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>垫付金额（¥）</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>已回款（¥）</Label>
              <Input type="number" step="0.01" min="0" value={repaidAmount} onChange={(e) => setRepaidAmount(e.target.value)} className="tabular-nums" placeholder="0.00" />
            </div>
          </div>

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
