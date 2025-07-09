import { useFetcher } from "@remix-run/react";
import { useCallback } from "react";

interface CSRFData {
  csrfToken: string;
  csrfHeader: string;
  csrfField: string;
}

/**
 * React hook for CSRF token management in forms and API calls
 */
export function useCSRF(csrfData: CSRFData) {
  const fetcher = useFetcher();
  
  /**
   * Submit form with CSRF token
   */
  const submitWithCSRF = useCallback(
    (formData: FormData | Record<string, any>, options?: any) => {
      if (formData instanceof FormData) {
        formData.append(csrfData.csrfField, csrfData.csrfToken);
        return fetcher.submit(formData, options);
      } else {
        return fetcher.submit(
          { ...formData, [csrfData.csrfField]: csrfData.csrfToken },
          options
        );
      }
    },
    [csrfData, fetcher]
  );
  
  /**
   * Create headers with CSRF token
   */
  const getCSRFHeaders = useCallback(
    (headers: HeadersInit = {}): HeadersInit => {
      return {
        ...headers,
        [csrfData.csrfHeader]: csrfData.csrfToken,
      };
    },
    [csrfData]
  );
  
  /**
   * Fetch with CSRF protection
   */
  const fetchWithCSRF = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = getCSRFHeaders(options.headers);
      
      // Add CSRF token to body if it's a POST/PUT/DELETE request
      if (["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")) {
        if (options.body && typeof options.body === "string") {
          try {
            const body = JSON.parse(options.body);
            options.body = JSON.stringify({
              ...body,
              [csrfData.csrfField]: csrfData.csrfToken,
            });
          } catch {
            // If not JSON, add as header only
          }
        }
      }
      
      return fetch(url, {
        ...options,
        headers,
      });
    },
    [csrfData, getCSRFHeaders]
  );
  
  return {
    csrfToken: csrfData.csrfToken,
    csrfHeader: csrfData.csrfHeader,
    csrfField: csrfData.csrfField,
    submitWithCSRF,
    getCSRFHeaders,
    fetchWithCSRF,
  };
}

/**
 * CSRF token input component
 */
export function CSRFTokenInput({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}