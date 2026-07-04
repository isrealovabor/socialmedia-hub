export function notFound(req, res, next) {
  res.status(404).json({ success: false, message: "Route not found." });
}

export function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Something went wrong.";

  if (error.code === "P1001") {
    statusCode = 503;
    message =
      "Database connection failed. Make sure DATABASE_URL points to a reachable database. For local development, use DATABASE_URL=\"file:./dev.db\".";
  }

  if (error.code === "P2021" || error.code === "P2022") {
    statusCode = 500;
    message = "Database tables are missing. Run npx prisma migrate dev in the server folder.";
  }

  if (error.code === "P2002") {
    statusCode = 409;
    message = "A record with this value already exists.";
  }

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ success: false, message });
}
