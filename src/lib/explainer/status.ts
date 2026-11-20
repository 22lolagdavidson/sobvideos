export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  NONE: { text: "No script yet", cls: "" },
  DRAFT: { text: "Draft: needs review", cls: "pending" },
  APPROVED: { text: "Approved", cls: "pending" },
  RENDERING: { text: "Rendering video", cls: "pending" },
  READY: { text: "Video ready", cls: "enrolled" },
  FAILED: { text: "Render failed", cls: "failed" },
};
