import formidable from "formidable";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const config = { api: { bodyParser: false } };

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_API = `https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`;

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

// ✅ Step 1: Ask Shopify for staged upload URL
async function getStagedUpload(filename, mimeType) {
  const query = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    input: [
      {
        filename,
        mimeType,
        resource: "FILE",
        httpMethod: "POST"
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
  if (json.data.stagedUploadsCreate.userErrors.length) {
    throw new Error(
      "Shopify staged upload error: " +
        JSON.stringify(json.data.stagedUploadsCreate.userErrors)
    );
  }

  return json.data.stagedUploadsCreate.stagedTargets[0];
}

// ✅ Step 2: Upload file to Shopify’s S3
async function uploadToS3(stagedTarget, filePath) {
  const formData = new FormData();
  stagedTarget.parameters.forEach((p) => formData.append(p.name, p.value));
  formData.append("file", new Blob([fs.readFileSync(filePath)]));

  const res = await fetch(stagedTarget.url, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error("S3 upload failed: " + (await res.text()));
  }

  return stagedTarget.resourceUrl;
}

// ✅ Step 3: Register file in Shopify
async function createShopifyFile(resourceUrl, alt) {
  const query = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id preview { image { url } } }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    files: [
      {
        alt,
        contentType: "IMAGE",
        originalSource: resourceUrl
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
  if (json.data.fileCreate.userErrors.length) {
    throw new Error(
      "Shopify fileCreate error: " +
        JSON.stringify(json.data.fileCreate.userErrors)
    );
  }

  return json.data.fileCreate.files[0];
}

// ✅ Main handler
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
      console.error("❌ Formidable error:", err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }

    try {
      if (!files.images) {
        throw new Error("No images uploaded");
      }

      const fileArray = Array.isArray(files.images) ? files.images : [files.images];
      const newFeed = [];

      let counter = 0;
      for (const file of fileArray) {
        counter++;
        const newName = `feed-${String(counter).padStart(3, "0")}.jpg`;
        const newPath = path.join("/tmp", newName);

        // Convert to JPEG
        await sharp(file.filepath).jpeg({ quality: 90 }).toFile(newPath);

        // Shopify staged upload
        const stagedTarget = await getStagedUpload(newName, "image/jpeg");
        const resourceUrl = await uploadToS3(stagedTarget, newPath);
        const shopifyFile = await createShopifyFile(resourceUrl, newName);

        console.log("✅ Uploaded to Shopify:", shopifyFile.preview.image.url);
        newFeed.push(newName);
      }

      // Save feed.json locally
      const feedJson = { images: newFeed };
      const feedPath = path.join("/tmp", "feed.json");
      fs.writeFileSync(feedPath, JSON.stringify(feedJson, null, 2));

      // Upload feed.json to Shopify
      const stagedTarget = await getStagedUpload("feed.json", "application/json");
      const resourceUrl = await uploadToS3(stagedTarget, feedPath);
      await createShopifyFile(resourceUrl, "feed.json");

      res.json({ success: true, images: newFeed });
    } catch (e) {
      console.error("❌ Upload error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
};