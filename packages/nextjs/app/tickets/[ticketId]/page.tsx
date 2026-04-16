"use client";

import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { TicketRevealWorkspace } from "~~/components/luckyScratch/TicketRevealWorkspace";

const TicketPage: NextPage = () => {
  const params = useParams<{ ticketId: string }>();
  const ticketId = Array.isArray(params.ticketId) ? params.ticketId[0] : params.ticketId;

  if (!ticketId) {
    return null;
  }

  return <TicketRevealWorkspace ticketId={ticketId} />;
};

export default TicketPage;
