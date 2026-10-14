# Phase 6 Documents & Admin Limits

Phase 6 adds the first document-control slice without pretending binary file handling is production-ready.

## Included in this branch

- Document metadata registration for existing clients/cases/checklist items.
- Supported content types limited to PDF, JPEG, and PNG.
- Size cap: 15 MB.
- Required SHA-256 digest per registered document; duplicate digests are blocked per organization.
- Review workflow: `UPLOADED`/`UNDER_REVIEW` → `VERIFIED` or `REJECTED`.
- Checklist state updates when a linked document is verified or rejected.
- Actor-attributed `DocumentEvent` history written in the same transaction as document mutations.
- Auditor/staff metadata reads; no document bytes or signed URLs are exposed by these endpoints.

## Deliberately not included yet

- Browser file upload UI.
- Private object-storage integration.
- Antivirus/malware scanning.
- Signed URL minting and audited document reads/downloads.
- Encryption/key-management implementation for document bytes.
- Admin template editor UI.
- Notifications/SMS/email dispatch.

## Security posture

This branch is a metadata/review foundation only. It should not be used with real client documents until storage, AV scanning, signed URL auditing, retention policy, and database-backed authorization tests are complete.
