import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { Advance, Category, CurrencyCode, CurrencyDef, Shipment, Shop, Transaction, WAREHOUSE_SHOP, WAREHOUSE_SHOP_ID } from "@/lib/types";
import {
  fetchShops, saveShops,
  fetchCategories, saveCategories,
  fetchTransactions, saveTransactions,
  fetchAdvances, saveAdvances,
  fetchCurrencies, saveCurrencies,
  fetchShipments, saveShipment, deleteShipmentApi,
  apiCall,
} from "@/lib/api";
import { uid } from "@/lib/storage";
import { toast } from "sonner";

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
  /** 数据加载状态 */
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  // 初始化时从 API 加载所有数据
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [shopsData, categoriesData, transactionsData, advancesData, currenciesData, shipmentsData] = await Promise.all([
        fetchShops(),
        fetchCategories(),
        fetchTransactions(),
        fetchAdvances(),
        fetchCurrencies(),
        fetchShipments(),
      ]);

      setShops(shopsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
      setAdvances(advancesData);
      setCurrencies(currenciesData);
      setShipments(shipmentsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("加载数据失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useMemo(() => {
    loadAllData();
  }, [loadAllData]);

  // 数据变更时同步到后端 API
  const saveShopsToApi = useCallback(async (newShops: Shop[]) => {
    await apiCall(() => saveShops(newShops), {
      errorMessage: "保存店铺失败",
      maxRetries: 3,
    });
  }, []);

  const saveCategoriesToApi = useCallback(async (newCategories: Category[]) => {
    await apiCall(() => saveCategories(newCategories), {
      errorMessage: "保存分类失败",
      maxRetries: 3,
    });
  }, []);

  const saveTransactionsToApi = useCallback(async (newTransactions: Transaction[]) => {
    await apiCall(() => saveTransactions(newTransactions), {
      errorMessage: "保存交易失败",
      maxRetries: 3,
    });
  }, []);

  const saveAdvancesToApi = useCallback(async (newAdvances: Advance[]) => {
    await apiCall(() => saveAdvances(newAdvances), {
      errorMessage: "保存垫付失败",
      maxRetries: 3,
    });
  }, []);

  const saveCurrenciesToApi = useCallback(async (newCurrencies: CurrencyDef[]) => {
    await apiCall(() => saveCurrencies(newCurrencies), {
      errorMessage: "保存货币失败",
      maxRetries: 3,
    });
  }, []);

  const addShop: LedgerContextValue["addShop"] = useCallback((s) => {
    const newShop = { ...s, id: uid(), createdAt: new Date().toISOString() };
    setShops((prev) => {
      const updated = [...prev, newShop];
      saveShopsToApi(updated);
      return updated;
    });
  }, [saveShopsToApi]);

  const updateShop: LedgerContextValue["updateShop"] = useCallback((id, patch) => {
    setShops((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      saveShopsToApi(updated);
      return updated;
    });
  }, [saveShopsToApi]);

  const deleteShop: LedgerContextValue["deleteShop"] = useCallback((id) => {
    // 1. 删除店铺
    setShops((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveShopsToApi(updated);
      return updated;
    });
    
    // 2. 同时删除该店铺的交易并同步到 API
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.shopId !== id);
      saveTransactionsToApi(updated);
      return updated;
    });
  }, [saveShopsToApi, saveTransactionsToApi]);

  const addCategory: LedgerContextValue["addCategory"] = useCallback((c) => {
    const newCategory = { ...c, id: uid() };
    setCategories((prev) => {
      const updated = [...prev, newCategory];
      saveCategoriesToApi(updated);
      return updated;
    });
  }, [saveCategoriesToApi]);

  const updateCategory: LedgerContextValue["updateCategory"] = useCallback((id, patch) => {
    setCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      saveCategoriesToApi(updated);
      return updated;
    });
  }, [saveCategoriesToApi]);

  const deleteCategory: LedgerContextValue["deleteCategory"] = useCallback((id) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveCategoriesToApi(updated);
      return updated;
    });
  }, [saveCategoriesToApi]);

  const addTransaction: LedgerContextValue["addTransaction"] = useCallback((t) => {
    const newTx = { ...t, id: uid(), createdAt: new Date().toISOString() };
    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      saveTransactionsToApi(updated);
      return updated;
    });
  }, [saveTransactionsToApi]);

  const updateTransaction: LedgerContextValue["updateTransaction"] = useCallback((id, patch) => {
    setTransactions((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      saveTransactionsToApi(updated);
      return updated;
    });
  }, [saveTransactionsToApi]);

  const deleteTransaction: LedgerContextValue["deleteTransaction"] = useCallback((id) => {
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTransactionsToApi(updated);
      return updated;
    });
  }, [saveTransactionsToApi]);

  const deleteTransactions: LedgerContextValue["deleteTransactions"] = useCallback((ids) => {
    const idSet = new Set(ids);
    setTransactions((prev) => {
      const updated = prev.filter((t) => !idSet.has(t.id));
      saveTransactionsToApi(updated);
      return updated;
    });
  }, [saveTransactionsToApi]);

  const addAdvance: LedgerContextValue["addAdvance"] = useCallback((a) => {
    const newAdvance = { ...a, id: uid(), createdAt: new Date().toISOString() };
    setAdvances((prev) => {
      const updated = [newAdvance, ...prev];
      saveAdvancesToApi(updated);
      return updated;
    });
  }, [saveAdvancesToApi]);

  const updateAdvance: LedgerContextValue["updateAdvance"] = useCallback((id, patch) => {
    setAdvances((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      saveAdvancesToApi(updated);
      return updated;
    });
  }, [saveAdvancesToApi]);

  const deleteAdvance: LedgerContextValue["deleteAdvance"] = useCallback((id) => {
    setAdvances((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      saveAdvancesToApi(updated);
      return updated;
    });
  }, [saveAdvancesToApi]);

  const deleteAdvances: LedgerContextValue["deleteAdvances"] = useCallback((ids) => {
    const idSet = new Set(ids);
    setAdvances((prev) => {
      const updated = prev.filter((a) => !idSet.has(a.id));
      saveAdvancesToApi(updated);
      return updated;
    });
  }, [saveAdvancesToApi]);

  // Shipments - 这些已经在使用 API，保持但稍作调整
  const addShipment: LedgerContextValue["addShipment"] = useCallback(async (s) => {
    const result = await saveShipment(s);
    const newShipment = { ...s, id: result.id, createdAt: new Date().toISOString() };
    setShipments((prev) => [newShipment, ...prev]);
  }, []);

  const updateShipment: LedgerContextValue["updateShipment"] = useCallback(async (id, patch) => {
    await saveShipment({ id, ...patch });
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteShipment: LedgerContextValue["deleteShipment"] = useCallback(async (id) => {
    await deleteShipmentApi(id);
    setShipments((prev) => prev.filter((s) => s.id !== id));
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
      const updated = [...prev, { ...c, code, isBase: false }];
      saveCurrenciesToApi(updated);
      return updated;
    });
    return result;
  }, [saveCurrenciesToApi]);

  const updateCurrency: LedgerContextValue["updateCurrency"] = useCallback((code, patch) => {
    setCurrencies((prev) => {
      const updated = prev.map((c) => (c.code === code ? { ...c, ...patch } : c));
      saveCurrenciesToApi(updated);
      return updated;
    });
  }, [saveCurrenciesToApi]);

  const deleteCurrency: LedgerContextValue["deleteCurrency"] = useCallback((code) => {
    if (code === "CNY") return { ok: false, error: "本位币不可删除" };
    const used = transactions.some((t) => t.currency === code);
    if (used) return { ok: false, error: "该货币下还有交易记录，无法删除" };
    
    setCurrencies((prev) => {
      const updated = prev.filter((c) => c.code !== code);
      saveCurrenciesToApi(updated);
      return updated;
    });
    return { ok: true };
  }, [transactions, saveCurrenciesToApi]);

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
    loading,
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

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">加载数据中...</p>
        </div>
      </div>
    );
  }

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
