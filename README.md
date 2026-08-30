# Tyre Inventory

A mobile app (iOS + Android) for managing tyre shop inventory. Fully offline:
all data — tyre records and photos — lives on the device itself, in a local
SQLite database and the app's own file storage. There is no server and no
network dependency of any kind.

- `mobile/` — React Native (Expo) app; this is the whole product now
- `backend/` — a Node/Express/PostgreSQL API from an earlier version of this
  project. **Not used by the app anymore** — kept in the repo but inert. See
  [Why there's an unused `backend/` folder](#why-theres-an-unused-backend-folder).

## Mobile setup

```bash
cd mobile
npm install

npm start
```

**Running under WSL2?** Use `npm start` — it detects WSL automatically and
forwards the port Expo Go needs to load the app. See
[mobile/scripts/README_WSL_TESTING.md](mobile/scripts/README_WSL_TESTING.md).
(That guide predates this app going fully offline — ignore anything in it
about forwarding port 4000 or a backend; only the Expo/Metro port matters now.)

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code with Expo Go on a physical device.

On first launch, the app asks you to set an admin password — there's no
default login. That password (hashed, never stored in plain text) is what
gates the app on this device from then on.

## Data & storage

- **Tyre records** live in a SQLite database local to the app
  (`src/db/database.ts`, `src/db/tyreRepository.ts`), created automatically
  on first launch. There's nothing to install or configure.
- **Photos** are copied into the app's own private storage on first pick
  (`src/storage/images.ts`) and referenced by a local file path — no upload
  step, works with the camera disabled/offline.
- **Login** is a password set once on-device (`src/auth/localAuth.ts`),
  hashed and stored via `expo-secure-store`. There's no account system and
  no password recovery — if you forget it, the fix is uninstalling and
  reinstalling the app (which clears its data, including the tyre catalog).
- **Nothing syncs between devices.** Each install of the app has its own,
  independent tyre catalog. If you need multiple people/devices sharing one
  catalog, that's a different architecture (a real backend) — see the note
  below.

## Tyre photos

Each tyre can carry one photo, taken with the camera or picked from the
library. Thumbnails show in the list; the full image shows in the add/edit
form. Picking a photo copies it into the app's storage immediately; the old
photo is only deleted once the form is actually saved, so backing out of an
edit never loses the original photo.

## Stock adjustments

Quantity is the field that changes most, so the list screen has inline `−`/`+`
steppers — no need to open the edit form. Each tap runs a single guarded SQL
update (`tyreRepository.adjustQuantity`) that increments the quantity and, on
a decrement, refuses to push it below zero in the same statement — so there's
no window where a read-then-write race could oversell. An oversell attempt
shows an alert with the true current quantity.

## Why there's an unused `backend/` folder

This project originally ran on a Node/Express API with a PostgreSQL database
(deployed on Railway). It was replaced with fully on-device storage so the
app works without any network connection or hosting costs. The backend code
is left in the repo in case a future "sync across devices" feature is wanted
— that would mean reviving it as a sync target, not rebuilding it from
scratch — but nothing in `mobile/` calls it today.

## Troubleshooting

### Mobile App Bundling Issues

This project targets **Expo SDK 57**. Don't hand-pin package versions from
older SDKs (e.g. SDK 50's `react-native@0.73.6`, `expo-secure-store@~12.8.1`)
— mixing SDK generations is a common cause of the app hanging on a loading
screen or Metro throwing `Unable to resolve` errors, because the native
module versions no longer match the Expo runtime.

If you hit bundling errors or an endless loading screen, first check you're
not on a mismatched set of versions, then let Expo's own tooling fix it:

```bash
cd mobile
npx expo install --check   # detects and offers to fix SDK-incompatible versions
npx expo-doctor             # should report 21/21 (or current total) checks passing
```

If that doesn't resolve it, do a clean reinstall rather than downgrading:

```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo-doctor
```

### "Project is incompatible with this version of Expo Go"

Expo Go ships one build per SDK, so the app on your phone must match the SDK
this project targets (57). Update Expo Go from the App Store / Play Store — SDK
57 needs Expo Go **57.0.9 or newer**.

To check which Expo Go version any SDK requires:

```bash
curl -s https://api.expo.dev/v2/versions/latest \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['sdkVersions']['57.0.0']; print(d['iosClientVersion'], d['androidClientVersion'])"
```

If the store won't offer you a new enough Expo Go (usually because the phone's
OS is too old), build a development build instead — `eas.json` already has a
`preview` profile that produces an installable APK:

```bash
cd mobile
npx eas build --profile preview --platform android
```

### "Network error" on a physical phone

Almost always one of these, in order of likelihood:

1. **Expo is advertising an address the phone can't reach.** Under WSL2, plain
   `expo start` falls back to `127.0.0.1`. Use `npm start` and check the
   advertised host is your LAN IP.
2. **Stale port forwarding.** The WSL IP changes on restart, so previously
   working `netsh portproxy` rules point at nothing. `npm start` warns
   when it detects this.
3. **The phone is on a different network** than the dev machine — a guest SSID
   or separate band with client isolation.

Full walkthrough: [mobile/scripts/README_WSL_TESTING.md](mobile/scripts/README_WSL_TESTING.md)

### Web Testing

If you cannot connect via Expo Go due to network issues, test the app in your browser:

```bash
cd mobile
npm start
# Then open http://localhost:8081 in your browser
```

The web version works perfectly and can be used to test all app features before deploying to physical devices.
