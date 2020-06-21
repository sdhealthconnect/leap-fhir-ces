const nock = require("nock");

const PatientDiscovery = require("../../lib/PatientDiscovery");

const FHIR_SERVER_BASE =
  process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE)
  .defaultReplyHeaders({ "Content-Type": "application/json; charset=utf-8" })
  .replyContentLength();

beforeEach(async () => {});

afterEach(() => {
  nock.cleanAll();
});

it("should correctly fetch patient ref from resource", () => {
  const resource = require("../fixtures/medication-statement.json");
  expect(PatientDiscovery.patientReference(resource)).toEqual("Patient/1");
});

it("should correctly call and fetch patient identifiers", async () => {
  expect.assertions(1);
  const patient = require("../fixtures/patient.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient);

  const patientIdentifiers = await PatientDiscovery.fetchPatientIdentifier(
    "Patient/1"
  );

  expect(patientIdentifiers).toEqual([
    { system: "urn:official:id", value: "10001" }
  ]);
});
