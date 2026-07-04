import { ZodError } from "zod";
import { ApiError } from "./errors.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = (error.issues || error.errors || []).map((issue) => issue.message).join(", ");
        next(new ApiError(400, message || "Invalid request data"));
        return;
      }
      next(error);
    }
  };
}
