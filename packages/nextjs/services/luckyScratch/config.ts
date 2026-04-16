const LOCAL_BACKEND_PORT = "8080";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getLuckyScratchBackendBaseURL = () => {
  const explicitURL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (explicitURL) {
    return trimTrailingSlash(explicitURL);
  }

  if (typeof window === "undefined") {
    return `http://127.0.0.1:${LOCAL_BACKEND_PORT}`;
  }

  const url = new URL(window.location.origin);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    url.port = LOCAL_BACKEND_PORT;
    return trimTrailingSlash(url.toString());
  }

  return trimTrailingSlash(window.location.origin);
};
