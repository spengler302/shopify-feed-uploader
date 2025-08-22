import formidable from "formidable";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import fetch from "node-fetch";

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

export const config = { api: { bodyParser: false } };

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_API = `https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`;

async function uploadFileToShopify(filePath, filename) {
  const fileContent = fs.readFileSync(filePath, { encoding: "base64" });

  const query = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { preview { image { url } } }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    files: [
      {
        alt: filename,
        contentType: "IMAGE",
        originalSource: `data:image/jpeg;base64,${fileContent}`,
        filename
      }
    ]
  };

  const res = await fetch(SHOPIFY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  return res.json();
}

export default async (req, res) => {
  const cookies = parseCookies(req);
  const user = cookies.session;

  if (!user) {
    res.statusCode = 401;
    res.json({ success: false, error: "Unauthorized" });
    return;
  }

  const form = formidable({ multiples: true, uploadDir: "/tmp", keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }

    try {
      const fileArray = Array.isArray(files.images) ? files.images : [files.images];
      const newFeed = [];

      let counter = 0;
      for (const file of fileArray) {
        counter++;
        const newName = `feed-${String(counter).padStart(3, "0")}.jpg`;
        const newPath = path.join("/tmp", newName);

        await sharp(file.filepath).jpeg({ quality: 90 }).toFile(newPath);
        await uploadFileToShopify(newPath, newName);
        newFeed.push(newName);
      }

      // Save feed.json
      const feedJson = { images: newFeed };
      const feedPath = path.join("/tmp", "feed.json");
      fs.writeFileSync(feedPath, JSON.stringify(feedJson, null, 2));
      await uploadFileToShopify(feedPath, "feed.json");

      res.json({ success: true, images: newFeed });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
};