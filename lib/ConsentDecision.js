const request = require("superagent");
const _ = require("lodash");
const hash = require("object-hash");

const CDS_HOST = process.env.CDS_HOST;

const CDS_ENDPOINT = `${CDS_HOST}/cds-services/patient-consent-consult`;

const requestTemplate = {
  hook: "patient-consent-consult",
  hookInstance: "hook-instance-123",
  context: {
    patientId: [],
    scope: "patient-privacy",
    purposeOfUse: "TREAT",
    actor: []
  }
};

async function getDecision(requestParams) {
  const consentRequest = _.cloneDeep(requestTemplate);
  consentRequest.context = {
    ...consentRequest.context,
    ...requestParams
  };

  const response = await request
    .post(CDS_ENDPOINT)
    .set("Accept", "application/json")
    .send(consentRequest);

  return _.get(response.body, "cards[0].extension");
}

async function getDecisions(requestParamsArray) {
  const uniqueRequests = _.uniqBy(requestParamsArray, (value) => hash(value));

  const decisionPromises = uniqueRequests.map((requestParams) =>
    getDecision(requestParams)
  );
  const decisions = await Promise.all(decisionPromises);
  const cache = _.fromPairs(
    decisions.map((decision, i) => [hash(uniqueRequests[i]), decision])
  );

  return requestParamsArray.map((request) => cache[hash(request)]);
}

module.exports = {
  getDecision,
  getDecisions
};
