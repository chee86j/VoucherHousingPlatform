# Phase 8 Private Document Access

Phase 8 adds a narrow, server-mediated document byte-read endpoint while keeping Phase 7 uploads quarantined by default.

## Included

- `GET /api/documents/:id/content` requires the authenticated server-side user context; it does not accept organization or user identifiers from the browser.
- Organization-scoped lookup returns `404` for a document outside the caller's organization.
- Only `ADMIN`, `BROKER`, `ASSISTANT`, and read-only `AUDITOR` roles may use the endpoint. The endpoint has a five-per-minute per-client rate limit.
- Download is eligible only when the document is both `VERIFIED` and `STORED_AVAILABLE`, and its key is in the organization-specific `available/` namespace.
- Quarantined, metadata-only, unverified, rejected, expired, missing, or malformed-storage documents are never returned. A same-organization denial receives `409` and records a document event.
- Successful reads return an attachment with the recorded MIME type and `Cache-Control: private, no-store, max-age=0`.
- A `DocumentEvent` is written before bytes are released (`DOWNLOADED`); denied and storage-failure attempts have separate event actions. The request-level hash-chained audit interceptor also records `DOCUMENT_DOWNLOADED`.
- `PrivateDocumentStorage` is an adapter boundary. The current local adapter preserves Phase 7's 0700/0600 quarantine behavior and refuses to read quarantine keys through the available-byte method.

## Deliberately not included

- No AV or malware scanning is claimed or implemented.
- No endpoint promotes a file from quarantine to available storage. A future trusted scanning/promotion workflow must atomically copy/move a verified object into the `orgId/available/` namespace and set `STORED_AVAILABLE`.
- No S3 credentials, bucket configuration, signed URLs, object lifecycle, encryption-key management, retention, or deletion implementation is included. A production adapter must implement `PrivateDocumentStorage` against a private S3-compatible bucket using server-held credentials and preserve the same org/key and availability checks.
- This direct byte-read endpoint is intentionally not a presigned URL implementation. Future signed-download support must re-authorize server-side before minting, cap expiry at five minutes, scope the object key exactly, and audit issuance.

## Operational constraints

The local filesystem adapter remains development/test-only. Do not deploy it as production object storage. Do not mark a document `STORED_AVAILABLE` until a real scanning/promotion policy, scanner failure handling, storage encryption, lifecycle policy, and production security review are in place.
