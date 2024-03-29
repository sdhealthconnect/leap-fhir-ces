const logger = require("./logger");

const ConsentDecision = require("./ConsentDecision");
const PatientDiscovery = require("./PatientDiscovery");
const RedactionService = require("./RedactionService");
const AuthUtils = require("./AuthUtils");
const { label } = require("./LabelingClient");

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
  const newResponse = await label(response);
  delete newResponse.total; //total is optional and we cannot know what resources are redacted.

  const patientRefs = response.entry
    .map((anEntry) => PatientDiscovery.patientReference(anEntry.resource))
    .filter((ref, i) => {
      ref || (newResponse.entry[i] = null);
      return ref;
    });

  logger.info(`patient references: ${JSON.stringify(patientRefs, null, 2)}`);

  try {
    const patientIdentifiers =
      await PatientDiscovery.fetchMultiplePatientIdentifiers(patientRefs);

    const consentDecisionRequestTemplate = getContextAttributes(req);

    const consentDecisionRequests = patientIdentifiers.map(
      (patientIdentifiers) => ({
        ...consentDecisionRequestTemplate,
        patientId: patientIdentifiers
      })
    );

    const consentDecisions = await ConsentDecision.getDecisions(
      consentDecisionRequests
    );

    logger.info(
      `consent decisions: ${JSON.stringify(consentDecisions, null, 2)}`
    );

    consentDecisions.map((consentDecision, i) => {
      releasePermitted(consentDecision, newResponse.entry[i]?.resource) ||
        (newResponse.entry[i] = null);
    });
  } catch (e) {
    logger.warn(`consent denied acccess to ${req.path} because ${e}`);
    throw {
      error: "consent_deny"
    };
  }
  newResponse.entry = newResponse.entry.filter((anEntry) => anEntry);
  return newResponse;
}

const releasePermitted = (consentDecision, resource) =>
  consentDecision.decision === "CONSENT_PERMIT" &&
  !RedactionService.redactResource(consentDecision.obligations, resource);

async function checkConsentForResource(req, response) {
  const newResponse = await label(response);
  const patientRef = PatientDiscovery.patientReference(newResponse);
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
  logger.info(`consent decision: ${JSON.stringify(consentDecision)}`);

  if (releasePermitted(consentDecision, newResponse)) {
    return newResponse;
  } else {
    logger.warn(`consent denied acccess to ${req.path}`);
    throw {
      error: "consent_deny"
    };
  }
}

function getContextAttributes(req) {
  try {
    const token = AuthUtils.verifyAndDecodeToken(req);
    if (!token.actor) {
      throw {
        error: "token_error"
      };
    }
    return {
      actor: [token.actor],
      purposeOfUse: token.pou
    };
  } catch (e) {
    console.log(e);
    throw {
      error: "token_error"
    };
  }
}

const responseIsProtected = (response) =>
  response && (isAProtectedBundle(response) || isAProtectedResource(response));

const isAProtectedBundle = (response) =>
  response.resourceType === "Bundle" &&
  response?.entry?.length > 0 &&
  !response.entry.every((anEntry) =>
    UNPROTECTED_RESOURCE_TYPES.includes(anEntry.resource.resourceType)
  );

const isAProtectedResource = (response) =>
  response.resourceType !== "Bundle" &&
  !UNPROTECTED_RESOURCE_TYPES.includes(response.resourceType);

module.exports = {
  processFHIRResponse,
  responseIsProtected,
  checkConsentForResource
};
