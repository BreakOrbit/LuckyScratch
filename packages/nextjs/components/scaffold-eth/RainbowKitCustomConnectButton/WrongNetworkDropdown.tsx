import { useDisconnect } from "wagmi";
import { ArrowLeftOnRectangleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

export const WrongNetworkDropdown = () => {
  const { disconnect } = useDisconnect();

  return (
    <div className="dropdown dropdown-end mr-2">
      <label
        tabIndex={0}
        className="inline-flex h-11 items-center gap-2 rounded-sm border border-error bg-ns-surface-container-low px-3 font-headline text-xs font-bold uppercase tracking-[0.18em] text-error shadow-md"
      >
        <span>Sepolia only</span>
        <ChevronDownIcon className="h-4 w-4" />
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu mt-3 w-64 gap-1 rounded-sm border border-ns-outline bg-ns-surface-container-low p-2 shadow-lg"
      >
        <li>
          <button
            className="flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm text-error transition-colors hover:bg-ns-surface-container-high"
            type="button"
            onClick={() => disconnect()}
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
            <span>Disconnect</span>
          </button>
        </li>
      </ul>
    </div>
  );
};
