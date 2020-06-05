const zlib = require("zlib");
const _ = require("lodash");

function sendResponse(resObject, headers, statusCode, body) {
  resObject.set(headers);
  resObject.statusCode = statusCode;
  resObject.write(body);
}

function sendJsonResponse(resObject, headers, statusCode, jsonBody) {
  const bodyBytes = Buffer.from(JSON.stringify(jsonBody), "utf8");

  _.unset(headers, "Content-Type");
  _.unset(headers, "content-type");
  _.unset(headers, "Content-Encoding");
  _.unset(headers, "content-encoding");
  _.unset(headers, "transfer-encoding");
  _.unset(headers, "Transfer-Encoding");
  _.unset(headers, "Content-Length");
  _.unset(headers, "content-length");
  const newHeaders = {
    "Content-Type": "application/json",
    "Content-Encoding": "identity",
    "Transfer-Encoding": "identity",
    ...headers
  };
  sendResponse(resObject, newHeaders, statusCode, bodyBytes);
}

function parseResponseBody(rawBody, responseHeaders) {
  if (!rawBody.length) {
    return null;
  }
  const contentEncoding = responseHeaders["content-encoding"];
  const backendResponseBytes =
    contentEncoding === "gzip"
      ? zlib.gunzipSync(rawBody)
      : contentEncoding === "deflate"
      ? zlib.inflateSync(rawBody)
      : rawBody;
  return JSON.parse(backendResponseBytes.toString("utf8"));
}

function responseIsError(response) {
  return response.statusCode != 200;
}

module.exports = {
  parseResponseBody,
  sendResponse,
  sendJsonResponse,
  responseIsError
};
