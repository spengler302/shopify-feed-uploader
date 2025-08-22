import formidable from "formidable";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const config = { api: { bodyParser: false } };

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const THEME_ID = process.env.SHOPIFY_THEME_ID; // 👈 set this in Vercel env vars

// ✅ Cookie parser
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach(function (cookie) {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// ✅ Upload asset to theme
async function uploadThemeAsset(filename, filePath) {
  const content = fs.readFileSync(filePath).toString("base64");

  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2025-01/themes/${THEME_ID}/assets.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      },
      body: JSON.stringify({
        asset: {
          key: `assets/${filename}`,
          attachment: content
        }
      })
    }
  );

  let text = await res.text(); // get raw response
  try {
    const json = JSON.parse(text);
    if (json.errors) {
      console.error("❌ Theme asset upload error:", json.errors);
      throw new Error("Theme asset upload error: " + JSON.stringify(json.errors));
    }
    return json.asset;
  } catch (err) {
    console.error("❌ Non-JSON response from Shopify:", text);
    throw new Error("Unexpected response from Shopify. Check API scopes and theme_id.");
  }
}

// ✅ Fetch existing feed.json
async function fetchExistingFeed() {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2025-01/themes/${THEME_ID}/assets.json?asset[key]=assets/feed.json`,
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      }
    }
  );

  if (res.status === 404) return { images: [] };

  const json = await res.json();
  if (json.asset && json.asset.value) {
    try {
      return JSON.parse(json.asset.value);
    } catch {
      return { images: [] };
    }
  }
  return { images: [] };
}

// ✅ Main handler
export default async (req, res) => {
  const cookies = parseCookies(req);
  if (!cookies.session) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const form = formidable({ multiples: true, uploadDir: "/tmp", keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }

    try {
      if (!files.images) throw new Error("No images uploaded");

      // Load existing feed.json
      let existingFeed = await fetchExistingFeed();
      if (!existingFeed) existingFeed = { images: [] };

      // Find last index
      let lastIndex = 0;
      if (existingFeed.images.length > 0) {
        const lastFile = existingFeed.images[existingFeed.images.length - 1];
        const match = lastFile.match(/feed-(\d+)\.jpg/);
        if (match) lastIndex = parseInt(match[1], 10);
      }

      const fileArray = Array.isArray(files.images) ? files.images : [files.images];
      const newFeed = [...existingFeed.images];

      let counter = lastIndex;
      for (const file of fileArray) {
        counter++;
        const newName = `feed-${String(counter).padStart(3, "0")}.jpg`;
        if (newFeed.includes(newName)) continue;

        const newPath = path.join("/tmp", newName);
        await sharp(file.filepath).jpeg({ quality: 90 }).toFile(newPath);

        await uploadThemeAsset(newName, newPath);
        newFeed.push(newName);
      }

      // Deduplicate
      const uniqueFeed = [...new Set(newFeed)];

      // Save feed.json locally
      const feedJson = { images: uniqueFeed };
      const feedPath = path.join("/tmp", "feed.json");
      fs.writeFileSync(feedPath, JSON.stringify(feedJson, null, 2));

      // Upload feed.json
      await uploadThemeAsset("feed.json", feedPath);

      res.json({ success: true, images: uniqueFeed });
    } catch (e) {
      console.error("❌ Upload error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
};