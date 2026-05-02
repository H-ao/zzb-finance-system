import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Advance, Category, CurrencyCode, CurrencyDef, Shipment, Shop, Transaction, WAREHOUSE_SHOP, WAREHOUSE_SHOP_ID } from "@/lib/types";
import { seedIfEmpty, storage, uid } from "@/lib/storage";

interface LedgerContextValue {
  shops: Shop[];
  /** 包含固定"待分配总仓"的完整店铺列表，用于下拉/查找展示 */
  allShops: Shop[];
  categories: Category[];
  transactions: Transaction[];
  advances: Advance[];
  shipments: Shipment[];
  currencies: CurrencyDef[];
  currencyMap: Map<CurrencyCode, CurrencyDef>;
  // shops
  addShop: (s: Omit<Shop, "id" | "createdAt">) => void;
  updateShop: (id: string, patch: Partial<Shop>) => void;
  deleteShop: (id: string) => void;
  // categories
  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  // transactions
  addTransaction: (t: Omit<Transaction, "id" | "createdAt">) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  deleteTransactions: (ids: string[]) => void;
  // advances
  addAdvance: (a: Omit<Advance, "id" | "createdAt">) => void;
  updateAdvance: (id: string, patch: Partial<Advance>) => void;
  deleteAdvance: (id: string) => void;
  deleteAdvances: (ids: string[]) => void;
  // shipments (业务核算 - 独立于 transactions)
  addShipment: (s: Omit<Shipment, "id" | "createdAt">) => void;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  deleteShipment: (id: string) => void;
  // currencies
  addCurrency: (c: CurrencyDef) => { ok: boolean; error?: string };
  updateCurrency: (code: CurrencyCode, patch: Partial<Omit<CurrencyDef, "code" | "isBase">>) => void;
  deleteCurrency: (code: CurrencyCode) => { ok: boolean; error?: string };
  // helpers
  getShop: (id?: string) => Shop | undefined;
  getCategory: (id: string) => Category | undefined;
  getCurrency: (code: CurrencyCode) => CurrencyDef | undefined;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyDef[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    setShops(storage.getShops());
    setCategories(storage.getCategories());
    setTransactions(storage.getTransactions());
    setAdvances(storage.getAdvances());
    setShipments(storage.getShipments());
    setCurrencies(storage.getCurrencies());
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) storage.setShops(shops); }, [shops, hydrated]);
  useEffect(() => { if (hydrated) storage.setCategories(categories); }, [categories, hydrated]);
  useEffect(() => { if (hydrated) storage.setTransactions(transactions); }, [transactions, hydrated]);
  useEffect(() => { if (hydrated) storage.setAdvances(advances); }, [advances, hydrated]);
  useEffect(() => { if (hydrated) storage.setShipments(shipments); }, [shipments, hydrated]);
  useEffect(() => { if (hydrated) storage.setCurrencies(currencies); }, [currencies, hydrated]);

  const addShop: LedgerContextValue["addShop"] = useCallback((s) => {
    setShops((prev) => [...prev, { ...s, id: uid(), createdAt: new Date().toISOString() }]);
  }, []);
  const updateShop: LedgerContextValue["updateShop"] = useCallback((id, patch) => {
    setShops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);
  const deleteShop: LedgerContextValue["deleteShop"] = useCallback((id) => {
    setShops((prev) => prev.filter((s) => s.id !== id));
    setTransactions((prev) => prev.filter((t) => t.shopId !== id));
  }, []);

  const addCategory: LedgerContextValue["addCategory"] = useCallback((c) => {
    setCategories((prev) => [...prev, { ...c, id: uid() }]);
  }, []);
  const updateCategory: LedgerContextValue["updateCategory"] = useCallback((id, patch) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const deleteCategory: LedgerContextValue["deleteCategory"] = useCallback((id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addTransaction: LedgerContextValue["addTransaction"] = useCallback((t) => {
    setTransactions((prev) => [{ ...t, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
  }, []);
  const updateTransaction: LedgerContextValue["updateTransaction"] = useCallback((id, patch) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);
  const deleteTransaction: LedgerContextValue["deleteTransaction"] = useCallback((id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const deleteTransactions: LedgerContextValue["deleteTransactions"] = useCallback((ids) => {
    const set = new Set(ids);
    setTransactions((prev) => prev.filter((t) => !set.has(t.id)));
  }, []);

  const addAdvance: LedgerContextValue["addAdvance"] = useCallback((a) => {
    setAdvances((prev) => [{ ...a, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
  }, []);
  const updateAdvance: LedgerContextValue["updateAdvance"] = useCallback((id, patch) => {
    setAdvances((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const deleteAdvance: LedgerContextValue["deleteAdvance"] = useCallback((id) => {
    setAdvances((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const deleteAdvances: LedgerContextValue["deleteAdvances"] = useCallback((ids) => {
    const set = new Set(ids);
    setAdvances((prev) => prev.filter((a) => !set.has(a.id)));
  }, []);

  const addShipment: LedgerContextValue["addShipment"] = useCallback(async (s) => {
    try {
      const response = await fetch("/api/reconciliation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "保存失败");
      }
      const result = await response.json();
      const newShipment = { ...s, id: result.id, createdAt: new Date().toISOString() };
      setShipments((prev) => [newShipment, ...prev]);
    } catch (error) {
      console.error("Failed to add shipment:", error);
      throw error;
    }
  }, []);
  const updateShipment: LedgerContextValue["updateShipment"] = useCallback(async (id, patch) => {
    try {
      const response = await fetch("/api/reconciliation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "更新失败");
      }
      setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    } catch (error) {
      console.error("Failed to update shipment:", error);
      throw error;
    }
  }, []);
  const deleteShipment: LedgerContextValue["deleteShipment"] = useCallback(async (id) => {
    try {
      const response = await fetch("/api/reconciliation/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "删除失败");
      }
      setShipments((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete shipment:", error);
      throw error;
    }
  }, []);

  const addCurrency: LedgerContextValue["addCurrency"] = useCallback((c) => {
    const code = c.code.trim().toUpperCase();
    if (!code) return { ok: false, error: "请填写货币代码" };
    if (!c.symbol.trim()) return { ok: false, error: "请填写货币符号" };
    if (!c.name.trim()) return { ok: false, error: "请填写货币名称" };
    if (!c.defaultRate || c.defaultRate <= 0) return { ok: false, error: "请填写有效的默认汇率" };
    let result: { ok: boolean; error?: string } = { ok: true };
    setCurrencies((prev) => {
      if (prev.some((x) => x.code === code)) {
        result = { ok: false, error: `货币 ${code} 已存在` };
        return prev;
      }
      return [...prev, { ...c, code, isBase: false }];
    });
    return result;
  }, []);
  const updateCurrency: LedgerContextValue["updateCurrency"] = useCallback((code, patch) => {
    setCurrencies((prev) => prev.map((c) => (c.code === code ? { ...c, ...patch } : c)));
  }, []);
  const deleteCurrency: LedgerContextValue["deleteCurrency"] = useCallback((code) => {
    if (code === "CNY") return { ok: false, error: "本位币不可删除" };
    const used = transactions.some((t) => t.currency === code);
    if (used) return { ok: false, error: "该货币下还有交易记录，无法删除" };
    setCurrencies((prev) => prev.filter((c) => c.code !== code));
    return { ok: true };
  }, [transactions]);

  const allShops = useMemo(() => [...shops, WAREHOUSE_SHOP], [shops]);
  const shopMap = useMemo(() => {
    const m = new Map(shops.map((s) => [s.id, s]));
    m.set(WAREHOUSE_SHOP_ID, WAREHOUSE_SHOP);
    return m;
  }, [shops]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const currencyMap = useMemo(() => new Map(currencies.map((c) => [c.code, c])), [currencies]);

  const value: LedgerContextValue = {
    shops, allShops, categories, transactions, advances, shipments, currencies, currencyMap,
    addShop, updateShop, deleteShop,
    addCategory, updateCategory, deleteCategory,
    addTransaction, updateTransaction, deleteTransaction, deleteTransactions,
    addAdvance, updateAdvance, deleteAdvance, deleteAdvances,
    addShipment, updateShipment, deleteShipment,
    addCurrency, updateCurrency, deleteCurrency,
    getShop: (id) => (id ? shopMap.get(id) : undefined),
    getCategory: (id) => catMap.get(id),
    getCurrency: (code) => currencyMap.get(code),
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
