import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // Existing screens load data in effects. This rule flags that pattern.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      "realestate-ai/**",
      "node_modules/**",
      "report_assets/**",
      "workflows/**",
      "supabase/**",
      "docs/**",
    ],
  },
];

export default config;
