# Sunvika Management Mobile

React Native app for the Sunvika Management workspace. It uses Expo, TypeScript, and NativeWind, and calls the same versioned backend API as the web frontend.

## Installable Android builds

The app configuration references Expo project `96e83983-7411-497a-9b55-7d9e353c83f2`. Sign in to an Expo account with access to that project:

```sh
npx eas-cli@latest login
npx eas-cli@latest init --id 96e83983-7411-497a-9b55-7d9e353c83f2
```

Build an APK to install directly on staff Android phones:

```sh
npx eas-cli@latest build --platform android --profile preview
```

Build an Android App Bundle for Google Play:

```sh
npx eas-cli@latest build --platform android --profile production
```

The build profiles pin the public HTTPS API address. Local `.env` files are excluded from cloud build uploads. Installed release builds include the JavaScript bundle and run without Expo Go, Metro, or the development PC; the backend must remain online. Install and test the APK before sharing it. Keep the Android signing credentials for future updates.

After configuring the Play Console app and submission credentials, submit the production Android build:

```sh
npx eas-cli@latest submit --platform android --profile production
```

Phone push notifications still require FCM/APNs credentials; linking the Expo project alone does not finish push setup.

## Run locally

1. Install Node.js and the project dependencies:

   ```sh
   npm install
   ```

2. Set `EXPO_PUBLIC_API_URL` to the backend origin, including `/api/v1`. Copy `.env.example` to `.env` and adjust the address for your setup:

   - iOS simulator: `http://localhost:5000/api/v1`
   - Android emulator: `http://10.0.2.2:5000/api/v1`
   - Physical device: use the backend machine's LAN address, or the deployed API URL
   - Deployed backend: `https://sunvikamanagement.niakylie.com/api/v1`

3. Stop any previous Expo dev server, then start this app with a cleared Metro cache:

   ```sh
   npx expo start --clear
   ```

   Scan the QR code in Expo Go. This project now targets Expo SDK 58, so the installed Expo Go must also support SDK 58.

   To view the app in a laptop browser instead, run:

   ```sh
   npm run web
   ```

   Expo opens the app in your default browser. On the same laptop, `localhost` API URLs work as usual.

## Available workspace areas

Overview, leads, site visits, customers, quotations, AMC contracts, employees, geography, reports, roles and permissions, audit log, and active sessions are available from the mobile navigation.

Authentication uses the same `/auth/login`, `/auth/me`, `/auth/refresh-token`, `/auth/logout`, and password-recovery endpoints as the web app. The access token is stored with Expo SecureStore.

Opening a lead from the Leads list loads its full details and status history. The detail view supports lead edits, assignment, status changes with optional quotation generation, and conversion to a customer with the four required document uploads. Opening a site visit loads its full details, supports visit edits, and provides related visit history by lead or employee.

Leads, site visits, customers, and quotations all show a Filters section with cascading state/district/branch selectors, from/to dates, an employee/team filter for non-CP accounts, and Clear filters. Changing filters resets pagination. Leads and site visits retain filters across all/upcoming/overdue views. Search is available for customers and the All leads view; lead follow-up endpoints do not accept search parameters, so the search field is disabled in those views and its text is restored when returning to All leads.

Site visits mirrors the web frontend's all/upcoming/overdue views, cascading state/district/branch filters, date range, and employee/team filter (hidden for CP accounts). Visit cards show every field from the web table. New visits use a searchable lead selector and calendar/time pickers; editing uses the same date controls. Changing filters resets pagination, and Clear filters restores the unfiltered view. Browser previews keep access tokens in memory and refresh sessions using the backend cookie; native apps continue to use SecureStore.

Customers supports search and the same geography, date, and employee/team filters as the web frontend. Opening a customer fetches the full profile, source lead, documents, lead status history, visits, and customer activity. Customer edits validate contact and project fields before saving. Documents support image previews, PDF previews in the browser (or an external viewer on native devices), download links, verification, and uploads of PDF/JPEG/PNG/WebP files up to 20 MB using the backend's upload reservation and completion flow.

Quotations includes the web frontend's geography/date/team filters, full quotation details, expiring PDF download links, WhatsApp share preparation, and share history with masked recipient numbers. The authenticated PDF endpoint supports access-token refresh. On Android/iOS, Expo Sharing opens the device share menu with the PDF attachment; browser previews use file sharing when supported and offer a PDF download fallback. The WhatsApp chat-link fallback cannot pre-attach a PDF to a selected recipient. Share history records link creation, not confirmed delivery. If loading a prepared PDF fails, Retry PDF fetches the file without creating another share link.

Employees includes all-employees/downline views, every web list column, pagination totals from backend metadata, full employee details, profile-image refresh, reporting hierarchy, employee edits, manager changes, activation/deactivation, and invitation resends. Invitations use the backend's creatable-role list (excluding Admin Head roles), cascading geography selectors, optional branch placement, and optional JPEG/PNG/WebP profile images up to 10 MB. Profile images upload through authenticated API reservations and binary uploads before creation; retries after a failed employee creation reuse the completed image upload. Account actions run only when selected by the user, and backend permission errors are shown in the relevant form.

Geography mirrors the web page's states/districts/branches views, default parent selection, cascading filters, refresh, and add/edit forms. MD and MIS accounts see creation controls; the backend restricts edits to the Managing Director. Forms validate names, optional state codes, required branch codes, parent relationships, addresses, and active/inactive status. Creation forms keep parent selection separate from browsing and switch the list to the saved parent after success; edits retain the existing parent. Lists use the backend's active-location endpoints, and duplicate, permission, and parent-deactivation errors remain visible in the form for correction.

## Validation

```sh
npm run typecheck
npx expo install --check
```

## Android Expo Go connection troubleshooting

If Expo Go reports `java.io.IOException: Failed to download remote update`, the phone could not finish downloading the manifest, JavaScript bundle, or an asset. This message alone does not identify which request failed.

Stop the previous server with Ctrl+C, then run:

```sh
npm run start:go
```

This starts Expo Go mode with an explicit ngrok tunnel and clears Metro cache. Selecting ngrok avoids the signed-tunnel login requirement in this Expo CLI. Scan the newly generated QR code inside Expo Go; old LAN QR codes will still point to the old server. Keep this terminal running. The development-only `@expo/ngrok` dependency supplies Expo's tunnel helper.

The project targets Expo SDK 58. Install an Expo Go Android version that supports SDK 58: https://expo.dev/go?sdkVersion=58&platform=android&device=true

For LAN development instead, use `npm run start:lan`, connect the PC and phone to the same Wi-Fi, and check `http://<PC-WIFI-IP>:8081/status` in the phone browser. It should display `packager-status:running`. PC-local success does not prove the phone can access that address.

Tunnel mode requires internet on both devices and an available ngrok service. This addresses network reachability; it does not bypass SDK compatibility checks.


## Roles and reporting

The mobile app uses MIS (Management Information System) and CP Head (Channel Partner Head, code `CP_HEAD`) from the backend. MH (Marketing Head) is retired and hidden from role lists and invitations. The sales hierarchy is MD -> CP Head -> RM -> CP; MIS reports separately to MD. Only MD can invite CP Head accounts. Employee reporting chains and reporting-manager changes use backend hierarchy rules.


## CP candidate calling lists

More > CP calling lists is available to MD, MIS and RM. MD/MIS can upload one-sheet `.xlsx` workbooks up to 5 MB and assign any active RM. MIS manages its own uploads; MD manages all. RMs see only their assigned lists. Preview displays every uploaded column in a sideways-scrollable table with paginated candidate rows. Download Excel opens the original private S3 file using a 60-second download link. The assigned RM or MD can review a candidate, complete the required details and create a CP reporting to that RM. Backend S3 access to `calling-lists/*` is required; see `../sunvika_Management_Backend/docs/CALLING_LISTS.md`.

MD/MIS can choose Download blank Excel template in the upload card. On Android/iOS the file opens the device save/share sheet; on web it downloads directly. Fill candidate rows below the headers, save as .xlsx, then upload.


Customer details includes Convert to CP for MD, CP Head and RM. Review the invitation email and account details, select a permitted reporting RM, then confirm with OK, convert to CP. Existing customer data/history stays linked to the CP employee. Employee details provides Customer history. Password setup and login use the existing employee invitation flow; delivery failures can be retried with Resend invitation in Employees.


More > Channel Partners is a separate CP directory. Employees excludes CPs in all/downline views. Channel Partners shows permitted CP accounts with correct pagination, active/inactive status, reporting managers and existing employee/history/invitation actions. RMs can invite CP accounts from this page; Employees invitations omit the CP role.


## CP scheduled phone notifications

RM, CP Head and MD manage schedules from More -> CP notifications; MIS can view. CPs read messages through their bell. Native phone push is prepared but needs an Expo/EAS project ID and push credentials before use. Set `EXPO_PUBLIC_EAS_PROJECT_ID` for the build, configure FCM/APNs in the Expo project and install a new development or production build with the `expo-notifications` plugin. Expo Go cannot receive remote push. CPs enable phone notifications from their bell and grant OS permission. Without that setup, scheduled messages remain available in the bell inbox. See backend `CP_NOTIFICATIONS.md` for the full setup and delivery behavior.

## API configuration when the website moves to Vercel

Set `EXPO_PUBLIC_API_URL` to the absolute HTTPS backend address including `/api/v1` before building, for example `https://api.example.com/api/v1` (replace the domain). Use the same backend as the website's `VITE_API_URL`. Rebuild native apps after changing this value. A Vercel website deployment does not change or publish the native app automatically. Backend imports, allocation and scheduled notifications continue running on the persistent backend server.


### Local employee-detail development API

An ignored `.env.development.local` points Expo development to the same backend as the local web app, using this computer's Wi-Fi address on port 5000. Keep the phone and computer on the same Wi-Fi network and run `sunvika_Management_Backend_copy`. If the computer's IP address changes, update that local file and restart Expo.

Production exports use the public `EXPO_PUBLIC_API_URL` from `.env`; the development override is not loaded for production. The public backend must also receive the employee photo routes before production photo editing can work.
