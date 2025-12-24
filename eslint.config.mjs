import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  // The game loop intentionally mutates `useRef` contents for performance.
  // Newer eslint-config-next enables React Compiler/hook immutability rules
  // that flag this pattern, even though it is intentional here.
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default config;
