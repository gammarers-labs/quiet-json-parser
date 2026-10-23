import { ProjenTypeScriptProject } from '@gammarers/projen-projects';
const project = new ProjenTypeScriptProject({
  name: 'quiet-json-parser',
  description:
    'Parse and stringify JSON safely by omitting prototype-pollution keys, with fallbacks and optional runtime validation.',
  repository: 'https://github.com/gammarers-labs/quiet-json-parser.git',
  releaseToNpm: true,
  devDeps: [
    '@gammarers/projen-projects@^0.3.0',
  ],
});
project.addPackageIgnore('/.devcontainer');
project.synth();