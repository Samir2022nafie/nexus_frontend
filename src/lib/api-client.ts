import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    code?: string;
    message: string;
    path?: (string | number)[];
  }>;
}

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
  error?: ApiError;
}

export interface PaginatedResult<T> {
  data: T;
  meta: ApiMeta;
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const baseURL = `${rawApiUrl.replace(/\/+$/, "")}/api/v1`;

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request Interceptor: Attach bearer_token from localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("bearer_token");
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Unwrap { success, data, meta } and handle 401
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && "success" in body) {
      if (body.meta) {
        return {
          data: body.data,
          meta: body.meta,
        } as unknown as typeof response;
      }
      return body.data as unknown as typeof response;
    }
    return body;
  },
  (error: AxiosError<{ success?: boolean; error?: ApiError }>) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("bearer_token");
        localStorage.removeItem("auth_user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function apiGet<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.get(url, config);
  return response as unknown as T;
}

export async function apiPost<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.post(url, data, config);
  return response as unknown as T;
}

export async function apiPatch<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.patch(url, data, config);
  return response as unknown as T;
}

export async function apiDelete<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.delete(url, config);
  return response as unknown as T;
}
