// Express 4 doesn't catch rejected promises from async route handlers
// on its own. Wrapping each handler with this wires any thrown/rejected
// error into next(err), so it reaches our centralized error page
// instead of crashing the process.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
