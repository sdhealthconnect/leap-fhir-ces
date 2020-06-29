const express = require("express");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");
const logger = require("./lib/logger");

const FHIRProxy = require("./controllers/FHIRProxy");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

const app = express();

app.set("trust proxy", true);

//middlewares
process.env.NODE_ENV === "production" || app.use(morgan("dev"));

const proxyOptions = {
  target: FHIR_SERVER_BASE,
  onProxyRes: FHIRProxy.onProxyRes,
  onProxyReq: FHIRProxy.onProxyReq,
  xfwd: true,
  changeOrigin: true,
  selfHandleResponse: true
};

logger.info(
  `Starting the proxy.`
);
app.use("/", createProxyMiddleware(proxyOptions));

module.exports = app;
