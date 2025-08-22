import crypto from "crypto";

const sessions = new Map(); // in-memory session store

export function createSession(username) {
  const token = crypto.randomBytes(16).toString("hex");
  sessions.set(token, { username, created: Date.now() });
  return token;
}

export function getSession(token) {
  return sessions.get(token);
}

export function destroySession(token) {
  sessions.delete(token);
}