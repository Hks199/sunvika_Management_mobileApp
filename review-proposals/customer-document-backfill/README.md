# Proposed existing-customer document review migration

This is a proposal only; it is not connected to startup and has not been run.
It would identify existing customers with documents uploaded by a channel partner
who is either the customer creator or currently assigned to the source lead. It
would associate the customer with that channel partner and require the four
standard documents, plus the geotag photo if one already exists, to be verified.

Effect: existing customers whose current required documents are not all verified
would be hidden from MIS and could enter the RM review or CP hold queues. The
channel partner's current reporting RM would become the reviewer. Existing file
versions and remarks would remain intact. Customers with no matching CP upload
would not be enrolled. The proposed code needs migration-specific tests and a
controlled production rollout before use.
