/** Consistent JSON error shape: { error: { code, message } } */

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function fromZod(res, err) {
  const issue = err?.issues?.[0];
  const message = issue ? `${issue.path?.join(".") || "body"}: ${issue.message}` : "Validation failed";
  return sendError(res, 400, "VALIDATION_ERROR", message);
}

module.exports = { sendError, fromZod };
