const _ = require("lodash");
const logger = require("../lib/logger");

const ConsentEnforcementService = require("../lib/ConsentEnforcementService");
const ResponseUtils = require("../lib/ResponseUtils");
const ErrorUtils = require("../lib/ErrorUtils");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;
let PROXY_PATH_PREFIX = new URL(FHIR_SERVER_BASE).pathname;
PROXY_PATH_PREFIX = PROXY_PATH_PREFIX.endsWith("/")
  ? PROXY_PATH_PREFIX
  : PROXY_PATH_PREFIX + "/";

async function onProxyReq(proxyReq, req, res) {
  const oldPath = proxyReq.path;
  proxyReq.path = req.adjustedPath
    ? PROXY_PATH_PREFIX + req.adjustedPath
    : proxyReq.path;
  logger.info(`proxy -> backend: was: ${oldPath}, is: ${proxyReq.path}`);
}

async function onProxyRes(proxyRes, req, res) {
  let rawBackendBody = Buffer.from([]);
  proxyRes.on("data", (data) => {
    rawBackendBody = Buffer.concat([rawBackendBody, data]);
  });

  proxyRes.on("end", async () => {
    const method = req.method;
    if (method === "GET") {
      processResponse(rawBackendBody, proxyRes, req, res);
    } else {
      sendIntactResponse(rawBackendBody, proxyRes, req, res);
    }
  });
}

function sendIntactResponse(rawBackendBody, proxyRes, req, res) {
  ResponseUtils.sendResponse(
    res,
    proxyRes.headers,
    proxyRes.statusCode,
    rawBackendBody
  );
  res.end();
}

async function processResponse(rawBackendBody, proxyRes, req, res) {
  try {
    if (ResponseUtils.responseIsError(proxyRes)) {
      ResponseUtils.sendResponse(
        res,
        proxyRes.headers,
        proxyRes.statusCode,
        rawBackendBody
      );
    } else {
      const parsedBackendResponse = ResponseUtils.parseResponseBody(
        rawBackendBody,
        proxyRes.headers
      );

      const modifiedResponse = await ConsentEnforcementService.processFHIRResponse(
        req,
        parsedBackendResponse
      );
      ResponseUtils.sendJsonResponse(
        res,
        proxyRes.headers,
        proxyRes.statusCode,
        modifiedResponse
      );
    }
  } catch (e) {
    const errorResponse = ErrorUtils.proxyResponseExceptionResponse(e);
    ResponseUtils.sendJsonResponse(
      res,
      errorResponse.headers,
      errorResponse.status,
      errorResponse.body
    );
  } finally {
    res.end();
  }
}

module.exports = {
  onProxyRes,
  onProxyReq
};
