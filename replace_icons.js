const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/nextjs/components/pool-detail/PoolDetailPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace MaterialIcon definition with imports
const imports = `import {
  ShareIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandLineIcon,
  WalletIcon,
  BanknotesIcon,
  PowerIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";`;

code = code.replace(
  /const MaterialIcon =[\s\S]*?\);\n/,
  imports + '\n'
);

// Replacements
const replacements = [
  { match: /<MaterialIcon name="share" className="text-2xl" \/>/g, replace: '<ShareIcon className="h-6 w-6" />' },
  { match: /<MaterialIcon name="monitoring" className="text-\[#FFE16D\]\/50" \/>/g, replace: '<ChartBarIcon className="h-5 w-5 text-[#FFE16D]/50" />' },
  { match: /<MaterialIcon name="search" \/>/g, replace: '<MagnifyingGlassIcon className="h-5 w-5" />' },
  { match: /<MaterialIcon name="download" \/>/g, replace: '<ArrowDownTrayIcon className="h-5 w-5" />' },
  { match: /<MaterialIcon name="stars" className="text-\[14px\]" style=\{\{ fontVariationSettings: "'FILL' 1" \}\} \/>/g, replace: '<StarIcon className="h-3.5 w-3.5" />' },
  { match: /<MaterialIcon name="chevron_left" className="text-sm" \/>/g, replace: '<ChevronLeftIcon className="h-4 w-4" />' },
  { match: /<MaterialIcon name="chevron_right" className="text-sm" \/>/g, replace: '<ChevronRightIcon className="h-4 w-4" />' },
  { match: /<MaterialIcon name="terminal" className="text-3xl" \/>/g, replace: '<CommandLineIcon className="h-8 w-8" />' },
  { match: /<MaterialIcon name="account_balance_wallet" className="text-xl" \/>/g, replace: '<WalletIcon className="h-5 w-5" />' },
  { match: /<MaterialIcon name="history_edu" className="text-xl" \/>/g, replace: '<BanknotesIcon className="h-5 w-5" />' },
  { match: /<MaterialIcon name="power_settings_new" className="text-xl" \/>/g, replace: '<PowerIcon className="h-5 w-5" />' },
];

replacements.forEach(r => {
  code = code.replace(r.match, r.replace);
});

fs.writeFileSync(filePath, code);
console.log("Replaced icons successfully.");
