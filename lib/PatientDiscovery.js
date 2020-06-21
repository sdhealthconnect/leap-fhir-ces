const _ = require("lodash");
const request = require("superagent");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

function patientReference(resource) {
  const patientRef =
    _.get(resource, "patient.reference") ||
    _.get(resource, "subject.reference"); //this logic should be improved

  return patientRef;
}

async function fetchPatientIdentifier(patientRef) {
  const patientResourcePath = `${FHIR_SERVER_BASE}/${patientRef}`;
  const patientResponse = await request
    .get(patientResourcePath)
    .set("Accept", "application/json");

  const patient = patientResponse.body;

  const patientIdentifiers = _.get(patient, "identifier") || [];
  const patientIdentifiersTrimmed = patientIdentifiers.map((identifier) =>
    _.pick(identifier, ["system", "value"])
  );

  return patientIdentifiersTrimmed;
}

module.exports = {
  patientReference,
  fetchPatientIdentifier
};
