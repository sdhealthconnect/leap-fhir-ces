const _ = require("lodash");

const logger = require("./logger");

const ConsentDecision = require("./ConsentDecision");
const PatientDiscovery = require("./PatientDiscovery");

const UNPROTECTED_RESOURCE_TYPES = (
  process.env.UNPROTECTED_RESOURCE_TYPES || ""
)
  .split(",")
  .map((res) => res.trim());

async function processFHIRResponse(req, response) {
  if (responseIsProtected(response)) {
    const updatedResponse = await checkConsent(req, response);
    return updatedResponse;
  } else {
    return response;
  }
}

async function checkConsent(req, response) {
  return response.resourceType === "Bundle"
    ? checkConsentForBundle(req, response)
    : checkConsentForResource(req, response);
}

async function checkConsentForBundle(req, response) {
  const newResponse = _.cloneDeep(response);
  _.unset(newResponse, "total");

  const patientRefs = response.entry
    .map((anEntry) => PatientDiscovery.patientReference(anEntry.resource))
    .filter((ref, i) => {
      ref || (newResponse.entry[i] = null);
      return ref;
    });

  const patientIdentifierPromises = patientRefs.map((patientRef) =>
    PatientDiscovery.fetchPatientIdentifier(patientRef)
  );
  try {
    const patientIdentifiers = await Promise.all(patientIdentifierPromises);

    const consentDecisionRequestTemplate = getContextAttributes(req);

    const consentDecisionRequests = patientIdentifiers.map(
      (patientIdentifiers) => ({
        ...consentDecisionRequestTemplate,
        patientId: patientIdentifiers
      })
    );
    
    const consentDecisionPromises = consentDecisionRequests.map((request) =>
      ConsentDecision.getDecision(request)
    );
    const consentDecisions = await Promise.all(consentDecisionPromises);

    consentDecisions.map((consentDecision, i) => {
      consentDecision.decision === "CONSENT_PERMIT" ||
        (newResponse.entry[i] = null);
    });
  } catch (e) {
    logger.warn(`consent denied acccess to ${req.path}`);
    throw {
      error: "consent_deny"
    };
  }
  newResponse.entry = newResponse.entry.filter((anEntry) => anEntry);
  return newResponse;
}

async function checkConsentForResource(req, response) {
  const patientRef = PatientDiscovery.patientReference(response);
  if (!patientRef) {
    throw {
      error: "consent_deny"
    };
  }
  const patientIdentifiers = await PatientDiscovery.fetchPatientIdentifier(
    patientRef
  );

  const consentDecisionRequest = getContextAttributes(req);
  consentDecisionRequest.patientId = patientIdentifiers;
  const consentDecision = await ConsentDecision.getDecision(
    consentDecisionRequest
  );
  if (consentDecision.decision === "CONSENT_PERMIT") {
    return response;
  } else {
    logger.warn(`consent denied acccess to ${req.path}`);
    throw {
      error: "consent_deny"
    };
  }
}

function getContextAttributes(req) {
  //todo: temporary; read from JWT
  return {
    actor: [
      {
        system: "urn:ietf:rfc:3986",
        value: "2.16.840.1.113883.20.5"
      }
    ]
  };
}

function responseIsProtected(response) {
  return (
    response && (isAProtectedBundle(response) || isAProtectedResource(response))
  );
}

function isAProtectedBundle(response) {
  return (
    response.resourceType === "Bundle" &&
    response.entry &&
    response.entry.length > 0 &&
    !response.entry.every((anEntry) =>
      UNPROTECTED_RESOURCE_TYPES.includes(anEntry.resource.resourceType)
    )
  );
}

function isAProtectedResource(response) {
  return (
    response.resourceType !== "Bundle" &&
    !UNPROTECTED_RESOURCE_TYPES.includes(response.resourceType)
  );
}

module.exports = {
  processFHIRResponse,
  responseIsProtected,
  checkConsentForResource
};
