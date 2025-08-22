export default async (req, res) => {
  // Force browser to forget Basic Auth by sending a 401
  res.setHeader("WWW-Authenticate", "Basic realm='Uploader'");
  res.statusCode = 401;
  res.end("Logged out. <a href='/api/login'>Login again</a>");
};