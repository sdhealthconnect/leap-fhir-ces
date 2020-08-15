# LEAP FHIR Proxy CES Demo
LEAP FHIR Proxy Consent Enforcement Point (CES) provides a demonstration of consent enforcement in FHIR transactions. The web application is implemented as a reverse proxy monitoring the incoming requests and outgoing response to/from a FHIR server. 

For every resource being released in the response, the CES pursues the following steps: 

- It identifies the client making the query to receive the resource based on the JWT token assumed to be provided by the client,
- It identifies the patient associated with the resource by navigating the related resources,
- It makes a query to the LEAP Consent Decision Service (CDS) to check whether releasing the resource to the client is permitted by the patient consent, and
- Removes the resource from the results if the patient consent does not permit its release to that client.




