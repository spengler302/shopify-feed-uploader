const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_API = `https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`;

export default async (req, res) => {
  try {
    const query = `
      {
        files(first: 1, query: "filename:feed") {
          edges {
            node {
              ... on GenericFile {
                url
              }
            }
          }
        }
      }
    `;

    const response = await fetch(SHOPIFY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();
    const url = json.data.files.edges[0]?.node?.url;

    if (!url) {
      res.status(404).json({ error: "feed.json not found in Shopify Files" });
      return;
    }

    const feedRes = await fetch(url);
    if (!feedRes.ok) {
      throw new Error("Failed to fetch feed.json from Shopify CDN");
    }

    const feedJson = await feedRes.json();

    // ✅ Extract CDN base dynamically
    const cdnBase = url.replace(/feed.*$/, "");

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ ...feedJson, cdnBase });
  } catch (err) {
    console.error("❌ Error fetching feed.json:", err);
    res.status(500).json({ error: err.message });
  }
};