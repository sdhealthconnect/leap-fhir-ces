const _ = require("lodash");
const hash = require("object-hash");

const REDACT_OBLIGATION = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  code: "REDACT"
};

function redactResource(obligations, resource) {
  return obligations.some((obligation) =>
    redactBecauseOfConfidentialityLabel(obligation, resource)
  );
}

function redactBecauseOfConfidentialityLabel(obligation, resource) {
  const resourceSecLabelsRaw = _.get(resource, "meta.security") || [];
  const resourceSecLabels = resourceSecLabelsRaw.map((label) =>
    _.pick(label, ["system", "code"])
  );
  const codes = _.get(obligation, "parameters.codes");
  const exceptAnyOfCodes = _.get(obligation, "parameters.exceptAnyOfCodes");

  return (
    _.isEqual(REDACT_OBLIGATION, obligation.id) &&
    ((codes && _.intersectionBy(resourceSecLabels, codes, hash).length) ||
      (exceptAnyOfCodes &&
        !_.intersectionBy(resourceSecLabels, exceptAnyOfCodes, hash).length))
  );
  //this should be expanded to other types of obligation like content class.
}

module.exports = {
  redactResource
};
