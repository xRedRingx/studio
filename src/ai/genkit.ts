/**
 * @fileoverview Genkit AI configuration and initialization.
 * This file sets up the Genkit instance with necessary plugins,
 * such as the Google AI plugin for accessing Gemini models.
 * The exported `ai` object is used throughout the application
 * to define and run AI flows and prompts.
 */

import {genkit} from 'genkit'; // Core Genkit library.
import {googleAI} from '@genkit-ai/googleai'; // Plugin for Google AI services (e.g., Gemini).

/**
 * The main Genkit AI instance for the application.
 * It's configured with the Google AI plugin and specifies a default model.
 *
 * @property {Array<Plugin<any>>} plugins - An array of Genkit plugins to use.
 *   - `googleAI()`: Enables integration with Google's AI models.
 * @property {string} model - The default AI model to be used for generation tasks
 *   if not specified explicitly in a flow or prompt. Here, it's set to
 *   'googleai/gemini-2.0-flash'.
 */
export const ai = genkit({
  plugins: [googleAI()], // Registers the Google AI plugin.
  model: 'googleai/gemini-2.0-flash', // Sets the default model for AI generation.
});
