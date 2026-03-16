const app = require("./src/app");
const pool = require("./src/config/db");
const { PORT } = require("./src/config/env");

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err.message);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
