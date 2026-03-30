const expo = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
    ...expo,
    {
        settings: {
            react: { version: '19' },
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
];
