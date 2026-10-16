# Phase 7 Secure Document Storage Foundation

Phase 7 turns the Phase 6 metadata-only document path into a real private upload boundary without claiming production object-storage readiness.

## Included in this branch

- Authenticated multipart upload at `POST /api/documents/upload`.
- In-memory upload handling with a strict 15 MB request limit.
- MIME allowlist for PDF, JPEG, and PNG plus magic-byte validation.
- SHA-256 calculated from uploaded bytes rather than client-provided metadata.
- Organization-scoped, private quarantine storage keys.
- Filesystem permissions restricted to the service user (`0700` directories, `0600` files).
- Cleanup if database registration fails after quarantine storage succeeds.
- Existing organization authorization and document metadata event flow reused.

## Deliberately not included yet

- S3-compatible/private object-storage adapter and lifecycle policy.
- Antivirus or malware scanning before availability.
- Signed URL minting, download endpoints, and audited byte reads.
- Encryption/key-management implementation for document bytes.
- Retention, deletion, and quarantine review operations.

## Security posture

Uploaded bytes remain in quarantine and are not exposed by a download or signed-URL endpoint. The local filesystem adapter is a development/test storage implementation; it is not a production deployment recommendation until the remaining storage, scanning, access, retention, and security-gate work is complete.
