"use client";

import Link from "next/link";
import { PoolCard } from "./PoolCard";
import type { PoolCardData } from "./PoolCard";

const pools: PoolCardData[] = [
  {
    name: "Lucky Fortune",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAQaG4oLCc9J8rnC3R4aIgISMypLp7AcZKksdix0W1p0DhjY_WmmR8GZy2Gf1ynCyd5VaVLSbTtpTvrTHsTJya_FytwpJAW4Ip7-TDZxnBrPknR1zqvdyQmf1a9OPVS8H3Y8Ub_JbWUdqXHssNLEbuhvT6nKwKzj-TPGFaGlR7svFegnk0dGNM-7ZDnd0EB64SbfLkmsMy3c-qnutIcLxSU4bi6N3xJtFb2VcIxX0DyGc5xoHjaRB9QXckvqEbO7A4QkqTDIbOe0IrL",
    rarity: "Common",
    price: "2U",
    animationType: "lantern",
  },
  {
    name: "Rainbow Treasure",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC-w0_446CF6R7axdg7pS7s-pMWRoZf-emS_QhpAEGuaPEp1MA3nvfaH2xD-2KILka5S2a7GZtBJesctqiRGVp6KHSPiyXABf9yoM_EURMz3zHQYrds4PhI4H_rclTrmxy6bWNTEKLjEL2iMP4mZs3ZRK5rMmpzIaGx_60H8W1iHyPB2tq4iQKTLq0o9UWMgy38a66ot17y7ILKFA1TbqPGCHnLiQ-O101yJcvkwEJf9iUxm_VxrqIsdvu5wxSxE4zDASMmvF5S3el1",
    rarity: "Rare",
    price: "5U",
    animationType: "crystal",
  },
  {
    name: "Sakura Story",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAJLSy5hueMJbZ6QroBE8j4p5XPITglB2OEOOI4rD-KwE0zNY4DHyKWjlRZg7QvSRdg45j7oCcjS8koRRc6cPrV6Px_-HUWx3Hr3aWmuBElNvzP607FrQFVu-PI7qPI0XX_Ns95EyKbsuzMobDYVrTBjZsE3f6kLHiGhFtI9HqYdHppeq2NhNBPcNJ2ItqlM73VmULh9BE8lJFrPqalQ_fnOaC6_olgpgeWBsJlBr2CVY9-s8yoo9aQYeP--ebnhhs4sRD8Fy0iKicF",
    rarity: "Super Rare",
    price: "10U",
    animationType: "sakura",
  },
  {
    name: "Starlight Overflow",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDPYCzoDx-9BQIr0COJsmdVtsa7BGii7SWYFSZXtKP26_v4FHKSwXBoc1HrQ7DRBcLX4QEC0PEwYk71bQLHw37cjj97tUftVu1yNcLSgOWViX9UOAQKA8CFgK9iGh0hJxB1iKHbk9wh9yoj8tfEjeGy3k48eZGNiBwU8FI290pXCQoNPdyHcRT7ck2DNO9CrOuHCjd-8_fim3h00595xUxCvwScEDfDpGuG9fovZNxDVwUit0okVtrnUXPSdMan3OeLRM1peRfuET6d",
    rarity: "Legendary",
    price: "15U",
    animationType: "starlight",
  },
  {
    name: "Dragon Rise",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAYsGDrgU02SFZYsHcqm32f9HkMeKulrBZlNZquU7BRrWhT3fPGUbftOJVRZneilb0UIhi_PnMqaQOD_Qo9-nfM8H6Q01QfUza3isuN-sc5Im5lItqwaTJNXNEgaAl6qXPjnDpIHF5zKaoHModvLOJ0i6zNg9ozVXNk3GKVeeHlx7ntzZNjbTMhY3MEoHQSLT2qnMWauX26Pv7_qM4FhEeeykGcJFDhqUFWzu19MZZNswNQUXE5k-0c7ECIR2-ldSgKwtEVknzUX75R",
    rarity: "Common",
    price: "2U",
    animationType: "dragon",
    hiddenOnMobile: true,
  },
  {
    name: "Diamond Hunter",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3ba14sF6SFAYjRuX_RFyJFbpGrWP7ZoNmSp1fx4GFYvsx1MIwoBY2zU4visyOKZMp3dQ6uFHEM99h2_JY6uwlwbKGV7h7bWDFAu6XT0KUJO8hOAjXc_huQHwQLVREP_i2NKdISI720UjlPqnB_k-IbBsM7CWQvo8IWnGjkczfGLfTf8Y_fcYVfQWVT299vy3mDLPpTnZjH6ojG5fxVQ95mZFcyYd655w8n66TwqMb5Z-aw-3pPm8Fh0lyNkCo1fjXKbXLUkBJmKgI",
    rarity: "Rare",
    price: "5U",
    animationType: "diamond",
    hiddenOnMobile: true,
  },
  {
    name: "Golden Legend",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAFYoWpapwfnYDUSH4UGdB5y2z8q1BTHTHc4lhlUBTl7_mnAyxJHzhjZZOU-uyGHPk1AhuzQykGdlR_k3gBKqYi1nfHZ3PFUUIb7fs8Tg7jWdIKsIcbsRaJOHNObfcATPzyavDsQhVJXSOcBahykYZn4wky0T1FcaxulsTxRsHX54GFOyY2lBI_ZQyzcMlKSt8NXM5SrTuA-jy1l1euWhGvw0uW1WrXs0RhPXOv6GVmturwl6dq45gceOhTjD23CTXjZp7a0pBPn4Ss",
    rarity: "Super Rare",
    price: "10U",
    animationType: "golden",
    hiddenOnMobile: true,
  },
  {
    name: "Cosmic Jackpot",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCZ9Lx2WpQuen-WhT95jshFfu5vVVczXcjlJRt-z3d2dWD70MR2vAKeLbB6C0M8cAYi0H8sMn_fSr8rQs41Ki3LGjKGitFCs2sT-u8YT1LcA_UmlG5UruzOYfjvk8M967GrzLhStc7zwqEUkqIXC0pZR7xbt2oilvvwF4RtlzCDDzTtq8Tj4AwZnCrRf9z4Rw8KLvwxZYD0BXNLUe8Ix1VW5bM4HQKDUEN6-zirH2vEexPkAsmaNtZIbXsXbKwE7_EhoYyCsgURRxHk",
    rarity: "Legendary",
    price: "15U",
    animationType: "cosmic",
    hiddenOnMobile: true,
  },
];

export const ThemePoolsSection = () => {
  return (
    <section id="theme-pools" className="max-w-7xl mx-auto px-8 py-32">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="font-headline font-black text-4xl uppercase tracking-tight text-ns-on-surface mb-2">
            Official Theme Pools
          </h2>
          <p className="text-ns-on-surface-variant font-body">
            Exclusive limited-edition scratch collections from LuckyScratch HQ.
          </p>
        </div>
        <Link
          href="/store"
          className="text-ns-primary font-label uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all"
        >
          View All Pools{" "}
          <span className="material-symbols-outlined">trending_flat</span>
        </Link>
      </div>

      {/* Pool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {pools.map((pool) => (
          <PoolCard key={pool.name} {...pool} />
        ))}
      </div>
    </section>
  );
};
