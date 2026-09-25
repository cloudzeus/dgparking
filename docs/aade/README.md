# Ψηφιακό Πελατολόγιο ΑΑΔΕ — υλικό αναφοράς

Τα επίσημα XSD (`DCL_v1_1.zip`, Ιούνιος 2025). Κρατιούνται εδώ γιατί **η
τεκμηρίωση PDF δεν αναφέρει τα namespace** — μόνο τα διαγράμματα δείχνουν τα
προθέματα, και τα προθέματα δεν αρκούν.

## Τα namespace, και η παγίδα τους

| Σχήμα | Ρίζα | Namespace |
|---|---|---|
| `SendClient` | `NewDigitalClientDoc` | `http://www.aade.gr/myDATA/dcrnew/v1.0` |
| `UpdateClient` | `UpdateClientDoc` | `https://www.aade.gr/myDATA/dcrudt/v1.0` |
| `ClientCorrelations` | `ClientCorrelationDoc` | `http://www.aade.gr/myDATA/dcrudtcor/v1.0` |
| `RequestClients` | `RequestedDoc` | `http://www.aade.gr/myDATA/dcr/v1.0` |

**Το `dcrudt` είναι `https`. Όλα τα υπόλοιπα είναι `http`.** Δεν είναι δικό
μας λάθος αντιγραφής — έτσι είναι γραμμένο στο `updateClient-v1.1.xsd`. Λάθος
πρωτόκολλο δίνει σφάλμα 101 «Could not find schema information», που μοιάζει
με σφάλμα σύνταξης XML ενώ είναι σφάλμα δήλωσης namespace.

## Πεδία απάντησης (`response-v1.1.xsd`)

Τα αναγνωριστικά ΔΕΝ λέγονται όπως στο αίτημα:

| Μέθοδος | Πεδίο απάντησης |
|---|---|
| SendClient | `newClientDclID` |
| UpdateClient | `updatedClientDclID` |
| CancelClient | `cancellationID` |
| ClientCorrelations | `correlateId` |

Τα επιχειρησιακά σφάλματα έρχονται με **HTTP 200** και `statusCode` διάφορο
του `Success`. Έλεγχος μόνο του status code δείχνει επιτυχία σε αποτυχία.
