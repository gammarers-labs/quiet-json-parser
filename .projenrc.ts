import { ProjenTypeScriptProject } from '@gammarers/projen-projects';
const project = new ProjenTypeScriptProject({
  name: 'quiet-json-parser',
  repository: 'https://github.com/gammarers-labs/quiet-json-parser.git',
  releaseToNpm: true,
  devDeps: [
    '@gammarers/projen-projects@^0.3.0',
  ],
});
project.addPackageIgnore('/.devcontainer');
project.synth();