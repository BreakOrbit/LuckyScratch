import { getLuckyScratchBackendBaseURL } from "./config";
import type { ClaimPrecheckResponse, LuckyScratchTicket, RevealAuthResponse, UserTicketsResponse } from "./types";

type APIErrorPayload = {
  error?: string;
  message?: string;
};

const parseErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as APIErrorPayload;
    return payload.error || payload.message || `LuckyScratch API request failed with ${response.status}`;
  }

  const text = await response.text();
  return text || `LuckyScratch API request failed with ${response.status}`;
};

const requestJSON = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${getLuckyScratchBackendBaseURL()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const luckyScratchAPI = {
  getTicket: (ticketId: string) => requestJSON<LuckyScratchTicket>(`/api/v1/tickets/${ticketId}`),
  listUserTickets: (address: string) =>
    requestJSON<UserTicketsResponse>(`/api/v1/users/${address}/tickets?limit=50&offset=0`),
  buildRevealAuth: (ticketId: string, address: string) =>
    requestJSON<RevealAuthResponse>(`/api/v1/tickets/${ticketId}/reveal-auth`, {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  getClaimPrecheck: (ticketId: string) =>
    requestJSON<ClaimPrecheckResponse>(`/api/v1/tickets/${ticketId}/claim-precheck`),
};
