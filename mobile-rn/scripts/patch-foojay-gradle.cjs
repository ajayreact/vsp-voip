/**
 * Gradle 9 removed JvmVendorSpec.IBM_SEMERU; RN 0.85 still pins foojay 0.5.0.
 * Bump to 1.0.0 so local `gradlew assembleRelease` works on Windows.
 */
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'settings.gradle.kts',
);

if (!fs.existsSync(settingsPath)) {
  process.exit(0);
}

const contents = fs.readFileSync(settingsPath, 'utf8');
const patched = contents.replace(
  'foojay-resolver-convention").version("0.5.0")',
  'foojay-resolver-convention").version("1.0.0")',
);

if (patched !== contents) {
  fs.writeFileSync(settingsPath, patched);
  console.log('patched @react-native/gradle-plugin foojay-resolver-convention -> 1.0.0');
}
