/**
 * Metro pour un exemple qui consomme la bibliothèque du dossier parent.
 *
 * Le SDK est une dépendance `file:..`, donc un LIEN SYMBOLIQUE dans
 * node_modules. Metro ne le suit pas seul : il faut lui déclarer le dossier
 * parent comme surveillé, sans quoi la résolution échoue et le paquet paraît
 * absent alors qu'il est là.
 *
 * `disableHierarchicalLookup` empêche Metro de remonter l'arborescence et de
 * trouver le `node_modules` du SDK : React y est présent en dépendance de
 * développement, et deux copies de React dans un même bundle produisent des
 * erreurs de hooks incompréhensibles. La résolution passe donc UNIQUEMENT par
 * le node_modules de l'exemple.
 */
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sdkRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sdkRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
