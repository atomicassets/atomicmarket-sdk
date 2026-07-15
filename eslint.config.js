const tseslint = require('typescript-eslint');

// Flat config for the fork's migration from TSLint, mirroring atomicassets-sdk.
module.exports = tseslint.config(
    {
        ignores: ['build/', 'dist/', 'node_modules/']
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-namespace': 'off'
        }
    }
);
