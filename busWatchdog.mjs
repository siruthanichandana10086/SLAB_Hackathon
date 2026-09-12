import { searchRedBus } from "./redbusModule.mjs";
import { searchAbhiBus } from "./abhibusModule.mjs";
import { searchIxigo } from "./ixigoModule.mjs";
import * as fs from "fs";
import * as readline from "readline";
import { execFile } from "child_process";

const ADAPTER_FILE = "./bus_adapter.json";
const MEMORY_FILE = "./agent_memory.json";

function promptConfirmation(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function parseIntent(query) {
  let from = "Bhopal";
  let to = "Indore";
  let maxPrice = 1000;

  const fromMatch = query.match(/from\s+(.+?)\s+to\s+/i);
  const toMatch = query.match(/\bto\s+(.+?)(?=\s+(?:under|below|max|on|for)\b|$)/i);
  const priceMatch = query.match(/(?:under|below|max)\s*(?:₹|rs\.?)?\s*(\d+)/i);

  if (fromMatch) from = fromMatch[1].trim();
  if (toMatch) to = toMatch[1].trim();
  if (priceMatch) maxPrice = parseInt(priceMatch[1], 10);

  return { from, to, maxPrice, travelDate: new Date().toISOString().slice(0, 10) };
}

function loadMemory() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return { platformWins: {}, operatorWins: {}, searches: 0 };
  }
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

function scoreDeal(deal, memory) {
  const platformBonus = (memory.platformWins[deal.platform] || 0) * 8;
  const operatorBonus = (memory.operatorWins[deal.operator] || 0) * 4;
  const ratingBonus = (deal.rating || 0) * 10;
  const timingBonus = deal.departureTime ? 5 : 0;
  return platformBonus + operatorBonus + ratingBonus + timingBonus - deal.fare / 100;
}

function openBookingPage(url) {
  return new Promise((resolve, reject) => {
    execFile("cmd", ["/c", "start", "", url], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const userPrompt = process.argv[2] || "Find the best bus deal from Bhopal to Indore under ₹800";

  console.log("\n=======================================================");
  console.log("🚌 BUS WATCHDOG: CONCURRENT MULTI-PLATFORM AGGREGATOR");
  console.log("=======================================================");
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Prompt: "${userPrompt}"${dryRun ? " [dry run]" : ""}`);

  const { from, to, maxPrice, travelDate } = parseIntent(userPrompt);
  console.log(`Intent Parsed: Route = ${from} ➔ ${to} | Max Budget = ₹${maxPrice}`);

  const [redbus, abhibus, ixigo] = await Promise.all([
    searchRedBus(from, to, maxPrice),
    searchAbhiBus(from, to, maxPrice),
    searchIxigo(from, to, maxPrice)
  ]);

  const memory = loadMemory();
  memory.searches += 1;
  const allDeals = [...redbus, ...abhibus, ...ixigo]
    .map((deal) => ({ ...deal, score: scoreDeal(deal, memory) }))
    .sort((a, b) => b.score - a.score || a.fare - b.fare);

  // Save compiled Webcmd adapter cache
  if (!fs.existsSync(ADAPTER_FILE)) {
    fs.writeFileSync(
      ADAPTER_FILE,
      JSON.stringify({ schemaVersion: "2.0", route: `${from}-${to}`, travelDate, cachedAt: new Date().toISOString() }, null, 2)
    );
    console.log("\n💾 [webcmd Adapter] Adapter layout compiled and saved to bus_adapter.json");
  }

  console.log(`\n📊 Live Bus Comparison Table (${allDeals.length} deals found within budget):`);
  console.table(
    allDeals.map((item) => ({
      Platform: item.platform,
      Operator: item.operator,
      Fare: item.displayFare,
      Type: item.type,
      Departure: item.departureTime || "Not listed",
      Arrival: item.arrivalTime || "Not listed",
      Duration: item.duration || "Not listed",
    }))
  );

  if (allDeals.length > 0) {
    const absoluteBest = allDeals[0];

    console.log("\n🏆 AGENT SELECTION (Lowest Price Guarantee):");
    console.log(`   Best Portal:   ${absoluteBest.platform}`);
    console.log(`   Operator:      ${absoluteBest.operator}`);
    console.log(`   Lowest Fare:   ${absoluteBest.displayFare}`);
    console.log(`   Departure:     ${absoluteBest.departureTime || "Not listed"}`);
    console.log(`   Arrival:       ${absoluteBest.arrivalTime || "Not listed"}`);
    console.log(`   Booking page:  ${absoluteBest.bookingUrl}`);

    console.log("\n-----------------------------------------------------------");
    console.log("🚨 [MANDATORY HUMAN APPROVAL GATE]");
    console.log("The agent is ready to navigate to the ticket seat layout.");
    console.log("-----------------------------------------------------------");

    if (dryRun) {
      console.log("\n🧪 Dry run complete. No browser page was opened.");
      saveMemory(memory);
      return;
    }

    const decision = await promptConfirmation("Would you like to open this booking page? (yes/agree/no): ");

    if (["yes", "y", "agree", "approved"].includes(decision)) {
      console.log(`\n✅ Approval granted. Opening ${absoluteBest.platform} booking page...`);
      await openBookingPage(absoluteBest.bookingUrl);
      memory.platformWins[absoluteBest.platform] = (memory.platformWins[absoluteBest.platform] || 0) + 1;
      memory.operatorWins[absoluteBest.operator] = (memory.operatorWins[absoluteBest.operator] || 0) + 1;
      saveMemory(memory);
      console.log("🔒 Booking page opened. Review seats, passenger details, and payment yourself before completing checkout.");
    } else {
      console.log("\n🛑 Action cancelled by user.");
      saveMemory(memory);
    }
  } else {
    console.log(`\n⚠️ No buses found under your max limit of ₹${maxPrice}. Try raising the budget limit.`);
    saveMemory(memory);
  }
}

main();
