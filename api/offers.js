// api/offers.js  (Vercel Serverless Function)

const GOOGLE_SCRIPT_URL =
  "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLiVIflG7HwePo-M5WJJZtA8HPJZqwacjkFW5wqNDLKQEIbyA8R1Kyt_-yH-2VWbwSq_PbRB-IWlAaS4UmfXVK9cK-v6CmQwzv9OuzohyA7M8ryn0CcRKX1t7zy5DFeSZrx_cbUM8uMtG5cXnSOMjEhOoQ2KJTdEGozuuMFxUsILP2ORlhwFd2-3Jww35ZbhLCIsDVu9esdZ_SPNtx1oHYwWE-QAJBF41kU_oPwTATSpg2fGDaf6s1ZWVHLbXY1NTUJOqCzOl4MNjaCR8H2mA3Ev2ChF_SnNxvOOb7UBTGQ5nYizS8hcIccxAao3LypS9vTIyJmkNlsqTkbB8gIppzMYBrUQCQ&lib=MeW_fNOm1qyLW_4Nw1hlXc2cgK1xcK5au";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { appId, action = "listOffers", today } = req.query;

    // نبني الرابط مع نفس البراميترز التي يستعملها الـ frontend
    const url = new URL(GOOGLE_SCRIPT_URL);
    if (appId) url.searchParams.set("appId", appId);
    if (action) url.searchParams.set("action", action);
    if (today)  url.searchParams.set("today", today);

    console.log("🛰️ [api/offers] Calling Google Script:", url.toString());

    const response = await fetch(url.toString(), { method: "GET" });
    const data = await response.json().catch(() => ({}));

    console.log("🎁 [api/offers] Google Script response:", data);

    if (!response.ok || data.ok === false) {
      return res.status(500).json({
        ok: false,
        error: data.error || "Remote script error",
        details: data.details || null,
      });
    }

    // نرجّع نفس الـ JSON إلى الـ frontend
    return res.status(200).json({
      ok: true,
      appId: data.appId || appId || null,
      today: data.today || today || null,
      count: Array.isArray(data.items) ? data.items.length : 0,
      items: data.items || [],
    });
  } catch (err) {
    console.error("💥 [api/offers] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Unexpected error in /api/offers",
      details: String(err),
    });
  }
};
