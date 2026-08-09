export function getHealth(req, res) {
  res.json({
    ok: true,
    app: "OfficeKhoj BD MERN API",
    stack: ["MongoDB", "Express", "React", "Node"],
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
}
