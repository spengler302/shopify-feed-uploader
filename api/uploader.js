export default async (req, res) => {
  const USERNAME = process.env.UPLOADER_USER;
  const PASSWORD = process.env.UPLOADER_PASS;

  // Require Basic Auth
  const auth = req.headers.authorization || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.setHeader("WWW-Authenticate", "Basic realm='Uploader'");
    res.statusCode = 401;
    res.end("Authentication required");
    return;
  }

  const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
  if (user !== USERNAME || pass !== PASSWORD) {
    res.statusCode = 401;
    res.end("Invalid credentials");
    return;
  }

  // Serve uploader page
  res.setHeader("Content-Type", "text/html");
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Feed Uploader</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9f9f9; }
          #dropzone { border: 3px dashed #aaa; padding: 50px; text-align: center; background: white; width: 400px; cursor: pointer; }
          #dropzone.dragover { border-color: #333; background: #f0f0f0; }
        </style>
      </head>
      <body>
        <div id="dropzone">Drag & Drop Images Here</div>
        <script>
          const dropzone = document.getElementById("dropzone");
          dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
          dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
          dropzone.addEventListener("drop", async e => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            const files = e.dataTransfer.files;
            const formData = new FormData();
            for (const file of files) formData.append("images", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData, headers: { Authorization: "Basic " + btoa("${USERNAME}:${PASSWORD}") } });
            const data = await res.json();
            if (data.success) alert("✅ Uploaded successfully!");
            else alert("❌ Upload failed: " + data.error);
          });
        </script>
      </body>
    </html>
  `);
};