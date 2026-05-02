import { useState, useEffect } from "react";
import { Database, Download, RefreshCw, CheckCircle, Clock, Settings } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Backup() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState(6);
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    fetchBackupConfig();
  }, []);

  async function fetchBackupConfig() {
    try {
      const response = await fetch("/api/config/backup");
      if (response.ok) {
        const data = await response.json();
        setAutoBackupEnabled(data.auto_backup_enabled);
        setAutoBackupInterval(data.auto_backup_interval_hours);
      }
    } catch (error) {
      console.error("Failed to fetch backup config:", error);
    }
  }

  async function handleBackup() {
    if (backupLoading) return;
    setBackupLoading(true);
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "备份失败");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || `backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setLastBackup(new Date().toLocaleString());
      toast.success("备份成功！");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "备份失败，请重试");
      console.error("Backup error:", error);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (restoreLoading) return;

    const form = event.target as HTMLFormElement;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput.files?.[0]) {
      toast.error("请选择备份文件");
      return;
    }

    setRestoreLoading(true);
    try {
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/restore", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "恢复失败");
      }

      const result = await response.json();

      if (result.refresh) {
        toast.success(result.message || "数据已恢复，请刷新页面");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.success("恢复成功！数据已更新，请刷新页面查看");
        setTimeout(() => {
          window.location.href = window.location.pathname;
        }, 1500);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败，请重试");
      console.error("Restore error:", error);
    } finally {
      setRestoreLoading(false);
      form.reset();
    }
  }

  async function handleAutoBackupToggle(checked: boolean) {
    setConfigLoading(true);
    try {
      const response = await fetch("/api/config/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: checked,
          interval_hours: autoBackupInterval,
        }),
      });

      if (!response.ok) {
        throw new Error("配置保存失败");
      }

      setAutoBackupEnabled(checked);
      toast.success(checked ? "自动备份已开启" : "自动备份已关闭");
    } catch (error) {
      toast.error("配置保存失败");
      console.error("Config save error:", error);
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleIntervalChange(value: string) {
    const interval = parseInt(value, 10);
    setConfigLoading(true);
    try {
      const response = await fetch("/api/config/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: autoBackupEnabled,
          interval_hours: interval,
        }),
      });

      if (!response.ok) {
        throw new Error("配置保存失败");
      }

      setAutoBackupInterval(interval);
      toast.success(`自动备份间隔已更新为 ${interval} 小时`);
    } catch (error) {
      toast.error("配置保存失败");
      console.error("Config save error:", error);
    } finally {
      setConfigLoading(false);
    }
  }

  return (
    <AppLayout
      title="数据备份"
      icon={<Database className="h-5 w-5" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              创建备份
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              将所有数据导出为 ZIP 备份包，包括数据库副本、CSV 导出文件和完整性校验信息。
            </p>
            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-green-600 mb-4">
                <CheckCircle className="h-4 w-4" />
                上次备份：{lastBackup}
              </div>
            )}
            <Button
              onClick={handleBackup}
              disabled={backupLoading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${backupLoading ? "animate-spin" : ""}`} />
              {backupLoading ? "备份中..." : "立即备份"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              恢复备份
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              从之前创建的 ZIP 备份包恢复数据。此操作将覆盖当前所有数据，请谨慎操作。
            </p>
            <form onSubmit={handleRestore} className="space-y-4">
              <input
                type="file"
                accept=".zip"
                className="hidden"
                id="backup-file"
              />
              <label
                htmlFor="backup-file"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors"
              >
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">上传 ZIP 备份文件以恢复数据</span>
              </label>
              <Button
                type="submit"
                disabled={restoreLoading}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${restoreLoading ? "animate-spin" : ""}`} />
                {restoreLoading ? "恢复中..." : "恢复数据"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              自动备份设置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="auto-backup-enabled"
                  checked={autoBackupEnabled}
                  onCheckedChange={handleAutoBackupToggle}
                  disabled={configLoading}
                />
                <Label htmlFor="auto-backup-enabled" className="cursor-pointer">
                  启用自动备份
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="auto-backup-interval" className="whitespace-nowrap">
                  备份间隔：
                </Label>
                <Select
                  value={autoBackupInterval.toString()}
                  onValueChange={handleIntervalChange}
                  disabled={configLoading || !autoBackupEnabled}
                >
                  <SelectTrigger id="auto-backup-interval" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 小时</SelectItem>
                    <SelectItem value="12">12 小时</SelectItem>
                    <SelectItem value="24">24 小时</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!autoBackupEnabled && (
                <p className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  自动备份已禁用
                </p>
              )}
              {autoBackupEnabled && (
                <p className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  每 {autoBackupInterval} 小时自动备份一次
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}