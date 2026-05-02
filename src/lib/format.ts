import { CurrencyCode, CurrencyDef } from "./types";

export function formatCNY(n: number, opts?: { sign?: boolean }) {
  const sign = opts?.sign && n > 0 ? "+" : "";
  return sign + "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 通用金额格式化：用给定符号 + 数字 */
export function formatWithSymbol(n: number, symbol: string, opts?: { sign?: boolean }) {
  const sign = opts?.sign && n > 0 ? "+" : "";
  return sign + symbol + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 兼容旧调用：根据货币定义 map 取符号 */
export function formatCurrency(
  n: number,
  currency: CurrencyCode,
  currencyMap: Map<CurrencyCode, CurrencyDef>,
  opts?: { sign?: boolean },
) {
  const sym = currencyMap.get(currency)?.symbol ?? currency + " ";
  return formatWithSymbol(n, sym, opts);
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateLong(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
