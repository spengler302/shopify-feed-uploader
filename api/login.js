import { createSession } from "../lib/session.js";

export default async (req, res) => {
  const USERNAME = process.env.UPLOADER_USER;
  const PASSWORD = process.env.UPLOADER_PASS;

  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html");
    res.end(`
      <form method="POST" action="/api/login" style="max-width:300px;margin:100px auto;font-family:sans-serif;">
        <h2>Login</h2>
        <input type="text" name="username" placeholder="Username" style="width:100%;margin-bottom:10px;padding:8px;" />
        <input type="password" name="password" placeholder="Password" style="width:100%;margin-bottom:10px;padding:8px;" />
        <button type="submit" style="width:100%;padding:8px;">Login</button>
      </form>
    `);
  } else if (req.method === "POST") {
    // Collect the body safely
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    const params = new URLSearchParams(body);
    const username = params.get("username");
    const password = params.get("password");

    if (username === USERNAME && password === PASSWORD) {
      const token = createSession(username);

      // Set secure cookie
      res.setHeader(
        "Set-Cookie",
        `session=${token}; HttpOnly; Path=/; Secure; SameSite=Strict`
      );

      res.writeHead(302, { Location: "/api/uploader" });
      res.end();
    } else {
      res.statusCode = 401;
      res.end("❌ Invalid credentials. <a href='/api/login'>Try again</a>");
    }
  } else {
    res.statusCode = 405;
    res.end("Method not allowed");
  }
};