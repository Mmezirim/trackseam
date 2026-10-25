# Trackseam store listing and compliance answers

The policy pages are the static files in `website/`, uploaded to trackseam.com
(see docs/RELEASE.md, "Publishing the policy pages"). They must be live before you submit.

## Links (both stores)

| Field | URL |
|---|---|
| Privacy policy | https://trackseam.com/privacy |
| Terms of use / EULA | https://trackseam.com/terms |
| Support / marketing URL | https://trackseam.com/support |
| Account deletion (Play) | https://trackseam.com/delete-account |

## Graphics

| Asset | File |
|---|---|
| Play icon 512×512 | `frontend/resources/store/play-icon-512.png` |
| Play feature graphic 1024×500 | `frontend/resources/store/play-feature-graphic-1024x500.png` |
| App Store icon 1024×1024 | already in the Xcode project (`AppIcon`); copy at `frontend/resources/store/app-store-icon-1024.png` |
| Screenshots | still to take. Play: 2–8 phone screenshots. Apple: iPhone 6.9" (1320×2868 or 1290×2796), 1–10. Take them on a phone or simulator signed in to the demo account: client list, client detail, new measurement form, PDF export. |

## Listing copy

**App name:** Trackseam (Apple allows 30 characters, so `Trackseam: Client Measurements` also fits)

**Apple subtitle (30):** Measurement records for tailors

**Play short description (80):** Save client measurements, find any client fast, and export clean PDF sheets.

**Full description**

> Trackseam is a simple, professional record book for tailors, fashion designers and
> bespoke studios.
>
> Register each client once, then record their measurements for every outfit you make:
> shirts, trousers, dresses, suits, skirts, agbada, kaftan, or your own custom fields.
> Find any client in seconds by name, and export any measurement as a clean, branded
> PDF sheet you can print or send on WhatsApp or email.
>
> • Client registry with a short ID for every client
> • Ready-made measurement sheets for common outfits, plus fully custom fields
> • Every measurement dated, with notes for fabric and fitting preferences
> • Instant search by client name
> • PDF export with your shop name on every sheet
> • Your records sync to your account, so they're safe if you change phones
> • No ads
>
> Trackseam is free to use.

**Keywords (Apple, 100 chars):** tailor,measurement,sewing,fashion,designer,client,bespoke,fitting,dressmaker,record,agbada

**Category:** Business (secondary on Apple: Productivity)

**Price:** Free. No in-app purchases.

---

## Google Play: Data safety form

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (in-app, and the web URL above)

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | Required | Account management, App functionality |
| Personal info → **Name** (shop name, and client names the user enters) | Yes | No | Required | App functionality |
| Personal info → **Phone number** (client contact numbers) | Yes | No | Optional | App functionality |
| Personal info → **Other info** (client body measurements and notes) | Yes | No | Optional | App functionality |
| Personal info → **User IDs** (account id) | Yes | No | Required | Account management |

Everything else (location, financial, health, messages, photos, contacts, app activity,
device IDs, crash logs): **not collected**. The app has no analytics or ads SDKs.

Body measurements entered for tailoring are listed as "Other info", not "Health info".
They aren't health data under Google's definitions, but if a reviewer pushes back,
adding them under Health info is harmless.

## Google Play: other App content forms

- **Ads:** No ads
- **App access:** "All or some functionality is restricted" → give the demo account below
- **Content rating (IARC):** category Utility/Productivity. No violence, sexual content,
  profanity, drugs, gambling. Users do **not** interact or share content with each other.
  Expect "Everyone" / PEGI 3.
- **Target audience:** 18 and over
- **News app:** No. **COVID-19 contact tracing:** No. **Data safety:** as above.
- **Government app:** No. **Financial features:** None. **Health:** No health features.

## Apple: App Privacy ("nutrition label")

Data used to track you: **None.** Tracking: **No.**

| Category → Type | Linked to user | Used for |
|---|---|---|
| Contact Info → Name | Yes | App Functionality |
| Contact Info → Email Address | Yes | App Functionality |
| Contact Info → Phone Number | Yes | App Functionality |
| User Content → Other User Content (measurements, notes) | Yes | App Functionality |
| Identifiers → User ID | Yes | App Functionality |

## Apple: age rating questionnaire

Answer **None / No** to every content question. "Unrestricted web access": **No** (the
in-app browser only opens our own policy pages). User-generated content shared with other
users: **No**. Result: 4+.

## Apple: export compliance

Handled in `Info.plist` (`ITSAppUsesNonExemptEncryption = NO`). The app only uses HTTPS,
which is exempt, so App Store Connect won't ask on each build.

---

## Review notes (paste into App Review Information / Play app access)

Create or reset the demo account (login, password and 3 sample clients) with:

```
cd backend
node scripts/seed-reviewer.js <login> <password>
```

Re-run it before each review to restore the sample data. Keep the password out of this repo.

> Trackseam is a record book for tailors. Sign in with the demo account below to see sample
> clients and measurements.
>
> Email: <demo email>
> Password: <demo password>
>
> • Tap a client to see their measurements. Tap "↓ PDF" to export a measurement sheet
>   (opens the share sheet).
> • "+ New Client" and "+ Measurement" create records.
> • Account (top right) → Privacy Policy, Terms of Use, Support, Sign out, and
>   **Delete account**, which permanently deletes the account and all its data.
> • New users can register in the app. No payment or special hardware is required.

---

## TestFlight: external testing

App Store Connect → Trackseam → TestFlight. External testers (anyone with a link)
need a one-time **Beta App Review**, usually within a day. Internal testers (people on
your App Store Connect team) don't.

**Test Information** (TestFlight → Test Information, left sidebar):

| Field | Value |
|---|---|
| Beta App Description | Trackseam is a record book for tailors and fashion designers. Register clients, record their measurements for each outfit in inches or centimetres, and export clean PDF measurement sheets to print or share. |
| Feedback Email | contact@trackseam.com |
| Marketing URL | https://trackseam.com |
| Privacy Policy URL | https://trackseam.com/privacy |
| Beta App Review: contact | your name, phone, contact@trackseam.com |
| Sign-in required | Yes, with the demo account (same one as the App Review notes above) |
| Review notes | Use the demo account to see sample clients. Tap a client to view measurements; switch in/cm at the top of the list; "↓ PDF" opens the share sheet; Account (top-right circle) has settings, policies and Delete account. |

**What to Test** (per build, shown to testers):

> Thanks for testing Trackseam!
> • Register your shop (or sign in) and add a few real clients.
> • Add measurements for different outfit types. Inches is the default; switch to cm in the form or under Account → Default Measurement Unit.
> • Open a client and switch between in and cm. Export a PDF and share it to WhatsApp or save it to Files.
> • On iPhone, swipe in from the left edge to go back.
> • Try Account → Appearance → Dark.
> Report anything confusing or broken with a screenshot via TestFlight (screenshot → Share Beta Feedback) or contact@trackseam.com.

**Inviting testers:** TestFlight → External Testing → **+** → create a group (for example
"Tailors beta") → add the build → **Submit for Review**. Once approved, open the group,
turn on **Public Link**, and share that link; anyone with it can install via the
TestFlight app (you can cap the number of testers). Or add testers by email.
