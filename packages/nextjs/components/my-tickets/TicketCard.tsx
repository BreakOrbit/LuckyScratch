"use client";

import type { ReactNode } from "react";
import { MyTicketsIcon, type PoolIconName } from "~~/components/my-tickets/icons";
import { TICKET_ART_FRAME_CLASS, TICKET_ART_IMAGE_CLASS } from "~~/components/ticket-art/constants";

export type TicketStatus = "unrevealed" | "claimable" | "winning" | "no-win" | "revealed";

export type TicketCardData = {
  ticketId: string;
  poolName: string;
  poolIcon: PoolIconName;
  cost: string;
  costLabel?: string;
  status: TicketStatus;
  prizeAmount?: string;
  image?: string;
  selected?: boolean;
  detailLabel?: string;
  badgeLabel?: string;
  revealedSubtitle?: string;
  action?: ReactNode;
  onSelectedChange?: (checked: boolean) => void;
};

const selectedRingClassName = "border-[#ffd700]/80 shadow-[0_0_0_1px_rgba(255,215,0,0.3)]";

const SelectionToggle = ({
  selected,
  ticketId,
  onSelectedChange,
}: {
  selected?: boolean;
  ticketId: string;
  onSelectedChange?: (checked: boolean) => void;
}) => {
  if (!onSelectedChange) {
    return null;
  }

  return (
    <label className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 backdrop-blur-md">
      <input
        type="checkbox"
        checked={Boolean(selected)}
        onChange={event => onSelectedChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#ffd700] bg-[#070e1d] accent-[#ffd700]"
      />
      <span className="sr-only">Select ticket #{ticketId}</span>
    </label>
  );
};

const TicketInfo = ({
  poolName,
  poolIcon,
  ticketId,
  cost,
  costLabel = "INDEX",
  detailLabel,
  muted = false,
}: TicketCardData & {
  muted?: boolean;
}) => (
  <div className="p-4 bg-[#232a3b]/50">
    <div className="flex justify-between items-start gap-3 mb-1">
      <div
        className={`flex min-w-0 items-center gap-1.5 font-headline font-bold text-sm ${
          muted ? "text-[#d0c6ab]" : "text-[#ffd700]"
        }`}
      >
        <MyTicketsIcon name={poolIcon} className="h-4 w-4 shrink-0" />
        <span className="truncate">{poolName}</span>
      </div>
      <div className={`shrink-0 text-[10px] font-bold ${muted ? "text-[#d0c6ab]/40" : "text-[#d0c6ab]/60"}`}>
        {costLabel}
      </div>
    </div>
    <div className="flex justify-between items-end gap-3">
      <div className={`min-w-0 truncate text-xs ${muted ? "text-[#d0c6ab]/40" : "text-[#d0c6ab]"}`}>
        {detailLabel ?? `Ticket ID: #${ticketId}`}
      </div>
      <div className={`shrink-0 text-sm font-black ${muted ? "text-[#d0c6ab]/40" : "text-[#dce2f9]"}`}>{cost}</div>
    </div>
  </div>
);

const ActionSlot = ({ action, fallback }: { action?: ReactNode; fallback: ReactNode }) => (
  <div className="p-3 bg-[#070e1d]">{action ?? fallback}</div>
);

const fallbackGradient = (
  <>
    <div className="absolute inset-0 bg-gradient-to-tr from-[#1a2333] via-[#2e3546] to-[#1a2333]" />
    <div
      className="absolute inset-0 opacity-30"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%)",
        backgroundSize: "200% 200%",
        animation: "card-shimmer 3s infinite",
      }}
    />
  </>
);

const UnrevealedTicket = (props: TicketCardData) => {
  const { ticketId, selected, action, onSelectedChange } = props;

  return (
    <div
      className={`group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border hover:scale-[1.02] transition-all duration-300 ${
        selected ? selectedRingClassName : "border-[#4d4732]/30"
      }`}
      style={{ boxShadow: "inset 0 0 0 1px rgba(255, 215, 0, 0.2), 0 0 15px rgba(0, 0, 0, 0.5)" }}
    >
      <SelectionToggle selected={selected} ticketId={ticketId} onSelectedChange={onSelectedChange} />
      <div className={`${TICKET_ART_FRAME_CLASS} bg-[#1a2333]`}>
        {fallbackGradient}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-2 border-[#ffd700]/30 flex items-center justify-center bg-[#181f30]/40 backdrop-blur-md">
            <MyTicketsIcon name="lock" className="h-12 w-12 animate-pulse text-[#ffe16d]" />
          </div>
        </div>
      </div>
      <TicketInfo {...props} />
      <ActionSlot
        action={action}
        fallback={
          <button
            type="button"
            className="w-full py-2 bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] font-bold rounded-lg text-xs hover:bg-[#ffd700] hover:text-[#705e00] transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="visibility" className="h-4 w-4" />
            REVEAL
          </button>
        }
      />
    </div>
  );
};

const ClaimableTicket = (props: TicketCardData) => {
  const { poolName, ticketId, selected, image, action, onSelectedChange, prizeAmount = "ENCRYPTED" } = props;

  return (
    <div
      className={`group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border-2 border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:scale-[1.02] transition-all duration-300 ${
        selected ? "shadow-[0_0_0_1px_rgba(255,215,0,0.3),0_0_20px_rgba(255,215,0,0.18)]" : ""
      }`}
    >
      <SelectionToggle selected={selected} ticketId={ticketId} onSelectedChange={onSelectedChange} />
      <div className={TICKET_ART_FRAME_CLASS}>
        {image ? (
          <img src={image} alt={poolName} className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS}`} />
        ) : (
          fallbackGradient
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-3 right-3 bg-[#ffd700] text-[#705e00] font-black px-2 py-0.5 rounded text-[10px] tracking-widest shadow-lg">
          READY
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-8 text-center">
          <div
            className="text-3xl font-headline font-black text-[#ffd700] md:text-4xl"
            style={{ textShadow: "0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3)" }}
          >
            {prizeAmount}
          </div>
          <div className="mt-1 text-[10px] font-bold text-[#ffd700]/80 tracking-widest uppercase">REWARD READY</div>
        </div>
      </div>
      <TicketInfo {...props} />
      <ActionSlot
        action={action}
        fallback={
          <button
            type="button"
            className="w-full py-2 bg-[#ffd700] text-[#705e00] font-black rounded-lg text-xs shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="payments" className="h-4 w-4" />
            CLAIM REWARD
          </button>
        }
      />
    </div>
  );
};

const WinningTicket = (props: TicketCardData) => {
  const { poolName, ticketId, selected, image, action, onSelectedChange, prizeAmount, badgeLabel = "WINNER" } = props;

  return (
    <div
      className={`group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border-2 border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:scale-[1.02] transition-all duration-300 ${
        selected ? "shadow-[0_0_0_1px_rgba(255,215,0,0.3),0_0_20px_rgba(255,215,0,0.18)]" : ""
      }`}
    >
      <SelectionToggle selected={selected} ticketId={ticketId} onSelectedChange={onSelectedChange} />
      <div className={TICKET_ART_FRAME_CLASS}>
        {image ? (
          <img src={image} alt={poolName} className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS}`} />
        ) : (
          fallbackGradient
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 bg-[#ffd700] text-[#705e00] font-black px-2 py-0.5 rounded text-[10px] tracking-widest shadow-lg">
          {badgeLabel}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-8 text-center">
          <div
            className="text-3xl font-headline font-black text-[#ffd700] md:text-4xl"
            style={{ textShadow: "0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3)" }}
          >
            {prizeAmount}
          </div>
          <div className="mt-1 text-[10px] font-bold text-[#ffd700]/80 tracking-widest uppercase">WINNING REVEAL</div>
        </div>
      </div>
      <TicketInfo {...props} />
      <ActionSlot
        action={action}
        fallback={
          <button
            type="button"
            className="w-full py-2 bg-[#ffd700] text-[#705e00] font-black rounded-lg text-xs shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="payments" className="h-4 w-4" />
            CLAIM REWARD
          </button>
        }
      />
    </div>
  );
};

const RevealedTicket = (props: TicketCardData) => {
  const { poolName, ticketId, selected, image, action, onSelectedChange, status, prizeAmount, revealedSubtitle } =
    props;
  const muted = status === "no-win";
  const amountLabel = prizeAmount ?? (muted ? "0 USDC" : "SCRATCHED");
  const subtitle = revealedSubtitle ?? (muted ? "BETTER LUCK NEXT TIME" : "REVEALED TICKET");

  return (
    <div
      className={`group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border transition-all duration-300 ${
        selected ? selectedRingClassName : "border-[#4d4732]/30"
      } ${muted ? "opacity-70 grayscale hover:grayscale-0 hover:opacity-100" : "opacity-90 hover:opacity-100"}`}
    >
      <SelectionToggle selected={selected} ticketId={ticketId} onSelectedChange={onSelectedChange} />
      <div className={`${TICKET_ART_FRAME_CLASS} bg-black`}>
        {image ? (
          <img
            src={image}
            alt={poolName}
            className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} ${muted ? "opacity-50" : "opacity-70"}`}
          />
        ) : (
          fallbackGradient
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-2xl font-headline font-bold text-[#d0c6ab]/50">{amountLabel}</div>
          <div className="text-[9px] font-bold text-[#d0c6ab]/35 tracking-widest uppercase mt-2">{subtitle}</div>
        </div>
      </div>
      <TicketInfo {...props} muted={muted} />
      <ActionSlot
        action={action}
        fallback={
          <button
            type="button"
            disabled
            className="w-full py-2 bg-[#181f30] text-[#d0c6ab]/40 font-bold rounded-lg text-xs cursor-default flex items-center justify-center gap-2"
          >
            REVEALED
          </button>
        }
      />
    </div>
  );
};

export const TicketCard = (props: TicketCardData) => {
  switch (props.status) {
    case "unrevealed":
      return <UnrevealedTicket {...props} />;
    case "claimable":
      return <ClaimableTicket {...props} />;
    case "winning":
      return <WinningTicket {...props} />;
    case "no-win":
    case "revealed":
      return <RevealedTicket {...props} />;
    default:
      return null;
  }
};
