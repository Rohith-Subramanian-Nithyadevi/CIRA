const replaceViteEnv = () => ({
  visitor: {
    MemberExpression(path) {
      const { node } = path;

      if (
        node.object?.type === 'MemberExpression' &&
        node.object.object?.type === 'MetaProperty' &&
        node.object.object.meta.name === 'import' &&
        node.object.object.property.name === 'meta' &&
        node.object.property?.type === 'Identifier' &&
        node.object.property.name === 'env' &&
        node.property?.type === 'Identifier'
      ) {
        path.replaceWithSourceString(`process.env.${node.property.name}`);
      }
    },
  },
});

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [replaceViteEnv],
};
