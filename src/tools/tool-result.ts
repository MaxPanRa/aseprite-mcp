import { errorToJson, jsonContent } from "../utils/errors.js";

export async function toolResult(action: () => Promise<unknown>) {
  try {
    return jsonContent(await action());
  } catch (error) {
    return jsonContent(errorToJson(error));
  }
}
