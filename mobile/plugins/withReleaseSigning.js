// Expo config plugin: sign release builds with the SafeFlow release key instead of the template's debug key.
// The key path and passwords are read from Gradle properties (D:\safeflow-build\gradle-home\gradle.properties,
// outside the repo). A release build without them fails rather than silently using the debug key.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// SafeFlow release signing (plugins/withReleaseSigning.js)';

const RELEASE_CONFIG = `
        ${MARKER}
        release {
            if (project.hasProperty('SAFEFLOW_RELEASE_STORE_FILE')) {
                storeFile file(project.property('SAFEFLOW_RELEASE_STORE_FILE'))
                storePassword project.property('SAFEFLOW_RELEASE_STORE_PASSWORD')
                keyAlias project.property('SAFEFLOW_RELEASE_KEY_ALIAS')
                keyPassword project.property('SAFEFLOW_RELEASE_KEY_PASSWORD')
            }
        }`;

const GUARD = `
${MARKER}
gradle.taskGraph.whenReady { graph ->
    def releaseTask = graph.allTasks.any { it.project == project && it.name.toLowerCase().contains('release') }
    def keys = ['SAFEFLOW_RELEASE_STORE_FILE', 'SAFEFLOW_RELEASE_STORE_PASSWORD', 'SAFEFLOW_RELEASE_KEY_ALIAS', 'SAFEFLOW_RELEASE_KEY_PASSWORD']
    def missing = keys.findAll { !project.hasProperty(it) }
    if (releaseTask && !missing.isEmpty()) {
        throw new GradleException("Release signing is not configured (missing: \${missing.join(', ')}). See README: Install on Android.")
    }
}
`;

function applySigning(contents) {
  if (contents.includes(MARKER)) return contents;

  const withConfig = contents.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_CONFIG);
  // Only the release build type switches to the release key; debug builds keep the debug key.
  const withBuildType = withConfig.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release',
  );
  if (withConfig === contents || withBuildType === withConfig) {
    throw new Error('withReleaseSigning: android/app/build.gradle layout not recognised; update the plugin.');
  }
  return withBuildType + GUARD;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: expected a Groovy build.gradle.');
    }
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
