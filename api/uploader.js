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

export default async (req, res) => {
  const cookies = parseCookies(req);
  const user = cookies.session;

  if (!user) {
    res.writeHead(302, { Location: "/api/login" });
    res.end();
    return;
  }

  res.setHeader("Content-Type", "text/html");
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Feed Uploader</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f9f9f9; }
          #dropzone { border: 3px dashed #aaa; padding: 50px; text-align: center; background: white; width: 400px; cursor: pointer; margin-bottom: 20px; }
          #dropzone.dragover { border-color: #333; background: #f0f0f0; }
          a.logout { font-size: 14px; color: #c00; text-decoration: none; }
        </style>
      </head>
      <body>
        <h2>Welcome, ${user}</h2>
        <div id="dropzone">Drag & Drop Images Here</div>
        <a href="/api/logout" class="logout">Logout</a>
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

            try {
              const res = await fetch("/api/upload", { method: "POST", body: formData });
              const data = await res.json();
              if (data.success) {
                alert("✅ Uploaded successfully!");
              } else {
                alert("❌ Upload failed: " + data.error);
              }
            } catch (err) {
              console.error("Upload error:", err);
              alert("❌ Upload failed: " + err.message);
            }
          });
        </script>
      </body>
    </html>
  `);
};