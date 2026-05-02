import { useMemo, useState } from "react";
import { Plus, Download, Search, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Advance } from "@/lib/types";
import { AdvanceDialog } from "@/components/advances/AdvanceDialog";
import { formatCNY, formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 12;

export default function Advances() {
  const { advances, updateAdvance, deleteAdvance, deleteAdvances } = useLedger();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);

  const filtered = useMemo(() => {
    return advances
      .filter((a) => {
        if (statusFilter === "settled" && !a.settled) return false;
        if (statusFilter === "open" && a.settled) return false;
        if (search) {
          const s = search.toLowerCase();
          const note = a.note?.toLowerCase() ?? "";
          if (!a.project.toLowerCase().includes(s) && !note.includes(s) && !String(a.amount).includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }, [advances, search, statusFilter]);

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
    deleteAdvance(id);
    toast.success("已删除");
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    deleteAdvances(Array.from(selected));
    setSelected(new Set());
    toast.success(`已删除 ${selected.size} 条`);
  }

  function handleToggleSettled(a: Advance, next: boolean) {
    updateAdvance(a.id, { settled: next });
    toast.success(next ? "已标记为已结" : "已标记为未结");
  }

  function handleExport() {
    const headers = ["日期", "项目", "垫付金额", "已回款", "未回款", "状态", "备注"];
    const rows = filtered.map((a) => [
      a.date,
      a.project,
      a.amount.toFixed(2),
      (a.repaidAmount ?? 0).toFixed(2),
      Math.max(0, a.amount - (a.repaidAmount ?? 0)).toFixed(2),
      a.settled ? "已结" : "未结",
      a.note ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出 CSV");
  }

  const allChecked = pageData.length > 0 && pageData.every((t) => selected.has(t.id));

  // 汇总
  const summary = useMemo(() => {
    const open = advances.filter((a) => !a.settled);
    const outstanding = open.reduce((s, a) => s + Math.max(0, a.amount - (a.repaidAmount ?? 0)), 0);
    const totalAdvanced = advances.reduce((s, a) => s + a.amount, 0);
    const totalRepaid = advances.reduce((s, a) => s + (a.repaidAmount ?? 0), 0);
    return { outstanding, totalAdvanced, totalRepaid, openCount: open.length };
  }, [advances]);

  return (
    <AppLayout
      title="垫付记录"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> 导出
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> 新增垫付
          </Button>
        </>
      }
    >
      {/* 概要卡片 */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="待回款" value={formatCNY(summary.outstanding)} hint={`${summary.openCount} 笔未结`} tone="primary" />
        <SummaryCard label="累计垫付" value={formatCNY(summary.totalAdvanced)} tone="neutral" />
        <SummaryCard label="累计回款" value={formatCNY(summary.totalRepaid)} tone="income" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        {/* 筛选区 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索项目、备注或金额..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="open">未结</SelectItem>
              <SelectItem value="settled">已结</SelectItem>
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
                <th className="px-4 py-3 text-left font-medium">项目</th>
                <th className="px-4 py-3 text-right font-medium">垫付金额</th>
                <th className="px-4 py-3 text-right font-medium">已回款 / 未回款</th>
                <th className="px-4 py-3 text-left font-medium">备注</th>
                <th className="px-4 py-3 text-center font-medium">状态</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((a) => {
                const remaining = Math.max(0, a.amount - (a.repaidAmount ?? 0));
                return (
                  <tr key={a.id} className={cn("border-b border-border last:border-0 hover:bg-muted/30", a.settled && "opacity-70")}>
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDateLong(a.date)}</td>
                    <td className="px-4 py-3 font-medium">{a.project}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCNY(a.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-income">{formatCNY(a.repaidAmount ?? 0)}</span>
                        <span className="text-[11px] text-muted-foreground">
                          剩 <span className={cn(remaining > 0 ? "text-expense font-medium" : "text-muted-foreground")}>{formatCNY(remaining)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.note || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={a.settled}
                          onCheckedChange={(v) => handleToggleSettled(a, v)}
                        />
                        <span className={cn("text-xs font-medium", a.settled ? "text-income" : "text-muted-foreground")}>
                          {a.settled ? "已结" : "未结"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-expense hover:text-expense" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">暂无垫付记录</td>
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

      <AdvanceDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </AppLayout>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "primary" | "income" | "neutral" }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "income" ? "text-income" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
