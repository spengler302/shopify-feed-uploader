import fs from "fs";
import path from "path";
import formidable from "formidable";
import sharp from "sharp";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false
  }
};

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const USERNAME = process.env.UPLOADER_USER;
const PASSWORD = process.env.UPLOADER_PASS;

const SHOPIFY_API = `https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`;

function padNumber(num, size = 3) {
  return String(num).padStart(size, "0");
}

async function uploadFileToShopify(filePath, filename) {
  const fileContent = fs.readFileSync(filePath, { encoding: "base64" });

  const query = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          preview {
            image {
              url
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    files: [
      {
        alt: filename,
        contentType: "IMAGE",
        originalSource: `data:image/jpeg;base64,${fileContent}`,
        filename: filename
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

  const json = await res.json();
  if (json.errors || json.data.fileCreate.userErrors.length > 0) {
    console.error("❌ Upload error:", json);
    throw new Error("Upload failed");
  } else {
    console.log(`✅ Uploaded ${filename}`);
  }
}

export default async (req, res) => {
  // 🔐 Basic Auth
  const auth = req.headers.authorization || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const [user, pass] = Buffer.from(encoded, "base64")
    .toString()
    .split(":");
  if (user !== USERNAME || pass !== PASSWORD) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  const form = formidable({ multiples: true, uploadDir: "/tmp", keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }

    try {
      let feed = { images: [] };

      // Download existing feed.json from Shopify
      // (optional: you can skip this if you always overwrite)
      // For simplicity, we’ll just rebuild it each time

      let counter = 0;
      const newFeed = [];

      const fileArray = Array.isArray(files.images)
        ? files.images
        : [files.images];

      for (const file of fileArray) {
        counter++;
        const newName = `feed-${padNumber(counter)}.jpg`;
        const newPath = path.join("/tmp", newName);

        // Convert to JPEG
        await sharp(file.filepath).jpeg({ quality: 90 }).toFile(newPath);

        await uploadFileToShopify(newPath, newName);
        newFeed.push(newName);
      }

      // Save feed.json locally
      const feedJson = { images: newFeed };
      const feedPath = path.join("/tmp", "feed.json");
      fs.writeFileSync(feedPath, JSON.stringify(feedJson, null, 2));

      // Upload feed.json
      await uploadFileToShopify(feedPath, "feed.json");

      res.json({ success: true, images: newFeed });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
};