# LEAP FHIR Proxy CES Demo
LEAP FHIR Proxy Consent Enforcement Point (CES) provides a demonstration of consent enforcement in FHIR transactions. As shown in the below diagram, the web application is implemented as a reverse proxy monitoring the incoming requests and outgoing response to/from a FHIR server. 

![Proxy CES](docs/assets/proxy.png?raw=true)

For every resource being released in the response, the CES pursues the following steps: 

- It identifies the client making the query to receive the resource based on the JWT token assumed to be provided by the client,
- It identifies the patient associated with the resource by navigating the related resources,
- It makes a query to the LEAP Consent Decision Service (CDS) to check whether releasing the resource to the client is permitted by the patient consent, and
- Removes the resource from the results if the patient consent does not permit its release to that client.

## Client Identification
Clients are identified by providing a JSON Web Token (JWT) signed by a trusted authority whose public key is known to the CES. This token is expected to be provided in the `Authorization` header of the request as a `Bearer` token and must include the following attributes:

- `actor` recording the identity of the client or the actor on whose behalf the client is making the request. This must be system-code pair based on the input of the LEAP CDS, for example:

```
{
    "system":"urn:ietf:rfc:3986",
    "value":"2.16.840.1.113883.20.5"
}
```

- `pou` recording the purpose of use for the transaction. This must be a plain value, for example `TREAT`. If `pou` is not provided it defaults to `TREAT`.

## Test Server
An instance of this service is deployed at [https://leap-fhir-ces.appspot.com](https://leap-fhir-ces.appspot.com/). This service relies on the test LEAP Consent Decision Service (CDS) and is backed by the test FHIR server located at [http://34.94.253.50:8080/hapi-fhir-jpaserver/fhir](http://34.94.253.50:8080/hapi-fhir-jpaserver/fhir). 

The trusted public key for this service and the corresponding test private key are provided [here](https://github.com/sdhealthconnect/leap-fhir-ces/tree/master/tests/fixtures). You can use this private key to sign your JWTs when communicating with this server.

### Quick Demo
You can use the following JWT agains the demo server at [https://leap-fhir-ces.appspot.com](https://leap-fhir-ces.appspot.com/).
```
eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJhY3RvciI6eyJzeXN0ZW0iOiJ1cm46aWV0ZjpyZmM6Mzk4NiIsInZhbHVlIjoidXJuOm9pZDoxLjEifSwicG91IjoiVFJFQVQiLCJpYXQiOjE1OTg1NjIzMjF9.NXaOuOhyX0YHqqX97kgCztYGYHJ3gsNF1gMk9AMSSoi9cMnurZCbNwGswr5OG5AdYKmeQmN5LvSyqY-giZN2Eyj2E5PQqerIVrm7W1VAl7JtUghvpukepPQ6nyO4orzZXDdsCfy8XFEbhLzlEQk0w4CRiRcYOtGK4-xDQHn0ALxYYAdxZicJCCMsQlJkDgRDOMi4bC4OAcnR7D-zbSDt1hoVk4NRMqSyIlFC39XucrsZZ5iOsdU5GbQpmOKbjeUAr42Y20jT-leUFw7CY17TY3CjSwyiTbvLeqVmoiihvEu7rxu3Sw52nfd80qN2YDZbi-7_aVDV8OlUutGZIKmvMg
```
which includes the following attributes and is signed by the demo private key.
```json
{
  "actor": {
    "system": "urn:ietf:rfc:3986",
    "value": "urn:oid:1.1"
  },
  "pou": "TREAT"
}
```

To run a quick test, send the following requests for a list of medication statements from the original FHIR server and the CES proxy:
```
GET http://34.94.253.50:8080/hapi-fhir-jpaserver/fhir/MedicationStatement

GET https://leap-fhir-ces.appspot.com/MedicationStatement
```

You can verify that the response from the CES Proxy does not include the `MedicateStatement` resource labeled as `Restricted`. This is because [the applicable patient consent](http://34.94.253.50:8080/hapi-fhir-jpaserver/fhir/Consent/105) includes a provision that does not permit sharing restricted resources with this actor.


## Local Setup
The following parameters need to be set as environment variables:

- `FHIR_SERVER_BASE`: the FHIR server base which the CES must protect.

- `UNPROTECTED_RESOURCE_TYPES`: a comma-separated list of resource types that are exempt from consent enforcement, for example `CapabilityStatement`.

- `CDS_HOST`: the URL for the LEAP Consent Decision Service. 

- `JWT_PUBLIC_KEY`: the public key of the trusted party to sign client JWTs in PEM format. Note that because of the limitations of environment variables and the `dotenv` package which does not allow newlines in values, all newlines must be turned into literal `\n` and the entire public key file should be made into a single line.

In order to set up this project for development, you need to have `node.js` and `yarn` installed on your system.

1. Copy `.env.example` to `.evn` and adjust values according to your local setup.

2. Copy `.env.test.example` to `.env.test` and adjust values according to your local setup.

3. Get the dependencies:

```
$ yarn
```
4. To run the tests call:

```
$ yarn test
```
5. Run the web application:

```
$ yarn start
```


