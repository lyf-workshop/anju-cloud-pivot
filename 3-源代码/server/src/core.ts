import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const now = () => new Date().toISOString();
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const id = () => randomUUID();
export const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};
