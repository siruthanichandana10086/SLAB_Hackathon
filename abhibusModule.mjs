import { chromium } from "playwright";

export async function searchAbhiBus(from, to, maxPrice) {
  console.log(`\n🟡 [AbhiBus Engine] Searching routes for: ${from} ➔ ${to}`);
  let browser;

  try {
    browser = await chromium.launch({ headless: process.env.BUS_WATCHDOG_HEADLESS !== "false", slowMo: 50 });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    const routeUrl = `https://www.abhibus.com/bus-ticket-booking/${from.toLowerCase().replace(/\s+/g, "-")}-to-${to.toLowerCase().replace(/\s+/g, "-")}`;
    await page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    const listings = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div")).filter(el => {
        const text = el.innerText || "";
        return text.includes("₹") && text.length < 400;
      });

      const results = [];
      const seen = new Set();

      for (const card of cards) {
        const txt = card.innerText || "";
        const fareMatch = txt.match(/₹\s*([0-9,]+)/);
        if (!fareMatch) continue;

        const fare = parseInt(fareMatch[1].replace(/,/g, ""), 10);
        const lines = txt.split("\n").map(l => l.trim()).filter(Boolean);
        const operator = lines[0] || "AbhiBus Operator";

        if (!seen.has(operator) && operator.length < 35) {
          seen.add(operator);
          results.push({
            platform: "AbhiBus 🟡",
            operator,
            fare,
            displayFare: `₹${fare}`,
            type: "Seater / Sleeper",
            departureTime: lines.find((line) => /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(line)) || "",
            arrivalTime: "",
            duration: "",
            rating: Number((txt.match(/([0-5]\.\d)\s*★/) || [])[1] || 0),
            bookingUrl: routeUrl
          });
        }
        if (results.length >= 3) break;
      }
      return results;
    });

    await browser.close();
    return listings.filter(item => item.fare <= maxPrice);
  } catch (err) {
    console.warn(`⚠️ AbhiBus extraction note: ${err.message}`);
    if (browser) await browser.close();
    return [];
  }
}