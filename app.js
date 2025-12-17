const STORAGE_KEY = "local-user-activity-v1";

const PRODUCTS = [
  { id: "aurora-lamp", name: "Aurora Lamp", page: "/products/aurora-lamp" },
  { id: "summit-backpack", name: "Summit Backpack", page: "/products/summit-backpack" },
  { id: "nimbus-headphones", name: "Nimbus Headphones", page: "/products/nimbus-headphones" },
];

const DEMO_USERS = [
  { id: "u-mia", name: "Mia" },
  { id: "u-leo", name: "Leo" },
  { id: "u-zoe", name: "Zoe" },
];

const formatTime = (ts) => new Date(ts).toLocaleString();
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function seedDemoEvents() {
  const now = Date.now();
  const events = [
    // Session 1 - Mia explores and converts
    { id: newId(), userId: "u-mia", userName: "Mia", sessionId: "s-100", type: "page_view", page: "/", ts: now - 1000 * 60 * 45 },
    { id: newId(), userId: "u-mia", userName: "Mia", sessionId: "s-100", type: "product_view", productId: "aurora-lamp", productName: "Aurora Lamp", page: "/products/aurora-lamp", ts: now - 1000 * 60 * 43 },
    { id: newId(), userId: "u-mia", userName: "Mia", sessionId: "s-100", type: "add_to_cart", productId: "aurora-lamp", productName: "Aurora Lamp", page: "/products/aurora-lamp", ts: now - 1000 * 60 * 42 },

    // Session 2 - Leo browses and bounces
    { id: newId(), userId: "u-leo", userName: "Leo", sessionId: "s-101", type: "page_view", page: "/", ts: now - 1000 * 60 * 30 },
    { id: newId(), userId: "u-leo", userName: "Leo", sessionId: "s-101", type: "product_view", productId: "summit-backpack", productName: "Summit Backpack", page: "/products/summit-backpack", ts: now - 1000 * 60 * 28 },

    // Session 3 - Zoe compares and adds to cart
    { id: newId(), userId: "u-zoe", userName: "Zoe", sessionId: "s-102", type: "page_view", page: "/", ts: now - 1000 * 60 * 18 },
    { id: newId(), userId: "u-zoe", userName: "Zoe", sessionId: "s-102", type: "product_view", productId: "nimbus-headphones", productName: "Nimbus Headphones", page: "/products/nimbus-headphones", ts: now - 1000 * 60 * 17 },
    { id: newId(), userId: "u-zoe", userName: "Zoe", sessionId: "s-102", type: "product_view", productId: "summit-backpack", productName: "Summit Backpack", page: "/products/summit-backpack", ts: now - 1000 * 60 * 16 },
    { id: newId(), userId: "u-zoe", userName: "Zoe", sessionId: "s-102", type: "add_to_cart", productId: "nimbus-headphones", productName: "Nimbus Headphones", page: "/products/nimbus-headphones", ts: now - 1000 * 60 * 15 },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  return events;
}

function loadEvents() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return seedDemoEvents();
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not parse stored events, reseeding.", e);
    return seedDemoEvents();
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function recordEvent(partial) {
  const events = loadEvents();
  const event = { id: newId(), ts: Date.now(), ...partial };
  events.push(event);
  saveEvents(events);
  render(events);
}

function simulateVisit() {
  const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
  const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const sessionId = `s-${Math.floor(Math.random() * 9000) + 1000}`;
  const now = Date.now();
  const newEvents = [
    { type: "page_view", page: "/", ts: now },
    { type: "product_view", productId: product.id, productName: product.name, page: product.page, ts: now + 1000 * 30 },
  ];
  // 60% chance to add to cart
  if (Math.random() < 0.6) {
    newEvents.push({ type: "add_to_cart", productId: product.id, productName: product.name, page: product.page, ts: now + 1000 * 45 });
  }

  newEvents.forEach((evt) =>
    recordEvent({
      ...evt,
      userId: user.id,
      userName: user.name,
      sessionId,
    })
  );
}

function aggregate(events) {
  const sessions = new Map();
  const users = new Set();
  const pageCounts = new Map();
  const productViews = new Map();
  const productAdds = new Map();

  events.forEach((evt) => {
    users.add(evt.userId);
    if (!sessions.has(evt.sessionId)) sessions.set(evt.sessionId, []);
    sessions.get(evt.sessionId).push(evt);

    if (evt.page) {
      pageCounts.set(evt.page, (pageCounts.get(evt.page) || 0) + 1);
    }
    if (evt.productId && evt.type === "product_view") {
      productViews.set(evt.productId, (productViews.get(evt.productId) || 0) + 1);
    }
    if (evt.productId && evt.type === "add_to_cart") {
      productAdds.set(evt.productId, (productAdds.get(evt.productId) || 0) + 1);
    }
  });

  const sessionSummaries = Array.from(sessions.entries()).map(([sessionId, evts]) => {
    const byTs = evts.slice().sort((a, b) => a.ts - b.ts);
    const productsTouched = Array.from(new Set(evts.filter((e) => e.productName).map((e) => e.productName)));
    const conversion = evts.some((e) => e.type === "add_to_cart");
    const userName = evts[0]?.userName || "Unknown";
    const userId = evts[0]?.userId || "unknown";
    const lastActive = byTs[byTs.length - 1]?.ts || Date.now();
    return { sessionId, userName, userId, count: evts.length, productsTouched, conversion, lastActive };
  });

  const topProductId = Array.from(productViews.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topProduct = PRODUCTS.find((p) => p.id === topProductId);

  const conversionSessions = sessionSummaries.filter((s) => s.conversion).length;

  return {
    totalEvents: events.length,
    totalSessions: sessions.size,
    uniqueUsers: users.size,
    pageCounts,
    productViews,
    productAdds,
    topProduct,
    conversionRate: sessions.size ? Math.round((conversionSessions / sessions.size) * 100) : 0,
    avgEventsPerSession: sessions.size ? (events.length / sessions.size).toFixed(1) : "0",
    sessionSummaries,
  };
}

function buildInsights(stats) {
  const insights = [];
  if (stats.topProduct) {
    const viewCount = stats.productViews.get(stats.topProduct.id) || 0;
    const addCount = stats.productAdds.get(stats.topProduct.id) || 0;
    insights.push({
      title: `${stats.topProduct.name} leads engagement`,
      detail: `${viewCount} product views with ${addCount} add-to-carts.`,
      sentiment: "positive",
    });
  }

  const singleTouchSessions = stats.sessionSummaries.filter((s) => s.count === 1).length;
  if (singleTouchSessions > 0) {
    insights.push({
      title: "Short visits detected",
      detail: `${singleTouchSessions} session(s) had only one event. Consider adding an above-the-fold CTA.`,
      sentiment: "warn",
    });
  }

  const avg = Number(stats.avgEventsPerSession);
  insights.push({
    title: "Engagement depth",
    detail: `Avg ${avg} events per session. Target 4+ for stronger intent.`,
    sentiment: avg >= 4 ? "positive" : "neutral",
  });

  return insights;
}

function renderCards(stats) {
  const cards = [
    { label: "Sessions", value: stats.totalSessions },
    { label: "Unique users", value: stats.uniqueUsers },
    { label: "Total events", value: stats.totalEvents },
    { label: "Avg events / session", value: stats.avgEventsPerSession },
    { label: "Conversion rate", value: `${stats.conversionRate}%` },
  ];

  const container = document.getElementById("metric-cards");
  container.innerHTML = cards
    .map(
      (c) => `
        <div class="card">
          <div class="card-label">${c.label}</div>
          <div class="card-value">${c.value}</div>
        </div>
      `
    )
    .join("");

  document.getElementById("live-session-count").textContent = stats.totalSessions;
  document.getElementById("last-updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function renderInsights(insights) {
  const container = document.getElementById("insight-list");
  container.innerHTML = insights
    .map(
      (insight) => `
        <div class="insight">
          <div>
            <p>${insight.title}</p>
            <p class="tag">${insight.detail}</p>
          </div>
          <span class="pill ${insight.sentiment === "warn" ? "status-warning" : insight.sentiment === "positive" ? "status-success" : ""}">
            ${insight.sentiment === "warn" ? "Attention" : insight.sentiment === "positive" ? "Good" : "Info"}
          </span>
        </div>
      `
    )
    .join("");
}

function renderEvents(events) {
  const tbody = document.getElementById("event-rows");
  const sorted = events.slice().sort((a, b) => b.ts - a.ts).slice(0, 25);
  tbody.innerHTML = sorted
    .map(
      (e) => `
        <tr>
          <td>${e.userName || e.userId}</td>
          <td>${e.sessionId}</td>
          <td>${e.type}</td>
          <td>${e.productName || e.page || "—"}</td>
          <td>${formatTime(e.ts)}</td>
        </tr>
      `
    )
    .join("");
}

function renderSessions(sessionSummaries) {
  const tbody = document.getElementById("session-rows");
  const sorted = sessionSummaries.slice().sort((a, b) => b.lastActive - a.lastActive);
  tbody.innerHTML = sorted
    .map(
      (s) => `
        <tr>
          <td>${s.sessionId}</td>
          <td>${s.userName}</td>
          <td>${s.count}</td>
          <td>${s.productsTouched.join(", ") || "—"}</td>
          <td>${s.conversion ? '<span class="status-success">Yes</span>' : "No"}</td>
          <td>${formatTime(s.lastActive)}</td>
        </tr>
      `
    )
    .join("");
}

function render(events) {
  const stats = aggregate(events);
  renderCards(stats);
  renderInsights(buildInsights(stats));
  renderEvents(events);
  renderSessions(stats.sessionSummaries);
}

function main() {
  const events = loadEvents();
  render(events);

  document.getElementById("simulate-visit").addEventListener("click", simulateVisit);
  document.getElementById("reset-demo").addEventListener("click", () => render(seedDemoEvents()));
  document.getElementById("record-pageview").addEventListener("click", () =>
    recordEvent({
      type: "page_view",
      page: "/",
      userId: "you",
      userName: "You",
      sessionId: `s-you-${new Date().getHours()}`,
    })
  );
  document.getElementById("record-product").addEventListener("click", () => {
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    recordEvent({
      type: "product_view",
      productId: product.id,
      productName: product.name,
      page: product.page,
      userId: "you",
      userName: "You",
      sessionId: `s-you-${new Date().getHours()}`,
    });
  });
}

document.addEventListener("DOMContentLoaded", main);

