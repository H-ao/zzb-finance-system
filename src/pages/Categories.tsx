import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLedger } from "@/contexts/LedgerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Category, TxType } from "@/lib/types";
import { toast } from "sonner";

const PRESET_COLORS = ["#3B5BFF", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#EF4444", "#84CC16", "#F97316", "#0EA5E9", "#64748B"];

export default function Categories() {
  const { categories, transactions, addCategory, updateCategory, deleteCategory } = useLedger();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<TxType>("income");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  function openNew(t: TxType) {
    setEditing(null);
    setName("");
    setType(t);
    setColor(PRESET_COLORS[0]);
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setType(c.type);
    setColor(c.color);
    setOpen(true);
  }
  function save() {
    if (!name.trim()) return toast.error("请输入分类名称");
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), color });
      toast.success("已更新");
    } else {
      addCategory({ name: name.trim(), type, color });
      toast.success("已新增分类");
    }
    setOpen(false);
  }
  function remove(c: Category) {
    const used = transactions.some((t) => t.categoryId === c.id);
    if (used) {
      toast.error("该分类下还有交易记录，无法删除");
      return;
    }
    if (!confirm(`删除分类「${c.name}」?`)) return;
    deleteCategory(c.id);
    toast.success("已删除");
  }

  const incomeCats = categories.filter((c) => c.type === "income");
  const expenseCats = categories.filter((c) => c.type === "expense");

  return (
    <AppLayout title="分类管理">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryColumn
          title="收入分类"
          accentColor="hsl(var(--income))"
          categories={incomeCats}
          onAdd={() => openNew("income")}
          onEdit={openEdit}
          onRemove={remove}
        />
        <CategoryColumn
          title="支出分类"
          accentColor="hsl(var(--expense))"
          categories={expenseCats}
          onAdd={() => openNew("expense")}
          onEdit={openEdit}
          onRemove={remove}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editing ? "编辑分类" : `新增${type === "income" ? "收入" : "支出"}分类`}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>分类名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：租金 / 销售" />
            </div>
            <div className="grid gap-2">
              <Label>颜色</Label>
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
    </AppLayout>
  );
}

function CategoryColumn({
  title, accentColor, categories, onAdd, onEdit, onRemove,
}: {
  title: string; accentColor: string; categories: Category[];
  onAdd: () => void; onEdit: (c: Category) => void; onRemove: (c: Category) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">({categories.length})</span>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> 新增
        </Button>
      </div>
      <div className="divide-y divide-border">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-sm font-medium">{c.name}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-expense hover:text-expense" onClick={() => onRemove(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无分类</div>
        )}
      </div>
    </div>
  );
}
