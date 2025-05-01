const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './src/renderer/assets/icon', // İkon dosyası (platform spesifik uzantılar otomatik eklenir)
    appCopyright: 'Copyright © 2025 Blu3Line',
    appVersion: '1.0.0',
    name: 'Yemekhane Yemek Tanıma Sistemi',
    executableName: 'yemekhane-tanima'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'yemekhane_electron_gui',
        authors: 'Blu3Line',
        description: 'Yapay zeka tabanlı yemek tanıma sistemi',
        iconUrl: 'https://example.com/icon.ico', // Uzak ikon URL'i (opsiyonel)
        setupIcon: './src/renderer/assets/icon.ico' // Windows kurulum ikonu
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './src/renderer/assets/icon.png', // Linux ikon dosyası
          categories: ['Utility', 'Education'],
          homepage: 'https://example.com',
          maintainer: 'Blu3Line'
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: './src/renderer/assets/icon.png', // Linux ikon dosyası
          categories: ['Utility', 'Education'],
          homepage: 'https://example.com'
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
