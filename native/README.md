# Native step-sync companion

The existing app remains a Next.js website/PWA. Automatic phone health access is implemented in this optional Capacitor companion: Apple HealthKit on iPhone and Android Health Connect (including Samsung Health sharing) on Samsung/Android. It loads the same HTTPS site and signs into the same account. It is not an APK or TestFlight build yet.

## Build preparation

From the repository root:

```sh
npm ci
npm run mobile:sync
```

The script copies the privacy policy, uses the existing app icon, adds the iOS HealthKit entitlement, and removes every Android health permission except READ_STEPS from the health plugin's merged manifest. It does not request access to other health data or write access.

## iPhone (on your Mac)

```sh
npx cap open ios
```

In Xcode select your signing team and confirm the HealthKit capability on the App target. Run on a physical iPhone, sign in, open Connect step tracker, and allow Steps. Use Xcode Archive and your Apple Developer account for TestFlight. The generated project uses Swift Package Manager. Native iOS compilation and signing require Xcode on a Mac; they were not run in this Windows workspace.

## Samsung/Android

Install Android Studio with SDK 36 and its JDK 21, then:

```sh
npx cap open android
```

Run on a physical Android 9+ device with Health Connect available. For Android 14+ it is built in; earlier supported devices may need Google's Health Connect app. Enable Samsung Health's Steps sharing into Health Connect, then grant this app read access. To create a debug APK, use Build → Build APK(s), or run `gradlew assembleDebug` in `native/android` with the Android SDK/JDK configured. The APK is under `app/build/outputs/apk/debug`. Review the merged manifest and confirm READ_STEPS is the only health permission before distributing.

## Behavior and limits

- Connect is explicit opt-in. Daily totals use the site's timezone. Native platform aggregation is used instead of adding watch/phone raw records.
- The server stores one counter per user, date and health source. Retries cannot add the total twice. It keeps the highest synced count of the day, matching the existing daily-stat rule. A health-app correction downward requires deleting that day's existing counter in Recent logs before resyncing.
- Sync runs on connection, on demand, on returning to the app, and every five minutes while visible. No background/closed-app sync is promised.
- Disconnect turns off reads on that device. Revoke permission in the phone health settings to revoke native access. Previously shared counters remain until removed in Recent logs or by an administrator.
- Native API access is permission-based, not server-side device attestation. A client-provided count is not cryptographic proof of a walk.
- The browser/PWA cannot use HealthKit or Health Connect. It shows setup guidance and retains screenshot logging.
- The companion does not add APNs/FCM native push. Keep the Home Screen PWA installed for the existing Web Push notifications. These are separate from health-store access.
- Physical health reads, permission denial/revocation and native builds must be tested on both phones before calling this ready to distribute. No fake health records are seeded.

## Sources

- https://developer.apple.com/documentation/healthkit
- https://developer.android.com/health-and-fitness/health-connect/features/steps
- https://developer.samsung.com/codelab/health/steps-data.html
- https://github.com/Cap-go/capacitor-health
- https://capacitorjs.com/docs
