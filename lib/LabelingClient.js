const request = require("superagent");
const CDS_HOST = process.env.CDS_HOST;
const SLS_ENDPOINT = `${CDS_HOST}/sls`;

async function label(resource) {
  try {
    const response = await request
      .post(SLS_ENDPOINT)
      .set("Accept", "application/json")
      .send(resource);

    return response.body;
  } catch (e) {
    console.log(e)
    logger.warn(`SLS invocation failed: ${e}`);
    throw {
        error: "internal_error",
        status: 500
    };
  }
}

module.exports = {
  label
};
