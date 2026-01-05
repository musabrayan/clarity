// User role types
export type UserRole = "USER" | "AGENT";

// User data structure
export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole | null;
}

// Authentication tokens
export interface AuthTokens {
  refresh: string;
  access: string;
}

// Register request payload
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
  role: UserRole;
}

// Login request payload
export interface LoginRequest {
  username: string;
  password: string;
}

// Logout request payload
export interface LogoutRequest {
  refresh: string;
}

// API Response wrappers
export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string | Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Register response data
export interface RegisterData {
  id: number;
  username: string;
  email: string;
}

// Login response data
export interface LoginData {
  user: User;
  tokens: AuthTokens;
}

// Me response (current user) data
export interface MeData {
  id: number;
  username: string;
  email: string;
  role: UserRole | null;
}

// Logout response
export interface LogoutData {
  message: string;
}

// Complete API response types
export type RegisterResponse = ApiResponse<RegisterData>;
export type LoginResponse = ApiResponse<LoginData>;
export type MeResponse = ApiResponse<MeData>;
export type LogoutResponse = ApiResponse<LogoutData>;

// Auth state for Redux/state management
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
