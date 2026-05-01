import { chromium, Browser, Page } from "playwright";
import { createObjectCsvWriter } from "csv-writer";
import {
  Product,
  Sku,
  logError,
  msg,
  pool,
  readSkus,
  retry,
} from "./utils";

const SKU_FILE = "skus.json";
const OUT_FILE = "product_data.csv";

const CONCURRENCY = 2;
const RETRIES = 2;
const SELECTOR_TIMEOUT = 15_000;

function urlFor(item: Sku): string {
  return item.Type === "Amazon" ? 
    `https://www.amazon.com/dp/${item.SKU}` :
    `https://www.walmart.com/ip/${item.SKU}`;
}

async function pickText(page: Page, selectors: string[]): Promise<string> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      const text = await loc.textContent({ timeout: 2000 });
      if (text) return text;
    } catch {
      // error
    }
  }
  return "";
}

async function pickAttr(page: Page, selector: string, attr: string): Promise<string> {
  try {
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) return "";
    const attrValue = await loc.getAttribute(attr, { timeout: 2000 });
    return attrValue || "";
  } catch {
    return "";
  }
}

async function isBlocked(page: Page, source: string): Promise<string | null> {
  const title = (await page.title()).toLowerCase();

  if (source === "Amazon") {
    if (await page.locator("form[action*='/errors/validateCaptcha']").count()) {
      return "Amazon CAPTCHA page";
    }
    if (title.includes("robot check") || title.includes("sorry")) {
      return `Amazon block page (title: ${title})`;
    }
  } else {
    if (await page.locator("#px-captcha, [data-testid='captcha-challenge']").count()) {
      return "Walmart CAPTCHA page";
    }
    if (title.includes("robot check") || title.includes("sorry")) {
      return `Walmart block page (title: ${title})`;
    }
  }

  return null;
}

async function scrapeAmazon(page: Page): Promise<Omit<Product, "sku" | "source">> {
  await page
    .waitForSelector("#productTitle, #title", { timeout: SELECTOR_TIMEOUT })
    .catch(() => {});

  const title = await pickText(page, ["#productTitle", "#title span"]);

  const description = await pickText(page, [
    "#feature-bullets ul",
    "#feature-bullets",
    "#productDescription",
    "#bookDescription_feature_div",
  ]);

  const price = await pickText(page, [
    "#corePrice_feature_div .a-price .a-offscreen",
    "#apex_desktop .a-price .a-offscreen",
    ".a-price .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
  ]);

  const ratingTitle = await pickAttr(page, "#acrPopover", "title"); // e.g. "4.8 out of 5 stars"
  const reviewsCount = await pickText(page, [
    "#acrCustomerReviewText",
    "[data-hook='total-review-count']",
  ]);
  const reviewsAndRating = [ratingTitle, reviewsCount].filter(Boolean).join(" | ");

  return {
    title: title || "Not found",
    description: description || "Not found",
    price: price || "Not found",
    reviewsAndRating: reviewsAndRating || "Not found",
  };
}

async function scrapeWalmart(page: Page): Promise<Omit<Product, "sku" | "source">> {
  await page
    .waitForSelector(
      "h1[itemprop='name'], h1[data-automation-id='product-title'], main#maincontent",
      { timeout: SELECTOR_TIMEOUT }
    )
    .catch(() => {});

  const title = await pickText(page, [
    "h1[itemprop='name']",
    "h1#main-title",
    "h1",
  ]);

  const description = await pickText(page, [
    "[data-testid='product-description-content']",
    "[data-testid='product-description']",
    "#product-description-section",
    "div[data-testid='product-highlights'] ul",
  ]);

  const price = await pickText(page, [
    "[itemprop='price']",
    "[data-automation-id='product-price']",
    "span[data-testid='price-wrap'] span",
    "div[data-seo-id='hero-price-container']",
  ]);

  const rating = await pickText(page, [
    "[data-testid='reviews-and-ratings'] [aria-label*='out of 5']",
    "span[itemprop='ratingValue']",
  ]);

  const reviews = await pickText(page, [
    "[data-testid='reviews-and-ratings'] a[link-identifier='seeAllReviews']",
    "a[itemprop='reviewCount']",
    "[itemprop='reviewCount']",
  ]);

  const reviewsAndRating = [rating, reviews].filter(Boolean).join(" | ");

  return {
    title: title || "Not found",
    description: description || "Not found",
    price: price || "Not found",
    reviewsAndRating: reviewsAndRating || "Not found",
  };
}

async function scrapeOne(browser: Browser, item: Sku): Promise<Product> {
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 850 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const page = await ctx.newPage();

  try {
    const url = urlFor(item);
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    if (!res || !res.ok()) {
      throw new Error(`HTTP ${res?.status() ?? "?"} for ${url}`);
    }

    const blocked = await isBlocked(page, item.Type);
    if (blocked) throw new Error(blocked);

    const data =
      item.Type === "Amazon" ? await scrapeAmazon(page) : await scrapeWalmart(page);

    return { sku: item.SKU, source: item.Type, ...data };
  } finally {
    await ctx.close().catch(() => {});
  }
}

function emptyRow(item: Sku): Product {
  return {
    sku: item.SKU,
    source: item.Type,
    title: "Not found",
    description: "Not found",
    price: "Not found",
    reviewsAndRating: "Not found",
  };
}

async function writeCsv(rows: Product[]): Promise<void> {
  const writer = createObjectCsvWriter({
    path: OUT_FILE,
    header: [
      { id: "sku", title: "SKU" },
      { id: "source", title: "Source (Amazon/Walmart)" },
      { id: "title", title: "Title" },
      { id: "description", title: "Description" },
      { id: "price", title: "Price" },
      { id: "reviewsAndRating", title: "Number of Reviews and rating" },
    ],
  });
  await writer.writeRecords(rows);
}

async function main() {
  const items = await readSkus(SKU_FILE);
  console.log(`Scraping ${items.length} SKU`);
  console.log('SKUs:', items);

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const rows = await pool(items, CONCURRENCY, async (item, i) => {
      const tag = `[${i + 1}/${items.length}] ${item.Type} ${item.SKU}`;
      try {
        const row = await retry(() => scrapeOne(browser, item), RETRIES, tag);
        console.log(`${tag} ok`);
        return row;
      } catch (err) {
        await logError(`${tag} failed: ${msg(err)}`);
        console.warn(`${tag} failed (${msg(err)})`);
        return emptyRow(item);
      }
    });

    await writeCsv(rows);
    console.log(`Done. Wrote ${rows.length} row(s) to ${OUT_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch(async (err) => {
  await logError(`Fatal: ${msg(err)}`);
  process.exit(1);
});
