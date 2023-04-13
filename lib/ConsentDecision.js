const request = require("superagent");
const _ = require("lodash");
const hash = require("object-hash");

const CDS_HOST = process.env.CDS_HOST;

const CDS_ENDPOINT = `${CDS_HOST}/cds-services/patient-consent-consult`;

async function getDecision(requestParams) {
  const consentRequest = {
    hook: "patient-consent-consult",
    hookInstance: "hook-instance-123",
    context: {
      patientId: [],
      category: [
        {
          system: "http://terminology.hl7.org/CodeSystem/consentscope",
          code: "patient-privacy"
        }
      ],
      purposeOfUse: ["TREAT"],
      actor: [],
      ...requestParams
    }
  };

  const response = await request
    .post(CDS_ENDPOINT)
    .set("Accept", "application/json")
    .send(consentRequest);

  return response.body?.cards?.[0]?.extension;
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
