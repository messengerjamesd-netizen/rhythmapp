import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayStr();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Bad date", { status: 400 });
  }

  try {
    const store = getStore("leaderboard");
    const entries = await store.get(date, { type: "json" }) || [];
    return Response.json(entries.slice(0, 10));
  } catch {
    return Response.json([]);
  }
};

export const config = { path: "/api/leaderboard" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
