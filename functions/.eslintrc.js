// This is the ESLint configuration file for the Firebase Cloud Functions.
// ESLint is a tool for identifying and reporting on patterns found in ECMAScript/JavaScript code,
// with the goal of making code more consistent and avoiding bugs.
module.exports = {
  // Specifies that this is the root ESLint configuration file.
  // ESLint will stop looking in parent folders for more configuration files.
  root: true,
  // Defines the environments that the code will run in.
  // This helps ESLint understand global variables available in those environments.
  env: {
    es6: true, // Enables ES6 syntax and global variables (e.g., Promise, Set).
    node: true, // Enables Node.js global variables and Node.js scoping.
  },
  // Extends a set of recommended ESLint configurations.
  // These provide baseline rules for common best practices.
  extends: [
    "eslint:recommended", // ESLint's built-in recommended rules.
    "plugin:import/errors", // Rules for identifying errors in import statements.
    "plugin:import/warnings", // Rules for identifying potential issues in import statements.
    "plugin:import/typescript", // TypeScript-specific import rules.
    "google", // Google's JavaScript style guide.
    "plugin:@typescript-eslint/recommended", // Recommended rules for TypeScript code from the @typescript-eslint plugin.
  ],
  // Specifies the parser ESLint should use.
  // @typescript-eslint/parser allows ESLint to understand TypeScript syntax.
  parser: "@typescript-eslint/parser",
  // Configures the parser options.
  parserOptions: {
    // Specifies the TypeScript configuration files for the parser to use.
    // This allows ESLint to leverage type information for more advanced rules.
    project: ["tsconfig.json", "tsconfig.dev.json"],
    // Specifies the type of source code (module for ES modules).
    sourceType: "module",
  },
  // Specifies patterns to ignore during linting.
  ignorePatterns: [
    "/lib/**/*", // Ignore built files in the 'lib' directory (output of TypeScript compilation).
    "/generated/**/*", // Ignore any auto-generated files.
  ],
  // Specifies ESLint plugins to use.
  // Plugins add custom rules and configurations.
  plugins: [
    "@typescript-eslint", // Plugin for TypeScript-specific linting rules.
    "import", // Plugin for linting ES6+ import/export syntax.
  ],
  // Defines custom rules or overrides for the extended configurations.
  rules: {
    // Enforces the use of double quotes for strings.
    "quotes": ["error", "double"],
    // Disables the rule that checks for unresolved imports (handled by TypeScript).
    "import/no-unresolved": 0,
    // Enforces an indent of 2 spaces.
    "indent": ["error", 2],
  },
};
