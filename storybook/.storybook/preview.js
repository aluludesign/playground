import "../src/generated/tokens.css";
import "../src/token-pages.css";

/** @type { import('@storybook/html').Preview } */
export default {
  parameters: {
    layout: "padded",
    controls: { disable: true },
    actions: { disable: true },
    options: {
      storySort: { order: ["說明", "Foundations", "Style", "Comps"] },
    },
  },
};
