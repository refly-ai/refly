# HTTPS test certificates

These static P-256 certificates and openly published private keys are test fixtures only.
They expire in September 2126 and require no certificate tooling when tests run.

`server.crt` is signed by `ca.crt`, with DNS SANs for `public.fixture.example` and
`redirect.fixture.example`. `untrusted.crt` is self-signed with a matching SAN for
`public.fixture.example`; the test Agent trusts only `ca.crt`.

The HTTPS tests retain the original URL hostname, SNI and default TLS validation.
Their routing wrapper invokes the production socket lookup before replacing an
approved public DNS answer with the local fixture address. Rejected answers never
reach the local server. These fixtures use no public network or TLS bypass.
