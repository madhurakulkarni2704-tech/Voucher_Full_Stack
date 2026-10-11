
const API_BASE_URL = "http://localhost:5000/api";

/**
 * Sends an HTTP request to the backend API.
 *
 * @param {string} endpoint - API endpoint, for example "/auth/login"
 * @param {object} options - Fetch options such as method, headers and body
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("voucherflow_token");

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot connect to the backend. Make sure your backend server is running."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const message = await response.text();

    if (!response.ok) {
      throw new Error(message || "The request failed.");
    }

    return { success: true, message };
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export { API_BASE_URL };
