export function notFound(req, res) {
  res.status(404).json({ error: "Route not found." });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error?.code === 11000) {
    return res.status(409).json({ error: "This request has already been submitted." });
  }
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "The server could not complete this request." : error.message;
  res.status(status).json({ error: message || "The request could not be completed." });
}
