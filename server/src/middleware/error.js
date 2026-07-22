export function notFound(req, res, next) {
  res.status(404).json({ success: false, message: "Route not found." });
}

export function errorHandler(error, req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  let statusCode = error.statusCode || 500;
  let message = error.message || "Something went wrong.";

  if (error.code === "P1001") {
    statusCode = 503;
    message = "Database service is temporarily unavailable.";
  }

  if (error.code === "P2021" || error.code === "P2022") {
    statusCode = 500;
    message = "Database service is temporarily unavailable.";
  }

  if (error.code === "P2002") {
    statusCode = 409;
    message = "A record with this value already exists.";
  }

  if (statusCode === 500) {
    console.error({
      name: error.name || "Error",
      code: error.code || "INTERNAL_ERROR",
      method: req.method,
      path: req.originalUrl,
    });
    if (isProduction) message = "An internal server error occurred.";
  }

  res.status(statusCode).json({ success: false, message });
}
