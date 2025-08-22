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
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; background: #f9f9f9; padding: 20px; }
          img.logo { width: 250px; height: 250px; object-fit: contain; margin-bottom: 20px; }
          h2 { margin: 10px 0 20px; }
          #dropzone { border: 3px dashed #aaa; padding: 50px; text-align: center; background: white; width: 400px; cursor: pointer; margin-bottom: 20px; }
          #dropzone.dragover { border-color: #333; background: #f0f0f0; }
          #progress-container { width: 400px; background: #eee; border-radius: 4px; margin-top: 15px; height: 20px; overflow: hidden; display: none; position: relative; }
          #progress-bar { height: 100%; width: 0%; background: #4caf50; transition: width 0.3s; }
          #progress-text { margin-top: 8px; font-size: 14px; color: #333; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #333; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; margin-right: 6px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          #cancel-btn { margin-top: 10px; padding: 6px 12px; background: #c00; color: #fff; border: none; border-radius: 4px; cursor: pointer; display: none; }
          #cancel-btn:hover { background: #a00; }
          a.logout { font-size: 14px; color: #c00; text-decoration: none; margin-top: auto; }
        </style>
      </head>
      <body>
        <!-- ✅ Logo placeholder -->
        <img src="https://cdn.shopify.com/s/files/1/0561/2276/9591/files/Banner_2_abed2b31-923c-48ba-ad97-1f0125ae8896.jpg?v=1755855209" alt="Logo" />

        <h2>Welcome, ${user}</h2>
        <div id="dropzone">Drag & Drop Images Here</div>
        <div id="progress-container"><div id="progress-bar"></div></div>
        <div id="progress-text"></div>
        <button id="cancel-btn">Cancel Uploads</button>

        <script>
          const dropzone = document.getElementById("dropzone");
          const progressContainer = document.getElementById("progress-container");
          const progressBar = document.getElementById("progress-bar");
          const progressText = document.getElementById("progress-text");
          const cancelBtn = document.getElementById("cancel-btn");

          let cancelRequested = false;

          cancelBtn.addEventListener("click", () => {
            cancelRequested = true;
            progressText.innerHTML = "❌ Upload cancelled by user.";
            cancelBtn.style.display = "none";
          });

          dropzone.addEventListener("dragover", e => {
            e.preventDefault();
            dropzone.classList.add("dragover");
          });

          dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

          dropzone.addEventListener("drop", async e => {
            e.preventDefault();
            dropzone.classList.remove("dragover");

            const files = Array.from(e.dataTransfer.files);
            if (!files.length) return;

            cancelRequested = false;
            progressContainer.style.display = "block";
            progressBar.style.width = "0%";
            progressText.innerHTML = '<div class="spinner"></div> Preparing upload...';
            cancelBtn.style.display = "inline-block";

            for (let i = 0; i < files.length; i++) {
              if (cancelRequested) break;

              const file = files[i];
              progressText.innerHTML = '<div class="spinner"></div> Uploading ' + (i+1) + ' of ' + files.length + ': ' + file.name;

              const formData = new FormData();
              formData.append("images", file);

              try {
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                const data = await res.json();

                if (!data.success) {
                  throw new Error(data.error || "Unknown error");
                }

                // Update progress bar
                const percent = Math.round(((i+1) / files.length) * 100);
                progressBar.style.width = percent + "%";
              } catch (err) {
                console.error("❌ Upload failed:", file.name, err);
                alert("❌ Upload failed: " + file.name + " → " + err.message);
              }
            }

            if (!cancelRequested) {
              progressText.innerHTML = "✅ All uploads complete!";
            }
            cancelBtn.style.display = "none";
          });
        </script>

        <a href="https://www.bootlegger.coffee/pages/bootleggersa-campaign" 
          target="_blank" 
          style="margin-top:20px;display:inline-block;padding:10px 20px;background:#333;color:#fff;text-decoration:none;border-radius:4px;">
          🔗 View Updated Feed
        </a>

        <!-- ✅ Logout moved to bottom -->
        <a href="/api/logout" class="logout">Logout</a>
      </body>
    </html>
  `);
};