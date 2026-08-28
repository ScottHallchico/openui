import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArgDef } from "./resolve-args";
import { rejectConflictingImmediateFlags, resolveArgs } from "./resolve-args";
import { CliCancelledError, CreateError } from "./telemetry";

// ─── rejectConflictingImmediateFlags ────────────────────────────────────────

describe("rejectConflictingImmediateFlags", () => {
  it("allows --immediate alone", () => {
    expect(() => rejectConflictingImmediateFlags(["--immediate"])).not.toThrow();
  });

  it("allows -i alone", () => {
    expect(() => rejectConflictingImmediateFlags(["-i"])).not.toThrow();
  });

  it("allows --no-immediate alone", () => {
    expect(() => rejectConflictingImmediateFlags(["--no-immediate"])).not.toThrow();
  });

  it("throws when --immediate and --no-immediate are both present", () => {
    expect(() => rejectConflictingImmediateFlags(["--immediate", "--no-immediate"])).toThrow(
      CreateError,
    );
  });

  it("throws when -i and --no-immediate are both present", () => {
    expect(() => rejectConflictingImmediateFlags(["-i", "--no-immediate"])).toThrow(CreateError);
  });

  it("does not treat flags after -- separator as options", () => {
    // --immediate before -- and --no-immediate after -- should NOT conflict
    expect(() =>
      rejectConflictingImmediateFlags(["--immediate", "--", "--no-immediate"]),
    ).not.toThrow();
  });

  it("allows repeated non-conflicting flags", () => {
    expect(() => rejectConflictingImmediateFlags(["--immediate", "--immediate"])).not.toThrow();
  });

  it("allows an empty args array", () => {
    expect(() => rejectConflictingImmediateFlags([])).not.toThrow();
  });
});

// ─── resolveArgs ────────────────────────────────────────────────────────────

describe("resolveArgs", () => {
  afterEach(() => {
    vi.resetModules();
  });
  it("returns values directly when all args have { value }", async () => {
    const defs = {
      name: { value: "my-app" },
      template: { value: "nextjs" },
    };

    const result = await resolveArgs(defs, false);

    expect(result).toEqual({ name: "my-app", template: "nextjs" });
  });

  it("throws CreateError for missing required arg in non-interactive mode", async () => {
    const defs: Record<string, ArgDef<unknown>> = {
      name: {
        prompt: { type: "input" as const, message: "Project name?" },
        required: true as const,
      },
    };

    await expect(resolveArgs(defs, false)).rejects.toThrow(CreateError);

    try {
      await resolveArgs(defs, false);
    } catch (err) {
      const error = err as CreateError;
      expect(error.stage).toBe("args_resolution");
      expect(error.message).toContain("--name");
      expect(error.errorCode).toBe("MISSING_REQUIRED_ARG");
    }
  });

  it("calls input() for an input prompt in interactive mode", async () => {
    const mockInput = vi.fn().mockResolvedValue("user-typed-value");
    vi.doMock("@inquirer/prompts", () => ({
      input: mockInput,
      select: vi.fn(),
    }));

    const defs: Record<string, ArgDef<unknown>> = {
      projectName: {
        prompt: { type: "input" as const, message: "Project name?", default: "my-app" },
        required: true as const,
      },
    };

    const result = await resolveArgs(defs, true);

    expect(result.projectName).toBe("user-typed-value");
    expect(mockInput).toHaveBeenCalledWith({
      message: "Project name?",
      default: "my-app",
    });


  });

  it("calls select() for a select prompt in interactive mode", async () => {
    const choices = [
      { value: "nextjs", name: "Next.js" },
      { value: "vite", name: "Vite" },
    ];
    const mockSelect = vi.fn().mockResolvedValue("nextjs");
    vi.doMock("@inquirer/prompts", () => ({
      input: vi.fn(),
      select: mockSelect,
    }));

    const defs: Record<string, ArgDef<unknown>> = {
      template: {
        prompt: { type: "select" as const, message: "Pick a template", choices },
        required: true as const,
      },
    };

    const result = await resolveArgs(defs, true);

    expect(result.template).toBe("nextjs");
    expect(mockSelect).toHaveBeenCalledWith({
      message: "Pick a template",
      choices,
    });


  });

  it("wraps ExitPromptError into CliCancelledError", async () => {
    // Create a real ExitPromptError instance using the actual class
    const { ExitPromptError } = await import("@inquirer/core");
    const exitError = new ExitPromptError();

    vi.doMock("@inquirer/prompts", () => ({
      input: vi.fn().mockRejectedValue(exitError),
      select: vi.fn(),
    }));

    const defs: Record<string, ArgDef<unknown>> = {
      name: {
        prompt: { type: "input" as const, message: "Name?" },
        required: true as const,
      },
    };

    await expect(resolveArgs(defs, true)).rejects.toThrow(CliCancelledError);


  });

  it("rethrows unexpected errors without wrapping", async () => {
    const unexpectedError = new Error("something broke");
    vi.doMock("@inquirer/prompts", () => ({
      input: vi.fn().mockRejectedValue(unexpectedError),
      select: vi.fn(),
    }));

    const defs: Record<string, ArgDef<unknown>> = {
      name: {
        prompt: { type: "input" as const, message: "Name?" },
        required: true as const,
      },
    };

    await expect(resolveArgs(defs, true)).rejects.toThrow(unexpectedError);


  });
});
