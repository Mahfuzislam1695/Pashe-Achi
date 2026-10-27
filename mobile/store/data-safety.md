# Data safety answers (Google Play) and App privacy (App Store)

These answers follow what the app and the server actually do (see `/privacy` on the website). Review them before submitting; if the server's data handling changes, update this file and the Play Console together.

## Overview

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only; release builds refuse plain http) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: in the app (Profile → Delete account) and on the web, `https://kingfisherbd24.com/account-deletion` |
| Is any data shared with third parties? | **No.** The address lookup (OpenStreetMap Nominatim, through our server) and push delivery (Firebase Cloud Messaging) are service providers working for us, which Play does not count as sharing. Staff and riders are the developer. |
| Advertising / tracking | None: no ads, no advertising ID, no analytics SDK |

## Data types collected

For every type below:
- **Processed ephemerally:** No (each one is stored).
- **Required or optional:** as listed.
- **Shared:** No.

| Category → type | Collected | Required? | Purposes |
|---|---|---|---|
| Personal info → **Name** | Yes | Required | App functionality, Account management |
| Personal info → **Phone number** | Yes | Required | App functionality, Account management |
| Personal info → **Address** | Yes | Required (delivery addresses picked on the map, with house/flat/road) | App functionality |
| Location → **Precise location** | Yes | Required (the map pin of each address; the phone's location only when the customer taps "Current location") | App functionality |
| Location → **Approximate location** | Yes | Optional (when the phone gives only an approximate position) | App functionality |
| Financial info → **Purchase history** | Yes | Required (orders and their bills) | App functionality |
| Health and fitness → **Health info** | Yes | Optional (prescriptions and medicine lists, when ordering medicine) | App functionality |
| Photos and videos → **Photos** | Yes | Optional (prescription photos the customer chooses) | App functionality |
| Files and docs → **Files and docs** | Yes | Optional (prescription PDFs) | App functionality |
| App activity → **Other actions** | Yes | Required (the security log of account actions) | Fraud prevention, security, and compliance |
| Device or other IDs → **Device or other IDs** | Yes | Optional (the push-notification token, when notifications are on) | App functionality |

Not collected: email, contacts, calendar, messages, SMS, audio, app interactions or analytics, crash logs, web browsing, payment card details, other location history.

## Deletion and retention (for the privacy policy and reviewers)

**Deleted at once** when a customer deletes their account:
- name, mobile number and location
- sessions on every device
- push tokens
- notifications
- prescription files
- the addresses, map pins, phone numbers and notes on their past orders

**Kept, without identifying details:**
- past orders, as sales records (order number, service, lines, bill, dates)
- the security log of account actions, for fraud prevention

## App Store Connect (App privacy)

Data linked to the user, used for App Functionality only, not used for tracking:

- **Contact info:** Name, Phone Number, Physical Address
- **Location:** Precise Location, Coarse Location
- **Health & Fitness:** Health (prescriptions)
- **User Content:** Photos or Videos, Other User Content (prescription files)
- **Purchases:** Purchase History
- **Identifiers:** Device ID (push token)
