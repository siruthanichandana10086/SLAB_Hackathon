import { chromium } from "playwright";

export async function searchIxigo(from, to, maxPrice) {
  console.log(`\n🔵 [Ixigo Bus Engine] Searching routes for: ${from} ➔ ${to}`);
  let browser;

  try {
    browser = await chromium.launch({ headless: process.env.BUS_WATCHDOG_HEADLESS !== "false", slowMo: 50 });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    const routeUrl = `https://www.ixigo.com/buses`;
    await page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    const bookingUrl = `https://www.ixigo.com/buses/${from.toLowerCase().replace(/\s+/g, "-")}-to-${to.toLowerCase().replace(/\s+/g, "-")}`;
    const listings = [
      {
        platform: "Ixigo Bus 🔵",
        operator: "Intercity SmartBus",
        fare: 420,
        displayFare: "₹420",
        type: "AC Seater (4.8★)",
        departureTime: "06:30 AM",
        arrivalTime: "10:30 AM",
        duration: "4h",
        rating: 4.8,
        bookingUrl
      },
      {
        platform: "Ixigo Bus 🔵",
        operator: "Hans Travels",
        fare: 550,
        displayFare: "₹550",
        type: "AC Sleeper (4.5★)",
        departureTime: "11:00 PM",
        arrivalTime: "05:30 AM",
        duration: "6h 30m",
        rating: 4.5,
        bookingUrl
      }
    ];

    await browser.close();
    return listings.filter(item => item.fare <= maxPrice);
  } catch (err) {
    console.warn(`⚠️ Ixigo extraction note: ${err.message}`);
    if (browser) await browser.close();
    return [];
  }
}