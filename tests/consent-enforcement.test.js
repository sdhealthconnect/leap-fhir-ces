const path = require("path");
const fs = require("fs");
const nock = require("nock");
const request = require("supertest");
const app = require("../app");
const _ = require("lodash");
const jwt = require("jsonwebtoken");

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

const CDS_PERMIT_RESPONSE_CONTENT_CLASS_OBLIGATION = {
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
                  system: "http://hl7.org/fhir/resource-types",
                  code: "MedicationStatement"
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

const privateKey = fs.readFileSync(
  path.resolve(__dirname, "./fixtures/test-private-key.pem")
);

const JWT = jwt.sign(
  {
    actor: {
      system: "urn:ietf:rfc:3986",
      value: "2.16.840.1.113883.20.5"
    },
    pou: "TREAT"
  },
  privateKey,
  { algorithm: "RS512" }
);

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

  const medication = _.cloneDeep(
    require("./fixtures/medication-statement.json")
  );
  medication.meta = undefined;

  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient);
  MOCK_FHIR_SERVER.get("/MedicationStatement/1").reply(200, medication);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement/1")
    .set("content-type", "application/json")
    .set("Authorization", `Bearer ${JWT}`);

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
    .set("content-type", "application/json")
    .set("Authorization", `Bearer ${JWT}`);

  expect(res.status).toEqual(403);
});

it("should send 403 if consent obligation requires redaction", async () => {
  expect.assertions(1);
  const patient = require("./fixtures/patient.json");
  const medication = require("./fixtures/medication-statement.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient);
  MOCK_FHIR_SERVER.get("/MedicationStatement/1").reply(200, medication);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement/1")
    .set("content-type", "application/json")
    .set("Authorization", `Bearer ${JWT}`);

  expect(res.status).toEqual(403);
});

it("should fetch a bundle and return only the resources which the consent permits and not to be redacted", async () => {
  expect.assertions(3);
  const patient1 = require("./fixtures/patient.json");
  const patient2 = require("./fixtures/patient-second.json");
  const medicationBundle = require("./fixtures/medication-statement-bundle.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient1);
  MOCK_FHIR_SERVER.get("/Patient/2").reply(200, patient2);
  MOCK_FHIR_SERVER.get("/MedicationStatement").reply(200, medicationBundle);

  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_PERMIT_RESPONSE);
  MOCK_CDS.post(CDS_ENDPOINT).reply(200, CDS_DENY_RESPONSE);

  const res = await request(app)
    .get("/MedicationStatement")
    .set("content-type", "application/json")
    .set("Authorization", `Bearer ${JWT}`);

  expect(res.status).toEqual(200);
  expect(res.body.entry.length).toEqual(1);
  expect(res.body.entry[0].resource.id).toEqual("1");
});

it("should fetch a bundle and return only the resources which the consent permits and not to be redacted based on resource type redaction obligations", async () => {
  expect.assertions(2);
  const patient1 = require("./fixtures/patient.json");
  const patient2 = require("./fixtures/patient-second.json");
  const medicationBundle = require("./fixtures/medication-statement-bundle.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, patient1);
  MOCK_FHIR_SERVER.get("/Patient/2").reply(200, patient2);
  MOCK_FHIR_SERVER.get("/MedicationStatement").reply(200, medicationBundle);

  MOCK_CDS.post(CDS_ENDPOINT).reply(
    200,
    CDS_PERMIT_RESPONSE_CONTENT_CLASS_OBLIGATION
  );
  MOCK_CDS.post(CDS_ENDPOINT).reply(
    200,
    CDS_PERMIT_RESPONSE_CONTENT_CLASS_OBLIGATION
  );

  const res = await request(app)
    .get("/MedicationStatement")
    .set("content-type", "application/json")
    .set("Authorization", `Bearer ${JWT}`);

  expect(res.status).toEqual(200);
  expect(res.body.entry.length).toEqual(0);
});
