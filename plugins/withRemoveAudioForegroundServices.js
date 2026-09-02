const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withRemoveAudioForegroundServices(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure xmlns:tools exists
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (!androidManifest.application || !androidManifest.application[0]) {
      return config;
    }

    const application = androidManifest.application[0];
    if (!application.service) {
      application.service = [];
    }

    // Add tools:node="remove" for AudioControlsService and AudioRecordingService
    const servicesToRemove = [
      'expo.modules.audio.service.AudioControlsService',
      'expo.modules.audio.service.AudioRecordingService',
    ];

    for (const serviceName of servicesToRemove) {
      const exists = application.service.some(
        (s) => s.$ && s.$['android:name'] === serviceName
      );
      if (!exists) {
        application.service.push({
          $: {
            'android:name': serviceName,
            'tools:node': 'remove',
          },
        });
      } else {
        application.service = application.service.map((s) => {
          if (s.$ && s.$['android:name'] === serviceName) {
            return {
              $: {
                ...s.$,
                'tools:node': 'remove',
              },
            };
          }
          return s;
        });
      }
    }

    // Remove foreground service & recording permissions
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissionsToRemove = [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ];

    for (const perm of permissionsToRemove) {
      const exists = androidManifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === perm
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: {
            'android:name': perm,
            'tools:node': 'remove',
          },
        });
      } else {
        androidManifest['uses-permission'] = androidManifest['uses-permission'].map((p) => {
          if (p.$ && p.$['android:name'] === perm) {
            return {
              $: {
                ...p.$,
                'tools:node': 'remove',
              },
            };
          }
          return p;
        });
      }
    }

    return config;
  });
};
