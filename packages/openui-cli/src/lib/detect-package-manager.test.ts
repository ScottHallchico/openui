import { afterEach, describe, expect, it } from "vitest";
import type { PackageManager } from "./detect-package-manager";
import { resolveInstallPackageManager } from "./detect-package-manager";

describe("resolveInstallPackageManager", () => {
  const originalUserAgent = process.env["npm_config_user_agent"];

  afterEach(() => {
    // Restore original env to avoid leaking between tests
    if (originalUserAgent === undefined) {
      delete process.env["npm_config_user_agent"];
    } else {
      process.env["npm_config_user_agent"] = originalUserAgent;
    }
  });

  function setUserAgent(value: string | undefined): void {
    if (value === undefined) {
      delete process.env["npm_config_user_agent"];
    } else {
      process.env["npm_config_user_agent"] = value;
    }
  }

  function expectPackageManager(
    result: PackageManager,
    expected: {
      name: string;
      installCmd: string;
      installArgs: string[];
      runCmd: string;
    },
  ): void {
    expect(result.name).toBe(expected.name);
    expect(result.installCmd).toBe(expected.installCmd);
    expect(result.installArgs).toEqual(expected.installArgs);
    expect(result.runCmd).toBe(expected.runCmd);
  }

  it("detects pnpm from user agent", () => {
    setUserAgent("pnpm/9.15.4 npm/? node/v22.12.0 linux x64");
    const result = resolveInstallPackageManager();
    expectPackageManager(result, {
      name: "pnpm",
      installCmd: "pnpm install",
      installArgs: ["install"],
      runCmd: "pnpm",
    });
  });

  it("detects yarn from user agent", () => {
    setUserAgent("yarn/4.1.0 npm/? node/v22.12.0 linux x64");
    const result = resolveInstallPackageManager();
    expectPackageManager(result, {
      name: "yarn",
      installCmd: "yarn",
      installArgs: [],
      runCmd: "yarn",
    });
  });

  it("detects bun from user agent", () => {
    setUserAgent("bun/1.0.0 npm/? node/v22.12.0 linux x64");
    const result = resolveInstallPackageManager();
    expectPackageManager(result, {
      name: "bun",
      installCmd: "bun install",
      installArgs: ["install"],
      runCmd: "bun",
    });
  });

  it("detects npm from user agent", () => {
    setUserAgent("npm/10.2.3 node/v22.12.0 linux x64");
    const result = resolveInstallPackageManager();
    expectPackageManager(result, {
      name: "npm",
      installCmd: "npm ci --prefer-offline --no-audit --no-fund --progress=false",
      installArgs: ["ci", "--prefer-offline", "--no-audit", "--no-fund", "--progress=false"],
      runCmd: "npm",
    });
  });

  it("falls back to npm when user agent is unrecognized", () => {
    setUserAgent("unknown-pm/1.0.0");
    const result = resolveInstallPackageManager();
    expect(result.name).toBe("npm");
  });

  it("falls back to npm when user agent is empty", () => {
    setUserAgent("");
    const result = resolveInstallPackageManager();
    expect(result.name).toBe("npm");
  });

  it("falls back to npm when npm_config_user_agent is not set", () => {
    setUserAgent(undefined);
    const result = resolveInstallPackageManager();
    expect(result.name).toBe("npm");
  });
});
