export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
}
