import { describe, expect, it } from "vitest";

import { isTheme } from "./theme";

describe("theme helpers", () => {
  it("acepta solo light y dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("otro")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});
