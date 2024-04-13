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
  on: {
    proxyRes: FHIRProxy.onProxyRes,
    proxyReq: FHIRProxy.onProxyReq
  },
  xfwd: true,
  changeOrigin: true,
  selfHandleResponse: true
};

//this is a requirement for gcp
app.get("/_ah/start", (req, res) => {
  res.sendStatus(404);
});

logger.info(`Starting the proxy.`);
app.use("/", createProxyMiddleware(proxyOptions));

module.exports = app;
