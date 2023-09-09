const _ = require("lodash");
const hash = require("object-hash");

const REDACT_OBLIGATION = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  code: "REDACT"
};

function redactResource(obligations, resource) {
  return obligations.some(
    (obligation) =>
      redactBecauseOfConfidentialityLabel(obligation, resource) ||
      redactBecauseOfResourceType(obligation, resource)
  );
}

function redactBecauseOfConfidentialityLabel(obligation, resource) {
  const resourceSecLabelsRaw = resource?.meta?.security || [];
  const resourceSecLabels = resourceSecLabelsRaw.map((label) =>
    _.pick(label, ["system", "code"])
  );
  const codes = obligation?.parameters?.codes || [];
  const exceptAnyOfCodes = obligation?.parameters?.exceptAnyOfCodes;

  return (
    _.isEqual(REDACT_OBLIGATION, obligation.id) &&
    ((codes && _.intersectionBy(resourceSecLabels, codes, hash).length) ||
      (exceptAnyOfCodes &&
        !_.intersectionBy(resourceSecLabels, exceptAnyOfCodes, hash).length))
  );
}

function redactBecauseOfResourceType(obligation, resource) {
  const codes = obligation?.parameters?.codes || [];
  const contentClassCodes = codes.filter(
    (code) => code.system === "http://hl7.org/fhir/resource-types"
  );

  return contentClassCodes.some(
    (contentClassCode) => contentClassCode.code === resource.resourceType
  );
}

module.exports = {
  redactResource
};
