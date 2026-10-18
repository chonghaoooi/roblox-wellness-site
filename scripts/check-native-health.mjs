import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = await readFile("native/android/app/src/main/AndroidManifest.xml", "utf8");
const library = await readFile("node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml", "utf8");
const healthPermissions = [...library.matchAll(/<uses-permission\s+android:name="(android\.permission\.health\.[^"]+)"/g)].map(match => match[1]);
const removed = new Set([...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"\s+tools:node="remove"/g)].map(match => match[1]));
assert(!removed.has("android.permission.health.READ_STEPS"));
for (const permission of healthPermissions) if (permission !== "android.permission.health.READ_STEPS") assert(removed.has(permission), `Unnecessary health scope: ${permission}`);
const info = await readFile("native/ios/App/App/Info.plist", "utf8");
assert(info.includes("NSHealthShareUsageDescription"));
const entitlements = await readFile("native/ios/App/App/App.entitlements", "utf8");
assert(entitlements.includes("com.apple.developer.healthkit"));
const project = await readFile("native/ios/App/App.xcodeproj/project.pbxproj", "utf8");
assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g) || []).length, 2);
for (const path of ["native/www/privacypolicy.html", "native/android/app/src/main/assets/public/privacypolicy.html", "native/ios/App/App/public/privacypolicy.html"]) assert((await readFile(path, "utf8")).includes("daily total"));
console.log("Native configuration checks passed: read-only Steps, unrelated Android scopes removed, iOS entitlement and descriptions, privacy policy in both packages.");
