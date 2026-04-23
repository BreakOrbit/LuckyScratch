const LOCAL_BACKEND_PORT = "8080";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const IPFS_PROTOCOL_PREFIX = "ipfs://";
const IPFS_PATH_MARKER = "/ipfs/";

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

export const getLuckyScratchIPFSGatewayBaseURL = () => {
  const explicitURL = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE_URL?.trim();
  if (!explicitURL) {
    return "";
  }

  return trimTrailingSlash(explicitURL);
};

const extractIPFSPath = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.startsWith(IPFS_PROTOCOL_PREFIX)) {
    return trimmedValue.slice(IPFS_PROTOCOL_PREFIX.length).replace(/^\/+/, "");
  }

  try {
    const parsedURL = new URL(trimmedValue);
    const markerIndex = parsedURL.pathname.indexOf(IPFS_PATH_MARKER);
    if (markerIndex === -1) {
      return "";
    }

    const pathSuffix = parsedURL.pathname.slice(markerIndex + IPFS_PATH_MARKER.length).replace(/^\/+/, "");
    return pathSuffix ? `${pathSuffix}${parsedURL.search}${parsedURL.hash}` : "";
  } catch {
    const markerIndex = trimmedValue.indexOf(IPFS_PATH_MARKER);
    if (markerIndex === -1) {
      return "";
    }

    return trimmedValue.slice(markerIndex + IPFS_PATH_MARKER.length).replace(/^\/+/, "");
  }
};

export const resolveLuckyScratchIPFSURL = (value?: string | null) => {
  if (!value) {
    return value;
  }

  const gatewayBaseURL = getLuckyScratchIPFSGatewayBaseURL();
  if (!gatewayBaseURL) {
    return value;
  }

  const ipfsPath = extractIPFSPath(value);
  if (!ipfsPath) {
    return value;
  }

  return `${gatewayBaseURL}/${ipfsPath}`;
};
