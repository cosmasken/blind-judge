import { DENOMINATION } from "@/utils/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind クラスを条件付きで結合するユーティリティ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 長いシールドアドレスを「先頭8文字…中間6文字…末尾8文字」に短縮して表示する。
 * 32 文字未満の場合はそのまま返す。
 */
export const truncateAddress = (address: string): string => {
  if (address.length < 32) return address;
  return `${address.substring(0, 8)}...${address.substring(22, 28)}...${address.substring(address.length - 8)}`;
};

/** クリップボードにテキストをコピーする */
export const copyToClipboard = (text: string): Promise<void> =>
  navigator.clipboard.writeText(text);

/**
 * BigInt の残高値を tDUST 単位の小数文字列にフォーマットする。
 * 例: 1_500_000_000n → "1.5"、3_000_000_000n → "3"
 */
function formatBigIntBalance(n: bigint): string {
  const whole = n / DENOMINATION;
  const frac = n % DENOMINATION;
  if (frac === 0n) return whole.toLocaleString();
  // 小数部を 9 桁ゼロ埋めし、末尾のゼロを取り除く
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

/**
 * Lace v4 残高 API のレスポンスを tDUST 文字列にフォーマットする。
 * Lace のバージョンや残高種別によって返却形式が異なるため、
 * BigInt / number / string / UTXO マップ / {balance, cap} オブジェクト を統一的に処理する。
 */
export const formatBalance = (raw: unknown): string => {
  if (raw === null || raw === undefined) return "--";
  if (typeof raw === "bigint") return formatBigIntBalance(raw);
  if (typeof raw === "number") {
    const n = BigInt(Math.round(raw));
    return formatBigIntBalance(n);
  }
  if (typeof raw === "string") {
    try {
      return formatBigIntBalance(BigInt(raw));
    } catch {
      return raw || "--";
    }
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Known key patterns (dust: {balance, cap}, others)
    const known =
      obj.amount ?? obj.value ?? obj.balance ?? obj.total ?? obj.dust;
    if (known !== undefined) return formatBalance(known);
    // UTXO マップ形式 { [tokenId]: BigInt } の場合は全 BigInt 値を合計する
    const bigintValues = Object.values(obj).filter(
      (v): v is bigint => typeof v === "bigint",
    );
    if (bigintValues.length > 0) {
      const total = bigintValues.reduce((sum, v) => sum + v, 0n);
      return formatBigIntBalance(total);
    }
    try {
      return JSON.stringify(obj, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
    } catch {
      return String(raw);
    }
  }
  return String(raw);
};
