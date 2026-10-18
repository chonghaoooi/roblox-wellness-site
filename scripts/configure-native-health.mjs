import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const appUrl = "https://2026-10-17-this-website-is-called-t.vercel.app";
const policy = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Step privacy</title></head><body><h1>Roblox step privacy</h1><p>This optional companion requests read-only Steps access. Only your daily total, date, source and sync time go to the site. Your username and step total are public on leaderboards. Raw samples and other health data stay on your phone. No health data is sold or used for advertising.</p><p>Turn off sync on the tracker page and revoke permission in your health settings to stop future reads. Delete existing counters in Recent logs.</p><p><a href="${appUrl}/health-privacy">Full step-data privacy details</a></p></body></html>`;
await writeFile("native/www/privacypolicy.html", policy);
const androidRoot = "native/android/app/src/main";
let manifest = await readFile(`${androidRoot}/AndroidManifest.xml`, "utf8");
manifest = manifest.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android">', '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">');
manifest = manifest.replace(/\s*<!-- HEALTH STEP PERMISSIONS -->[\s\S]*?<!-- END HEALTH STEP PERMISSIONS -->/g, "");
const pluginManifest = await readFile("node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml", "utf8");
const permissions = [...pluginManifest.matchAll(/<uses-permission\s+android:name="(android\.permission\.health\.[^"]+)"/g)].map(match => match[1]);
const removals = [...new Set(permissions)].filter(name => name !== "android.permission.health.READ_STEPS");
const scope = `\n    <!-- HEALTH STEP PERMISSIONS -->\n    <uses-permission android:name="android.permission.health.READ_STEPS" />\n${removals.map(name => `    <uses-permission android:name="${name}" tools:node="remove" />`).join("\n")}\n    <!-- END HEALTH STEP PERMISSIONS -->\n`;
manifest = manifest.replace("</manifest>", scope + "</manifest>");
await writeFile(`${androidRoot}/AndroidManifest.xml`, manifest);
let variables = await readFile("native/android/variables.gradle", "utf8");
variables = variables.replace(/minSdkVersion = \d+/, "minSdkVersion = 28");
await writeFile("native/android/variables.gradle", variables);
await mkdir(`${androidRoot}/assets/public`, { recursive: true });
await writeFile(`${androidRoot}/assets/public/privacypolicy.html`, policy);

const iosRoot = "native/ios/App/App";
let plist = await readFile(`${iosRoot}/Info.plist`, "utf8");
if (!plist.includes("NSHealthShareUsageDescription")) plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `<key>NSHealthShareUsageDescription</key><string>Read your daily step total to update the public fitness leaderboard when you choose to sync.</string>\n<key>NSHealthUpdateUsageDescription</key><string>This companion does not request permission to write health data.</string>\n</dict>\n</plist>`);
await writeFile(`${iosRoot}/Info.plist`, plist);
await writeFile(`${iosRoot}/App.entitlements`, '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.developer.healthkit</key><true/></dict></plist>\n');
const projectPath = "native/ios/App/App.xcodeproj/project.pbxproj";
let project = await readFile(projectPath, "utf8");
if (!project.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")) project = project.replaceAll("CODE_SIGN_STYLE = Automatic;", "CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
await writeFile(projectPath, project);
await mkdir(`${iosRoot}/public`, { recursive: true });
await writeFile(`${iosRoot}/public/privacypolicy.html`, policy);

// Use the supplied icon artwork, rather than leaving native template icons in the builds.
const icon = "public/assets/fat-to-fit-app.png";
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const folder = `${androidRoot}/res/mipmap-${density}`;
  await mkdir(folder, { recursive: true });
  for (const name of ["ic_launcher", "ic_launcher_round"]) await sharp(icon).resize(size, size).png().toFile(`${folder}/${name}.png`);
  await sharp("public/icons/roblox-maskable-512-v2.png").resize(Math.round(size * 2.25), Math.round(size * 2.25)).png().toFile(`${folder}/ic_launcher_foreground.png`);
}
const iosIconDir = `${iosRoot}/Assets.xcassets/AppIcon.appiconset`;
await sharp(icon).resize(1024, 1024).flatten({ background: "#ffffff" }).png().toFile(`${iosIconDir}/AppIcon-512@2x.png`);
console.log(`Native health setup complete: read-only Steps; ${removals.length} unrelated Android health permissions removed; iOS HealthKit enabled.`);
