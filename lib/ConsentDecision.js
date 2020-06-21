const request = require("superagent");
const _ = require("lodash");

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

module.exports = {
  getDecision
};
