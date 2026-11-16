/** @type { import('@storybook/html-vite').StorybookConfig } */
export default {
  stories: ["../src/**/*.stories.js"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/html-vite", options: {} },
  core: { disableTelemetry: true },
};
