// Lets controllers throw errors without try/catch (Express 4 needs this wrapper)
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  let status = res.statusCode >= 400 ? res.statusCode : 500;
  let message = err.message;

  if (err.name === "ValidationError") {
    status = 400;
    message = "Some details are missing or invalid.";
  } else if (err.name === "CastError") {
    status = 400;
    message = "That ID isn't valid.";
  } else if (err.code === 11000) {
    status = 409;
    message = "An account or record with that value already exists.";
  } else if (err.name === "MulterError") {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller." : err.message;
  }
  if (status === 500 && process.env.NODE_ENV === "production") {
    console.error(err);
    message = "Something went wrong on our side. Please try again.";
  }
  res.status(status).json({ message });
}
