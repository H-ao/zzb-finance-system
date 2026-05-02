import { Advance, Category, CurrencyDef, Shipment, Shop, Transaction } from "./types";

/**
 * API 服务层 - 统一处理所有后端 API 调用
 * 替代原有的 localStorage 存储方式
 */

/**
 * 带重试机制的 API 调用
 * @param fn 要执行的异步函数
 * @param options 配置选项
 */
export async function apiCall<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 800, errorMessage = "操作失败" } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try:
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const msg = error instanceof Error ? error.message : String(error);
      
      console.error(`${errorMessage} (attempt ${attempt}/${maxRetries}):`, msg);
      
      if (isLastAttempt) {
        // 最后一次失败，抛出异常让 UI 层处理
        throw error;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error("Unreachable");
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ========== Shops ==========

export async function fetchShops(): Promise<Shop[]> {
  const response = await fetch("/api/shops");
  return handleResponse<Shop[]>(response);
}

export async function saveShops(shops: Shop[]): Promise<void> {
  const response = await fetch("/api/shops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shops),
  });
  return handleResponse(response);
}

// ========== Categories ==========

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories");
  return handleResponse<Category[]>(response);
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const response = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(categories),
  });
  return handleResponse(response);
}

// ========== Transactions ==========

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await fetch("/api/transactions");
  return handleResponse<Transaction[]>(response);
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const response = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactions),
  });
  return handleResponse(response);
}

// ========== Advances ==========

export async function fetchAdvances(): Promise<Advance[]> {
  const response = await fetch("/api/advances");
  return handleResponse<Advance[]>(response);
}

export async function saveAdvances(advances: Advance[]): Promise<void> {
  const response = await fetch("/api/advances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(advances),
  });
  return handleResponse(response);
}

// ========== Currencies ==========

export async function fetchCurrencies(): Promise<CurrencyDef[]> {
  const response = await fetch("/api/currencies");
  return handleResponse<CurrencyDef[]>(response);
}

export async function saveCurrencies(currencies: CurrencyDef[]): Promise<void> {
  const response = await fetch("/api/currencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currencies),
  });
  return handleResponse(response);
}

// ========== Shipments (Business Reconciliation) ==========

/** 注意：shipments 使用单独的 API 端点 */
export async function fetchShipments(): Promise<Shipment[]> {
  const response = await fetch("/api/reconciliation/list");
  return handleResponse<Shipment[]>(response);
}

/** 单个保存/更新操作 */
export async function saveShipment(shipment: Partial<Shipment>): Promise<{ id: string }> {
  const response = await fetch("/api/reconciliation/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shipment),
  });
  return handleResponse(response);
}

export async function deleteShipmentApi(id: string): Promise<void> {
  const response = await fetch("/api/reconciliation/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return handleResponse(response);
}
