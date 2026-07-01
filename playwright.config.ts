const config = {
  testDir: "./tests",
  testMatch: "e2e.spec.ts",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
  },
};

export default config;
