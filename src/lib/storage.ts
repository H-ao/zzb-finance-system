import { Advance, Category, CurrencyDef, Shipment, Shop, Transaction } from "./types";

const KEYS = {
  shops: "ledger.shops.v1",
  categories: "ledger.categories.v1",
  transactions: "ledger.transactions.v1",
  advances: "ledger.advances.v1",
  currencies: "ledger.currencies.v1",
  shipments: "ledger.shipments.v1",
  seeded: "ledger.seeded.v1",
};

const DEFAULT_CURRENCIES: CurrencyDef[] = [
  { code: "CNY", name: "人民币", symbol: "¥", defaultRate: 1, isBase: true },
  { code: "THB", name: "泰铢", symbol: "฿", defaultRate: 0.21 },
];

function ensureCurrencies(list: CurrencyDef[]): CurrencyDef[] {
  // 必须包含本位币 CNY
  if (!list.some((c) => c.code === "CNY")) {
    return [DEFAULT_CURRENCIES[0], ...list];
  }
  return list;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function migrateTransactions(txs: Transaction[]): Transaction[] {
  let changed = false;
  const out = txs.map((t) => {
    if (!t.currency || t.amountCNY === undefined) {
      changed = true;
      return {
        ...t,
        currency: t.currency ?? "CNY",
        amountCNY: t.amountCNY ?? t.amount,
      } as Transaction;
    }
    return t;
  });
  if (changed) write(KEYS.transactions, out);
  return out;
}

export const storage = {
  getShops: () => read<Shop[]>(KEYS.shops, []),
  setShops: (v: Shop[]) => write(KEYS.shops, v),
  getCategories: () => read<Category[]>(KEYS.categories, []),
  setCategories: (v: Category[]) => write(KEYS.categories, v),
  getTransactions: () => migrateTransactions(read<Transaction[]>(KEYS.transactions, [])),
  setTransactions: (v: Transaction[]) => write(KEYS.transactions, v),
  getAdvances: () => read<Advance[]>(KEYS.advances, []),
  setAdvances: (v: Advance[]) => write(KEYS.advances, v),
  getCurrencies: () => ensureCurrencies(read<CurrencyDef[]>(KEYS.currencies, DEFAULT_CURRENCIES)),
  setCurrencies: (v: CurrencyDef[]) => write(KEYS.currencies, ensureCurrencies(v)),
  getShipments: () => read<Shipment[]>(KEYS.shipments, []),
  setShipments: (v: Shipment[]) => write(KEYS.shipments, v),
  isSeeded: () => localStorage.getItem(KEYS.seeded) === "1",
  markSeeded: () => localStorage.setItem(KEYS.seeded, "1"),
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function seedIfEmpty() {
  if (storage.isSeeded()) return;

  const shops: Shop[] = [
    { id: uid(), name: "南山旗舰店", color: "#3B5BFF", createdAt: new Date().toISOString() },
    { id: uid(), name: "宝安分店", color: "#10B981", createdAt: new Date().toISOString() },
    { id: uid(), name: "龙华社区店", color: "#F59E0B", createdAt: new Date().toISOString() },
  ];

  const categories: Category[] = [
    { id: uid(), name: "销售", type: "income", color: "#10B981" },
    { id: uid(), name: "其他收入", type: "income", color: "#06B6D4" },
    { id: uid(), name: "退款冲销", type: "income", color: "#84CC16" },
    { id: uid(), name: "租金", type: "expense", color: "#EF4444" },
    { id: uid(), name: "工资", type: "expense", color: "#F97316" },
    { id: uid(), name: "进货", type: "expense", color: "#8B5CF6" },
    { id: uid(), name: "水电", type: "expense", color: "#0EA5E9" },
    { id: uid(), name: "营销", type: "expense", color: "#EC4899" },
    { id: uid(), name: "其他支出", type: "expense", color: "#64748B" },
  ];

  // 生成最近 30 天的交易示例
  const txs: Transaction[] = [];
  const incomeCats = categories.filter((c) => c.type === "income");
  const expenseCats = categories.filter((c) => c.type === "expense");
  const methods: Transaction["paymentMethod"][] = ["cash", "wechat", "alipay", "bank"];

  for (let d = 0; d < 30; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const iso = date.toISOString().slice(0, 10);

    shops.forEach((s) => {
      // 每店每天 1-3 笔收入
      const incomeCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < incomeCount; i++) {
        const c = incomeCats[Math.floor(Math.random() * incomeCats.length)];
        const amt = Math.round((300 + Math.random() * 2700) * 100) / 100;
        txs.push({
          id: uid(),
          date: iso,
          shopId: s.id,
          type: "income",
          categoryId: c.id,
          paymentMethod: methods[Math.floor(Math.random() * methods.length)],
          amount: amt,
          currency: "CNY",
          amountCNY: amt,
          createdAt: date.toISOString(),
        });
      }
      // 0-2 笔支出
      const expenseCount = Math.floor(Math.random() * 3);
      for (let i = 0; i < expenseCount; i++) {
        const c = expenseCats[Math.floor(Math.random() * expenseCats.length)];
        const amt = Math.round((100 + Math.random() * 1500) * 100) / 100;
        txs.push({
          id: uid(),
          date: iso,
          shopId: s.id,
          type: "expense",
          categoryId: c.id,
          paymentMethod: methods[Math.floor(Math.random() * methods.length)],
          amount: amt,
          currency: "CNY",
          amountCNY: amt,
          createdAt: date.toISOString(),
        });
      }
    });
  }

  storage.setShops(shops);
  storage.setCategories(categories);
  storage.setTransactions(txs);
  storage.markSeeded();
}
