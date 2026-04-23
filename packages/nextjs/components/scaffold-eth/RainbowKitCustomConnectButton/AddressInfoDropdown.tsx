import { useRef } from "react";
import Link from "next/link";
import { getAddress } from "viem";
import { Address } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  QrCodeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useCopyToClipboard, useOutsideClick } from "~~/hooks/scaffold-eth";
import { isENS } from "~~/utils/scaffold-eth/common";

const BURNER_WALLET_ID = "burnerWallet";

type AddressInfoDropdownProps = {
  address: Address;
  blockExplorerAddressLink: string | undefined;
  displayName: string;
  ensAvatar?: string;
};

export const AddressInfoDropdown = ({
  address,
  ensAvatar,
  displayName,
  blockExplorerAddressLink,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const { connector } = useAccount();
  const checkSumAddress = getAddress(address);

  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const closeDropdown = () => {
    dropdownRef.current?.removeAttribute("open");
  };

  useOutsideClick(dropdownRef, closeDropdown);

  const menuItemClassName =
    "flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm text-ns-on-surface transition-colors hover:bg-ns-surface-container-high";
  const destructiveMenuItemClassName = `${menuItemClassName} text-error`;

  return (
    <>
      <details ref={dropdownRef} className="dropdown dropdown-end leading-none group">
        <summary className="flex h-11 min-w-[196px] cursor-pointer items-center gap-3 rounded-sm border border-ns-primary bg-ns-primary px-3 text-left text-ns-on-primary shadow-md transition-all duration-200 hover:border-ns-primary-container hover:brightness-95 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <BlockieAvatar address={checkSumAddress} size={30} ensImage={ensAvatar} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ns-on-primary">
            {isENS(displayName) ? displayName : checkSumAddress?.slice(0, 6) + "..." + checkSumAddress?.slice(-4)}
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-ns-on-primary opacity-70 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ul className="dropdown-content menu z-50 mt-3 w-64 gap-1 rounded-sm border border-ns-outline bg-ns-surface-container-low p-2 shadow-lg">
          <li>
            <button className={menuItemClassName} type="button" onClick={() => copyAddressToClipboard(checkSumAddress)}>
              {isAddressCopiedToClipboard ? (
                <>
                  <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copied!</span>
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copy address</span>
                </>
              )}
            </button>
          </li>
          <li>
            <label htmlFor="qrcode-modal" className={menuItemClassName}>
              <QrCodeIcon className="h-5 w-5" />
              <span className="whitespace-nowrap">View QR Code</span>
            </label>
          </li>
          <li>
            <Link href="/profile" className={menuItemClassName} onClick={closeDropdown}>
              <UserIcon className="h-5 w-5" />
              <span className="whitespace-nowrap">My Profile</span>
            </Link>
          </li>
          {blockExplorerAddressLink ? (
            <li>
              <a
                target="_blank"
                href={blockExplorerAddressLink}
                rel="noopener noreferrer"
                className={menuItemClassName}
                onClick={closeDropdown}
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                <span className="whitespace-nowrap">View on Block Explorer</span>
              </a>
            </li>
          ) : null}
          {connector?.id === BURNER_WALLET_ID ? (
            <li>
              <label htmlFor="reveal-burner-pk-modal" className={destructiveMenuItemClassName}>
                <EyeIcon className="h-5 w-5" />
                <span>Reveal Private Key</span>
              </label>
            </li>
          ) : null}
          <li>
            <button className={destructiveMenuItemClassName} type="button" onClick={() => disconnect()}>
              <ArrowLeftOnRectangleIcon className="h-5 w-5" /> <span>Disconnect</span>
            </button>
          </li>
        </ul>
      </details>
    </>
  );
};
