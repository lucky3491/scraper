import { appendFile, readFile } from "fs/promises";
export type Source = "Amazon" | "Walmart";

export interface Sku {
  Type: Source;
  SKU: string;
}

export interface Product {
  sku: string;
  source: Source;
  title: string;
  description: string;
  price: string;
  reviewsAndRating: string;
}

export async function readSkus(file: string): Promise<Sku[]> {
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw) || { skus: [] };

  for (const item of data.skus) {
    if (!item?.SKU || (item.Type !== "Amazon" && item.Type !== "Walmart")) {
      throw new Error(`Bad SKU entry: ${JSON.stringify(item)}`);
    }
  }

  return data.skus as Sku[];
}

export async function pool<a, b>(
  items: a[],
  limit: number,
  worker: (item: a, idx: number) => Promise<b>
): Promise<b[]> {
  const results: b[] = new Array(items.length);
  let next = 0;

  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  };

  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, run));
  return results;
}

export async function retry<T>(
  task: () => Promise<T>,
  retries: number,
  label: string
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= retries + 1; i++) {
    try {
      return await task();
    } catch (err) {
      lastErr = err;
      if (i <= retries) {
        await logError(`${label} attempt ${i} failed: ${msg(err)} — retrying`);
      }
    }
  }
  throw new Error(`${label} failed after ${retries + 1} attempts: ${msg(lastErr)}`);
}

export function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function logError(message: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile("errors.log", line, "utf8");
}
