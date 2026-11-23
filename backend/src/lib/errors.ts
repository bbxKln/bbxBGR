/** 业务错误：status 为 HTTP 状态码，code 为稳定错误码，message 面向用户 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message)
}
