/**
 * Single response envelope used by every backend endpoint (replaces the three
 * incompatible shapes that previously coexisted: {success,data/error}, {ok,status,message},
 * and {received:true}).
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
