import { getSession } from "../lib/session.js";

export default async (req, res) => {
  const cookies = parseCookies(req);
  const session = getSession(cookies.session);

  if (!session) {
    console.log("❌ No valid session, redirecting to login");
    res.writeHead(302, { Location: "/api/login" });
    res.end();
    return;
  }

  console.log("✅ Session found for", session.username);

  res.setHeader("Content-Type", "text/html");
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Feed Uploader</title></head>
      <body>
        <h2>Welcome, ${session.username}</h2>
        <div id="dropzone">Drag & Drop Images Here</div>
        <a href="/api/logout">Logout</a>
        <script>
          const dropzone = document.getElementById("dropzone");
          dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
          dropzone.addEventListener("drop", async e => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            const formData = new FormData();
            for (const file of files) formData.append("images", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) alert("✅ Uploaded successfully!");
            else alert("❌ Upload failed: " + data.error);
          });
        </script>
      </body>
    </html>
  `);
};