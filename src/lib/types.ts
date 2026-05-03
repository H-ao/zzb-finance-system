export type TxType = "income" | "expense";

export type PaymentMethod = "alipay" | "wechat";

/** 货币代码，例如 "CNY" / "THB" / "USD"，用户可自行管理 */
export type CurrencyCode = string;

export interface CurrencyDef {
  /** 大写代码，作为唯一 ID */
  code: CurrencyCode;
  /** 显示名称，如 "人民币" / "美元" */
  name: string;
  /** 符号，如 "¥" / "$" */
  symbol: string;
  /** 默认对人民币汇率（1 单位本币 = ? CNY），仅作为录入时的默认值 */
  defaultRate: number;
  /** 是否为本位币（CNY），不可删除、不需要汇率 */
  isBase?: boolean;
}

export interface Shop {
  id: string;
  name: string;
  color: string; // hex
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: string; // hex
}

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  /** 所属店铺，可选（支出可不指定） */
  shopId?: string;
  type: TxType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  /** 原币金额（按 currency 计） */
  amount: number;
  /** 币种代码，老数据默认 CNY */
  currency: CurrencyCode;
  /** 外币→CNY 汇率，仅非本位币时使用，例如 0.21 表示 1 单位 = 0.21 CNY */
  exchangeRate?: number;
  /** 折算后人民币金额，统一用于所有统计 */
  amountCNY: number;
  note?: string;
  createdAt: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  alipay: "支付宝",
  wechat: "微信",
};

export const TX_TYPE_LABELS: Record<TxType, string> = {
  income: "收入",
  expense: "支出",
};

export const BASE_CURRENCY: CurrencyCode = "CNY";

/** 固定的"待分配总仓"虚拟店铺，用于记录原始采购/总仓支出，可分摊到具体店铺 */
export const WAREHOUSE_SHOP_ID = "__warehouse__";
export const WAREHOUSE_SHOP: Shop = {
  id: WAREHOUSE_SHOP_ID,
  name: "待分配总仓",
  color: "#64748B",
  createdAt: "",
};

export interface Advance {
  id: string;
  date: string; // ISO yyyy-mm-dd
  project: string;
  amount: number;
  repaidAmount: number;
  settled: boolean;
  note?: string;
  createdAt: string;
}

/**
 * 业务核算 - 发货批次。独立于现金流交易记录（transactions），仅用于利润预估。
 */
export interface Shipment {
  id: string;
  shopId: string;
  date: string;            // yyyy-mm-dd
  quantity: number;        // 发货数量（件）
  unitCost: number;        // 单只发货成本（CNY）
  /** 每单回款，CNY 折算后金额（未乘利润率） */
  unitRevenue: number;
  /** 回款原币种代码 */
  unitRevenueCurrency: CurrencyCode;
  /** 非本位币时使用的汇率（1 单位原币 = ? CNY） */
  unitRevenueRate?: number;
  /** 回款原币金额（仅展示） */
  unitRevenueOriginal: number;
  /** 利润率系数（如 0.2 表示 20%）。预估回款 = 数量 × 每单回款 × 利润率 */
  profitRate: number;
  note?: string;
  createdAt: string;
}
