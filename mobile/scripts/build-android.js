// Builds the signed release APK locally:  npm run build:android
// Everything the build writes goes to D: (SDK copy, Gradle cache, temp, npm/Expo caches); C: is only read.
// Needs: the SDK copy at D:\Android\Sdk, the release key, and its four SAFEFLOW_RELEASE_* entries in
// D:\safeflow-build\gradle-home\gradle.properties (see README: Install on Android).
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Native builds run in a short mirror of mobile/: with "D:\Hackathon AI\mobile" some generated C++ object paths
// exceed Windows' 260-character limit for ninja. The APK is copied back to mobile/release/.
const WORK = 'D:\\sf';
// 64-bit ARM only: every current Android phone. x86_64 emulator images (Android 11+) run it via ARM translation.
// (An x86_64 build of react-native-gesture-handler also hits a Windows path-length failure.)
const ABIS = 'arm64-v8a';
const BUILD = 'D:\\safeflow-build';
const SDK = 'D:\\Android\\Sdk';
const JDK = 'C:\\Program Files\\Android\\Android Studio\\jbr'; // read-only
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://iasi-safeflow-api.onrender.com';

function fail(msg) {
  console.error(`\nbuild-android: ${msg}`);
  process.exit(1);
}

if (!/^https:\/\//.test(API_URL)) fail(`EXPO_PUBLIC_API_URL must be https:// (got ${API_URL}).`);
if (!fs.existsSync(path.join(SDK, 'platforms'))) fail(`Android SDK not found at ${SDK}.`);
if (!fs.existsSync(path.join(JDK, 'bin', 'java.exe'))) fail(`Android Studio JDK not found at ${JDK}.`);

const dirs = {
  GRADLE_USER_HOME: path.join(BUILD, 'gradle-home'),
  TEMP: path.join(BUILD, 'tmp'),
  ANDROID_USER_HOME: path.join(BUILD, 'android-user'),
  npm_config_cache: path.join(BUILD, 'npm-cache'),
  __UNSAFE_EXPO_HOME_DIRECTORY: path.join(BUILD, 'expo-home'),
};
Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const env = {
  ...process.env,
  ...dirs,
  TMP: dirs.TEMP,
  ANDROID_AVD_HOME: path.join(dirs.ANDROID_USER_HOME, 'avd'),
  ANDROID_HOME: SDK,
  ANDROID_SDK_ROOT: SDK,
  JAVA_HOME: JDK,
  PATH: `${path.join(JDK, 'bin')};${path.join(SDK, 'platform-tools')};${process.env.PATH}`,
  EXPO_PUBLIC_API_URL: API_URL,
  NODE_ENV: 'production',
};
for (const key of ['GRADLE_USER_HOME', 'TEMP', 'TMP', 'ANDROID_HOME', 'ANDROID_USER_HOME', 'npm_config_cache']) {
  if (!/^D:/i.test(env[key])) fail(`${key} must be on D: (got ${env[key]}).`);
}

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: true });

// Mirror sources to the short folder. Generated/build folders are excluded and left alone in the mirror.
// Full paths, so only mobile's own folders are excluded (not every library's android/ in node_modules).
// Native build output inside node_modules (android/build, .cxx) is never copied: it belongs to whichever folder
// built it, and CMake caches it with absolute paths.
// Packages under <base>/node_modules that have an android/ folder.
function libraryBuildDirs(base) {
  const nm = path.join(base, 'node_modules');
  const pkgs = fs.readdirSync(nm).flatMap((name) =>
    name.startsWith('@') ? fs.readdirSync(path.join(nm, name)).map((sub) => path.join(nm, name, sub)) : [path.join(nm, name)],
  );
  return pkgs.filter((p) => fs.existsSync(path.join(p, 'android')));
}
const excluded = [
  ...['android', 'release', 'dist', '.expo'].map((d) => path.join(ROOT, d)),
  ...libraryBuildDirs(ROOT)
    .map((p) => path.join(p, 'android', 'build'))
    .filter((d) => fs.existsSync(d)),
  '.cxx',
];
const sync = spawnSync('robocopy', [ROOT, WORK, '/MIR', '/XD', ...excluded, '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' });
if (sync.status === null || sync.status >= 8) fail(`robocopy to ${WORK} failed (exit ${sync.status}).`);

// Prebuild regenerates android/ from app.json (it also rewrites package.json scripts, but only in the mirror).
run('npx', ['expo', 'prebuild', '-p', 'android', '--clean', '--no-install'], WORK);

// Clear the libraries' native build output left in the mirror by the previous build. Every build recompiles it
// anyway (prebuild --clean), and Gradle's own cleanup of it fails on Windows when a file is still briefly held
// (e.g. by antivirus scanning the new .so files): "Unable to delete directory ...". rmSync retries those cases.
for (const dir of libraryBuildDirs(WORK)) {
  for (const sub of ['build', '.cxx']) {
    fs.rmSync(path.join(dir, 'android', sub), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}

const androidDir = path.join(WORK, 'android');
// Legacy packaging extracts native libraries at install time; loading them straight from the APK fails under the
// emulator's ARM translation and on some devices.
run(`"${path.join(androidDir, 'gradlew.bat')}"`, ['assembleRelease', '--no-daemon', `-PreactNativeArchitectures=${ABIS}`, '-Pexpo.useLegacyPackaging=true'], androidDir);

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version;
const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apk)) fail(`APK not found at ${apk}.`);
const outDir = path.join(ROOT, 'release');
fs.mkdirSync(outDir, { recursive: true });
// Versioned copy for your records, plus the stable name the web app links to (releases/latest/download/...).
for (const name of [`iasi-safeflow-${version}.apk`, 'iasi-safeflow.apk']) fs.copyFileSync(apk, path.join(outDir, name));
console.log(`\nAPK ready: ${path.join(outDir, `iasi-safeflow-${version}.apk`)} (API: ${API_URL}, ABIs: ${ABIS})`);
