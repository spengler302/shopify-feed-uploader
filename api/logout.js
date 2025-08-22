import { destroySession } from "../lib/session.js";

export default async (req, res) => {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter(([k, v]) => k && v)
  );

  if (cookies.session) {
    destroySession(cookies.session);
  }

  res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0");
  res.writeHead(302, { Location: "/api/login" });
  res.end();
};