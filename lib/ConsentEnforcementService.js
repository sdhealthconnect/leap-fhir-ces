const UNPROTECTED_RESOURCE_TYPES = (
  process.env.UNPROTECTED_RESOURCE_TYPES || ""
)
  .split(",")
  .map((res) => res.trim());

async function processFHIRResponse(req, parsedBackendResponse) {
  if (responseIsProtected(parsedBackendResponse)) {
    return parsedBackendResponse;
  } else {
    return parsedBackendResponse;
  }
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
  responseIsProtected
};
