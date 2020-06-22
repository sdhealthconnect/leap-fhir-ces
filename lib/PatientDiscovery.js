const _ = require("lodash");
const request = require("superagent");
const hash = require("object-hash");

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

async function fetchMultiplePatientIdentifiers(patientRefs) {  
  const uniquePatienRefs = _.uniqBy(patientRefs, (e) => hash(e));
  
  const patientIdentifierPromises = uniquePatienRefs.map((ref) =>
    fetchPatientIdentifier(ref)
  );

  const patientIdentifiers = await Promise.all(patientIdentifierPromises);

  const cache = _.fromPairs(
    patientIdentifiers.map((id, i) => [patientRefs[i], id])
  );

  return patientRefs.map((ref) => cache[ref]);
}

module.exports = {
  patientReference,
  fetchPatientIdentifier,
  fetchMultiplePatientIdentifiers
};
