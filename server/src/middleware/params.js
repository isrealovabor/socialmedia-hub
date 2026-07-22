import { ApiError } from "../utils/errors.js";

const opaqueIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSafeOpaqueIdentifier(value) {
  return opaqueIdentifierPattern.test(String(value || ""));
}

export function validateOpaqueParam(req, res, next, value, name) {
  if (!isSafeOpaqueIdentifier(value)) {
    next(new ApiError(400, `Invalid ${name || "identifier"}.`));
    return;
  }
  next();
}

export function validateSlugParam(req, res, next, value) {
  if (String(value || "").length > 100 || !slugPattern.test(String(value || ""))) {
    next(new ApiError(400, "Invalid category slug."));
    return;
  }
  next();
}
