# Tyre Inventory

A mobile app (iOS + Android) for managing tyre shop inventory. Admin logs in
and has full create/edit/update/delete access over the tyre catalog.

- `backend/` — Node.js + Express + TypeScript API, PostgreSQL via Prisma
- `mobile/` — React Native (Expo) app

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

npx prisma migrate dev   # creates the database schema
npm run seed              # creates the initial admin user from .env

npm run dev                # starts the API on http://localhost:4000
```

## Mobile setup

```bash
cd mobile
npm install

npm start
```

The app derives its API base URL from the host it was served from, so it
follows the Expo dev server automatically. Override it only when pointing at a
different backend, via `EXPO_PUBLIC_API_URL` or `expo.extra.API_BASE_URL`.

**Running under WSL2?** Use `npm start` — it detects WSL automatically. See
[mobile/scripts/README_WSL_TESTING.md](mobile/scripts/README_WSL_TESTING.md) —
plain `expo start` advertises `127.0.0.1` there, which shows up as a "Network
error" on the phone.

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code with Expo Go on a physical device.

## Tyre photos

Each tyre can carry one photo, taken with the camera or picked from the library.
Thumbnails show in the list; the full image shows in the add/edit form.

Uploading is a separate step from saving the tyre:

```
POST  /uploads              multipart, field name "image"  ->  { "url": "/uploads/<uuid>.jpg" }
PUT   /tyres/:id            { "imageUrl": "/uploads/<uuid>.jpg" }
```

- Files land in `backend/uploads/` (override with `UPLOAD_DIR`). Everything that
  knows where images live is in `backend/src/lib/storage.ts`, so moving to S3 or
  Cloudinary means reimplementing that one module.
- JPEG/PNG/WebP only, 5MB max. Filenames are random UUIDs, so a client-supplied
  name never touches the filesystem and a URL isn't guessable from a SKU.
- The database stores a **relative** path, not an absolute URL, so records stay
  valid when the dev machine's IP changes. The app resolves it against its
  current API host.
- `imageUrl` on a tyre is validated against the `/uploads/<uuid>.<ext>` shape, so
  a record cannot be pointed at an arbitrary remote URL.
- Replacing or deleting a tyre's image deletes the old file.

Images are served unauthenticated so `<Image>` can load them without carrying a
token. If the catalogue ever needs to be private, that's the thing to change.

### Known gap: orphaned uploads

A photo uploads as soon as it's picked, so abandoning the form before saving
leaves an unreferenced file in `backend/uploads/`. Harmless, but it accumulates.
A periodic sweep comparing the directory against `Tyre.imageUrl` would clear it.

## Stock adjustments

Quantity is the field that changes most, so the list screen has inline `−`/`+`
steppers — no need to open the edit form. They post to a dedicated endpoint:

```
PATCH /tyres/:id/quantity   { "delta": -1 }
```

The delta is applied by the database (`increment`, with a `gte` guard on
decrements), not read-modify-write, so simultaneous adjustments from two phones
cannot clobber each other or push stock below zero. An oversell returns `409`
with the true current quantity, which the app uses to correct itself.

Taps are coalesced client-side for ~600ms, so tapping `+` ten times sends one
request for `+10` rather than ten requests.

## Roles

Only an `ADMIN` role exists today. There is no public sign-up endpoint — the
seed script is the only way to create an account, which keeps account
creation off the API's attack surface. The backend's `requireAdmin`
middleware is structured so additional, lower-privilege roles can be added
later without changing the auth flow.

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
