const _ = require("lodash");
const jwt = require("jsonwebtoken");

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY.replace(/\\n/gm, "\n");

function getToken(req) {
  const authHeader = _.get(req, "headers.authorization") || "";
  const token = _.get(authHeader.split("Bearer "), "[1]");
  return token;
}

function verifyAndDecodeToken(req) {
  const token = getToken(req);
  return jwt.verify(token, JWT_PUBLIC_KEY);
}

module.exports = { verifyAndDecodeToken };
