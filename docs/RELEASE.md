# Releasing Trackseam to Google Play and the App Store

| | Android | iOS |
|---|---|---|
| App id | `com.trackseam.app` | `com.trackseam.app` |
| Version | `versionName 1.1.0`, `versionCode 10` in `frontend/android/app/build.gradle` | `MARKETING_VERSION 1.1.0` in the Xcode project; build number = CI run number |
| Built on | this PC, or the `Mobile release` GitHub Action | the `Mobile release` GitHub Action (macOS runner), no Mac needed |

Before every release, bump `versionCode` (Android) and `versionName` / `MARKETING_VERSION`
when the version changes. Play rejects a `versionCode` it has already seen.

---

## 0. After losing the old Mac: secure the accounts first

The stolen Mac may have had signed-in sessions and private keys on it.

**Apple**
1. appleid.apple.com → Devices: remove the stolen Mac. Change the Apple Account password.
2. icloud.com/find: mark the Mac as lost, or erase it.
3. developer.apple.com → Certificates, IDs & Profiles → Certificates: **revoke** every
   Apple Distribution / iOS Distribution and Development certificate that was created on that Mac.
   Revoking a distribution certificate does **not** remove your app from the App Store;
   it only stops new builds being signed with it.
4. App Store Connect → Users and Access → Integrations: revoke any App Store Connect API keys
   that were saved on the Mac.

**Google**
1. myaccount.google.com → Security → Your devices: sign the Mac out. Change the password.
2. Play Console → Users and permissions: check nobody unexpected has access.
3. Google Cloud console: if a Play service-account JSON key was on the Mac, delete that key.

---

## 1. Android: replace the lost upload key

Since 2021, Play apps are signed by Google ("Play App Signing"). The key you lost is
only the **upload key**, and Google can replace it.

1. Play Console → Trackseam → **Test and release → App integrity → Play app signing**.
   - If you see "Releases signed by Google Play": you're enrolled. Continue.
   - If the app is **not** enrolled and you lost the only signing key, Google cannot recover
     it. You would have to publish under a new package name. Very unlikely for this app.
2. Check whether the old key survived. `C:\Users\user\Downloads\upload-key.keystore`
   (created 17 Apr 2026, alias `my-key-alias`) may be it. If you know its password, compare:
   ```
   keytool -list -v -keystore C:\Users\user\Downloads\upload-key.keystore
   ```
   If its SHA-1 equals the **Upload key certificate** SHA-1 on the App integrity page,
   you don't need a reset. Put it in `keystore.properties` and skip to step 4.
3. Otherwise, request an upload key reset. A new key has already been generated:
   - Keystore: `C:\Users\user\trackseam-keys\trackseam-upload.jks` (alias `upload`)
   - Passwords: `C:\Users\user\trackseam-keys\keystore.properties.backup`
   - Certificate for Google: `C:\Users\user\trackseam-keys\upload_certificate.pem`
     (SHA-1 `3F:E6:1D:B6:70:72:2E:FB:EB:4F:08:B6:78:F2:39:39:32:2D:22:F0`)

   On the App integrity page choose **Request upload key reset**. Pick "I lost my upload key"
   and upload `upload_certificate.pem`. Only the account owner can do this. Google emails
   when it's approved, usually within a couple of days, and says from what date the new
   key works. Uploads signed with the new key are rejected until then.
4. **Back up the keystore and its passwords off this PC now** (password manager plus an
   encrypted cloud copy). This is what was lost last time.

### Build the release bundle on this PC

Requires JDK 21 (Android Studio's bundled JDK 17 is too old for Capacitor 8; install
Temurin 21 or point `JAVA_HOME` at one) and Node 22.

```powershell
cd frontend
npm ci
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
`android/keystore.properties` (gitignored) already points at the new keystore.

### Upload

Play Console → Trackseam → Test and release → **Production** (or Internal testing first)
→ Create new release → upload the `.aab` → release notes → Review → Roll out.

---

## 2. iOS: build and upload without a Mac

iOS apps aren't tied to a signing key you can lose. Any valid distribution certificate
for your team can sign the next build. The GitHub workflow builds on GitHub's Macs and
uses an App Store Connect API key so Xcode creates the certificate and profile itself.

### One-time setup

1. **Bundle ID.** developer.apple.com → Identifiers: make sure `com.trackseam.app` exists.
   If the existing App Store app uses a different bundle ID, change `PRODUCT_BUNDLE_IDENTIFIER`
   in `frontend/ios/App/App.xcodeproj/project.pbxproj` (2 places) and `appId` in
   `frontend/capacitor.config.json` to match it.
2. **App record.** App Store Connect → Apps: the Trackseam app must exist with that bundle ID
   (create it with **+** → New App if not).
3. **API key.** App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → **Generate**. Role **Admin**: needed so Xcode may create the cloud-managed
   distribution certificate. Download the `.p8` (only downloadable once). Note the **Key ID**
   and the **Issuer ID** shown above the table.
4. **Team ID.** developer.apple.com → Account → Membership details → Team ID.
5. **GitHub secrets.** github.com/Mmezirim/trackseam → Settings → Secrets and variables →
   Actions → New repository secret:

   | Secret | Value |
   |---|---|
   | `ASC_KEY_ID` | Key ID from step 3 |
   | `ASC_ISSUER_ID` | Issuer ID from step 3 |
   | `ASC_KEY_P8` | full contents of the `.p8` file, including the BEGIN/END lines |
   | `APPLE_TEAM_ID` | Team ID from step 4 |

   For the Android job also add `ANDROID_KEYSTORE_BASE64` (the output of
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\user\trackseam-keys\trackseam-upload.jks"))`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` (both from
   `keystore.properties.backup`) and `ANDROID_KEY_ALIAS` = `upload`.

### Each release

1. Commit and push to GitHub.
2. GitHub → Actions → **Mobile release** → Run workflow → platform `ios` (or `both`).
3. When it finishes (about 15 minutes), the build appears in App Store Connect → TestFlight
   after Apple's processing (10–30 minutes).
4. App Store Connect → Trackseam → the new version → **Build**: select it → fill in the
   listing (see `STORE_LISTING.md`) → **Add for Review**.

If the archive step fails with a signing error, the API key is usually not Admin, or the
bundle ID / app record from steps 1–2 doesn't exist yet.

### Testing on your iPhone (Windows only, no Mac)

- **The real iOS build: TestFlight.** Install the TestFlight app on the iPhone. In App Store
  Connect → Trackseam → TestFlight → Internal Testing, create a group and add your own
  Apple ID. Every build the workflow uploads then appears in TestFlight on the phone,
  usually within half an hour. No review is needed for internal testers.
- **Quick UI checks while developing:** run `npm run dev -- --host` in `frontend/`, then
  open `http://<this-PC's-IP>:3002` in Safari on the iPhone (same Wi-Fi). It's the same UI,
  but native features (PDF share sheet, status bar) only work in the TestFlight build.
- **Build minutes:** GitHub's macOS runners are free for public repositories. For a private
  repo, the free plan's 2,000 minutes count 10× on macOS, so about 200 Mac minutes or
  ~12 iOS builds a month.
- **If you ever need Xcode itself** (for example to debug a crash), rent a cloud Mac by the
  hour (MacinCloud, AWS EC2 Mac) and open `frontend/ios/App/App.xcodeproj` there. Codemagic
  (500 free macOS minutes a month) is an alternative to the GitHub workflow.

---

## 3. Publishing the policy pages to trackseam.com

The store listings and the app link to `https://trackseam.com/privacy`, `/terms`,
`/support` and `/delete-account`. The pages live in `website/` and are generated from
`backend/public/`, the same files the API serves:

```powershell
cd backend
npm run build:website      # regenerates ../website
```

Upload to Hostinger: hPanel → Websites → trackseam.com → **File Manager** → `public_html`.
Upload the folders `privacy`, `terms`, `support`, `delete-account`, `reset-password` and
`legal-assets` from `website/` as they are. Don't delete anything already in `public_html`,
because the existing home page is in there. Then open https://trackseam.com/privacy to check.

Re-run `build:website` and re-upload whenever you change a policy. Update the
"Effective" date at the top of `backend/public/pages/privacy.html` / `terms.html` when you do.

---

## 4. Before you submit: checklist

- [ ] Policy pages uploaded and loading at https://trackseam.com/privacy, /terms, /support, /delete-account

- [ ] Backend deployed with the MySQL `DATABASE_URL` and `npx prisma migrate deploy` in the build command
- [ ] `npm run migrate:mongo` re-run after the deploy to pick up last-minute sign-ups
- [ ] `contact@trackseam.com` receives mail (it's on every policy page). Set `LEGAL_ENTITY`
      and `GOVERNING_LAW` if the defaults ("Trackseam", Nigeria) are wrong, in Render and
      before running `build:website`
- [ ] Rotate the Aiven `avnadmin` password (Aiven console → service → Users) and update
      `DATABASE_URL` locally and on Render, because the current one has been pasted into chats
- [ ] Reviewer demo account created and filled with a couple of sample clients (see `STORE_LISTING.md`)
- [ ] Test on a real phone: sign up, add client, add measurement, export PDF (share sheet opens),
      forgot password email arrives, delete account
