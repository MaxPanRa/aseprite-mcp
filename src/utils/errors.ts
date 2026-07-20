export class McpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function errorToJson(error: unknown): Record<string, unknown> {
  if (error instanceof McpError) {
    return { success: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  if (error instanceof Error) {
    return { success: false, error: { code: "INTERNAL_ERROR", message: error.message } };
  }
  return { success: false, error: { code: "UNKNOWN_ERROR", message: String(error) } };
}

export function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
