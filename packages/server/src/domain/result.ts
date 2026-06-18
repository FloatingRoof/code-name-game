import type { ErrorCode } from "@codenames/shared";

export interface ErrorResult {
  ok: false;
  code: ErrorCode;
  message: string;
}

export interface OkResult<T> {
  ok: true;
  data: T;
}

export type Result<T> = OkResult<T> | ErrorResult;

export function ok<T>(data: T): OkResult<T> {
  return { ok: true, data };
}

export function err(code: ErrorCode, message: string): ErrorResult {
  return { ok: false, code, message };
}
