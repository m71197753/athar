import { mkdir, rm, copyFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "android-studio");
const stage = path.join(root, "generated-artifacts", "android-export");
const stagedProject = path.join(stage, "AtharAndroid");
const outputDir = path.join(root, "artifacts/athar-students/public/generated-artifacts");
const archive = path.join(outputDir, "athar-android-studio.zip");

// Explicit source allow-list: never archive local SDK paths, build products,
// signing keys, .gradle caches, credentials, or unrelated workspace files.
const files = [
  "settings.gradle", "build.gradle", "gradle.properties", ".gitignore", "README.md",
  "gradlew", "gradlew.bat", "gradle/wrapper/gradle-wrapper.jar",
  "gradle/wrapper/gradle-wrapper.properties",
  "app/build.gradle", "app/src/main/AndroidManifest.xml",
  "app/src/main/res/values/strings.xml", "app/src/main/res/values/styles.xml",
  "app/src/main/res/drawable/athar_icon.png",
  "app/src/main/java/app/athar/students/MainActivity.java",
  "app/src/main/java/app/athar/students/SiteAddress.java",
  "app/src/test/java/app/athar/students/SiteAddressTest.java",
];
await rm(stage, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(stagedProject, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(source, file), target);
  if (file === "gradlew") await chmod(target, 0o755);
}
await mkdir(outputDir, { recursive: true });
await rm(archive, { force: true });
const result = spawnSync("zip", ["-qr", archive, "AtharAndroid"], { cwd: stage, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error("Android project packaging failed");
console.log(path.relative(root, archive));
