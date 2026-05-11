import { getStore } from "@netlify/blobs";

// Hand-curated lists — every combination is school-safe
const ADJECTIVES = [
  "Brave", "Calm", "Bold", "Quick", "Wise", "Bright", "Swift", "Keen",
  "Proud", "Glad", "Warm", "Cool", "Kind", "Fair", "Sharp", "Steady",
  "Clear", "Strong", "Quiet", "Gentle", "Eager", "Jolly", "Lively", "Merry",
  "Noble", "Nimble", "Plucky", "Radiant", "Serene", "Sunny",
];

const ANIMALS = [
  "Panda", "Otter", "Falcon", "Wolf", "Penguin", "Dolphin", "Flamingo",
  "Jaguar", "Koala", "Lemur", "Lynx", "Marmot", "Osprey", "Parrot",
  "Quail", "Rabbit", "Robin", "Salmon", "Sparrow", "Toucan",
  "Turtle", "Viper", "Walrus", "Wombat", "Yak", "Zebra", "Bison",
  "Crane", "Eagle", "Finch",
];

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const { score, rhythm, date } = body;

  // Validate inputs
  if (typeof score !== "number" || score < 0 || score > 100) {
    return new Response("Invalid score", { status: 400 });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date", { status: 400 });
  }

  const key = date || todayStr();
  const name = randomName();

  try {
    const store = getStore("leaderboard");
    const existing = await store.get(key, { type: "json" }) || [];

    const entry = {
      name,
      score: Math.round(score),
      rhythm: typeof rhythm === "string" ? rhythm.slice(0, 60) : "Unknown",
    };

    const updated = [...existing, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    await store.set(key, JSON.stringify(updated));

    return Response.json({ name, entries: updated.slice(0, 10) });
  } catch (err) {
    return new Response("Storage error", { status: 500 });
  }
};

export const config = { path: "/api/submit" };

function randomName() {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num    = Math.floor(Math.random() * 90) + 10;
  return adj + animal + num;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
