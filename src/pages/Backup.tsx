import { useState, useEffect, useRef } from "react";
import { Database, Download, RefreshCw, CheckCircle, Clock, Settings, FileWarning, AlertTriangle } from "lucide-react";
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
  
  // 新增：恢复文件信息
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; valid: boolean; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // 验证文件是否已选择
    if (!selectedFile) {
      toast.error("请先选择要恢复的备份文件", {
        description: "请点击下方虚线框选择 ZIP 格式的备份文件",
        duration: 5000,
      });
      return;
    }

    // 二次验证：文件大小和类型
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (selectedFile.size > maxSize) {
      toast.error("备份文件过大", {
        description: "文件大小不能超过 100MB，当前文件大小：" + fileInfo?.size,
        duration: 5000,
      });
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      toast.error("文件格式错误", {
        description: "请选择 ZIP 格式的备份文件",
        duration: 5000,
      });
      return;
    }

    setRestoreLoading(true);
    
    // 创建进度提示
    const loadingToastId = Math.random().toString(36).slice(2);
    
    try {
      // 阶段 1: 上传文件
      toast.loading("① 正在上传文件...", {
        id: loadingToastId,
        duration: Infinity,
      });
      
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/restore", {
        method: "POST",
        body: formData,
      });

      // 阶段 2: 验证数据
      toast.loading("② 正在验证数据完整性...", {
        id: loadingToastId,
        duration: Infinity,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "恢复失败");
      }

      // 阶段 3: 恢复数据库
      toast.loading("③ 正在恢复数据库...", {
        id: loadingToastId,
        duration: Infinity,
      });

      const result = await response.json();

      // 成功提示
      toast.success("✅ 恢复成功！", {
        id: loadingToastId,
        description: "共恢复 " + (result.stats?.total_records || "多条") + " 条记录，即将刷新页面...",
        duration: 3000,
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "恢复失败";
      
      // 详细错误分类
      let errorDescription = "请稍后重试";
      if (errorMsg.includes("网络") || errorMsg.includes("fetch")) {
        errorDescription = "网络连接失败，请检查网络后重试";
      } else if (errorMsg.includes("ZIP") || errorMsg.includes("格式")) {
        errorDescription = "备份文件格式不正确或已损坏";
      } else if (errorMsg.includes("验证") || errorMsg.includes("损坏")) {
        errorDescription = "备份文件验证失败，可能已损坏";
      } else if (errorMsg.includes("manifest")) {
        errorDescription = "备份文件缺少必要信息";
      }
      
      toast.error("❌ " + errorMsg, {
        id: loadingToastId,
        description: errorDescription,
        duration: 8000,
      });
      
      console.error("Restore error:", error);
    } finally {
      setRestoreLoading(false);
    }
  }

  // 处理文件选择
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileInfo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // 验证文件
    const maxSize = 100 * 1024 * 1024;
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    
    let valid = true;
    let error: string | undefined;
    
    if (!isZip) {
      valid = false;
      error = "请选择 ZIP 格式的文件";
      toast.error("文件格式错误", {
        description: "仅支持 ZIP 格式的备份文件",
        duration: 5000,
      });
    } else if (file.size > maxSize) {
      valid = false;
      error = "文件过大（最大 100MB）";
      toast.error("文件过大", {
        description: "备份文件不能超过 100MB",
        duration: 5000,
      });
    } else if (file.size === 0) {
      valid = false;
      error = "文件为空";
      toast.error("文件为空", {
        description: "请选择有效的备份文件",
        duration: 5000,
      });
    } else {
      // 成功，显示文件信息
      toast.success("✓ 已选择文件", {
        description: `${file.name} (${sizeMB} MB)`,
        duration: 3000,
      });
    }

    setSelectedFile(valid ? file : null);
    setFileInfo({
      name: file.name,
      size: `${sizeMB} MB`,
      valid,
      error,
    });
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
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                id="backup-file"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="backup-file"
                className="flex flex-col items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-all"
                style={{
                  borderColor: fileInfo?.valid === false ? 'hsl(var(--destructive))' : 
                              fileInfo?.valid === true ? 'hsl(var(--success))' : 
                              'hsl(var(--border))'
                }}
              >
                {fileInfo ? (
                  <>
                    {fileInfo.valid ? (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    )}
                    <div className="text-center">
                      <p className="font-medium text-sm">{fileInfo.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fileInfo.size}</p>
                      {!fileInfo.valid && fileInfo.error && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1 justify-center">
                          <FileWarning className="h-3 w-3" />
                          {fileInfo.error}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Database className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">点击选择 ZIP 备份文件</p>
                      <p className="text-xs text-muted-foreground mt-1">支持最大 100MB 的 ZIP 文件</p>
                    </div>
                  </>
                )}
              </label>
              <Button
                type="submit"
                disabled={restoreLoading || !selectedFile}
                variant={selectedFile && fileInfo?.valid ? "default" : "outline"}
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${restoreLoading ? "animate-spin" : ""}`} />
                {restoreLoading ? "正在恢复..." : !selectedFile ? "请先选择文件" : "确认恢复"}
              </Button>
              {selectedFile && fileInfo?.valid && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  警告：此操作将永久覆盖当前所有数据
                </p>
              )}
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