export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return process.env.API_BASE_URL || "http://server:4000";
}
