const nock = require("nock");
const request = require("supertest");
const app = require("../app");

const FHIR_SERVER_BASE =
  process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";

const CDS_HOST = process.env.CDS_HOST || "https://mock-cds";
const CDS_ENDPOINT = "/cds-services/patient-consent-consult";

const CDS_PERMIT_RESPONSE = {
  cards: [
    {
      summary: "CONSENT_PERMIT",
      detail: "There is a patient consent permitting this action.",
      indicator: "info",
      source: {
        label: "Sample",
        url: "https://sample-cdms.org"
      },
      extension: {
        decision: "CONSENT_PERMIT",
        obligations: [
          {
            id: {
              system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
              code: "REDACT"
            },
            parameters: {
              codes: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                  code: "R"
                }
              ]
            }
          }
        ]
      }
    }
  ]
};

const CDS_DENY_RESPONSE = {
  cards: [
    {
      summary: "CONSENT_DENY",
      detail: "",
      indicator: "critical",
      source: {
        label: "Sample",
        url: "https://sample-cdms.org"
      },
      extension: {
        decision: "CONSENT_DENY",
        obligations: []
      }
    }
  ]
};

const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE)
  .defaultReplyHeaders({ "Content-Type": "application/json; charset=utf-8" })
  .replyContentLength();

const MOCK_CDS = nock(CDS_HOST)
  .defaultReplyHeaders({ "Content-Type": "application/json; charset=utf-8" })
  .replyContentLength();

beforeEach(async () => {});

afterEach(() => {
  nock.cleanAll();
});

it("should fetch a resource if consent permits", async () => {
  expect.assertions(2);
  const patient = require("./fixtures/patient.json");
  const medication = require("./fixtures/medication-statement.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient);
  MOCK_FHIR_SERVER.get("/MedicationStatement/1").reply(200, medication);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement/1")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body).toEqual(medication);
});

it("should send 403 if consent denies", async () => {
  expect.assertions(1);
  const patient = require("./fixtures/patient.json");
  const medication = require("./fixtures/medication-statement.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient);
  MOCK_FHIR_SERVER.get("/MedicationStatement/1").reply(200, medication);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_DENY_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement/1")
    .set("content-type", "application/json");

  expect(res.status).toEqual(403);
});

it("should fetch a bundle and return only the resources which the consent permits", async () => {
  expect.assertions(2);
  const patient1 = require("./fixtures/patient.json");
  const patient2 = require("./fixtures/patient-second.json");
  const medicationBundle = require("./fixtures/medication-statement-bundle.json");
  MOCK_FHIR_SERVER.get("/Patient/1").times(2).reply(200, patient1);
  MOCK_FHIR_SERVER.get("/Patient/2").reply(200, patient2);
  MOCK_FHIR_SERVER.get("/MedicationStatement").reply(200, medicationBundle);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);
  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_DENY_RESPONSE);
  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body.entry.length).toEqual(2);
});