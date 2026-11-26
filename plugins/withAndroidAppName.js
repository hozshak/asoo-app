// Android-App heißt „ToLobby“ (expo.name ist noch „Asoo“ – das zu ändern würde das iOS-Projekt umbenennen)
const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

module.exports = function withAndroidAppName(config, name = 'ToLobby') {
  return withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem([{ $: { name: 'app_name' }, _: name }], c.modResults);
    return c;
  });
};
