"use client";

import Link from "next/link";

type CommunityPoolData = {
  id: string;
  name: string;
  image: string;
  returnRate: string;
  maxPrize: string;
  price: string;
};

const communityPools: CommunityPoolData[] = [
  {
    id: "cyber-syndicate",
    name: "Cyber Syndicate",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDmpEAbrOLS_fi0g_hxGkFtbZh7IYkJCgdehulfbO3Yomb33Wi7uNZI79k2_Aok8VAMAV8sX4eNPo4a9qIAHkuK4SdK3zTwSa1Ekf-swf9xANRrn86yUftOcK9YvTyj0vrqtQ5o1CVL6o8AQxxz3gbO3Vn84-qQEcLeJjGaJfDYPLXC6CFik6frW6wqrQhljD1y3PpJX-FggFR1PryX6KRmVmS05TgD9mvtOofuzX8kyPBtfzBB-cTb2qsAqAvp6L4y7yX0Kb9tmPda",
    returnRate: "72%",
    maxPrize: "120U",
    price: "5.00 USDT",
  },
  {
    id: "retro-rewards",
    name: "Retro Rewards",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDMCX3KlSQKyyU7JX7e_UxBmHzvnBFlWFW3_kQx1rM2SMsimx0vIy3ISF9rTcat9ek0Emj3xJ1PkWCeCjzdIwpq3NwYp_mz8zxANHz5nMzHaC0ljKcXHA2eA9gqSOTk4ysGVB5RpHSMYy71B9GWltps8KuaPYrIqOxTZFIeL9P1WMYuiEHfofT-v6N8Cs1qbisqK8YDcXa7KMsdkCdMYa9dtj0PvMxq_lkYUPnLtOdaJhvoY-s-WXxbImRfwTWymkBGoJq45hhXvSf9",
    returnRate: "81%",
    maxPrize: "55U",
    price: "2.50 USDT",
  },
  {
    id: "glitch-matrix",
    name: "Glitch Matrix",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCIRL8PbIUnv2l43NBq78l2Ga1oSMc4r9vyVuGchGEesmcCnptP0hbZJ761n4u58cxNu_vKqRsJFkfTEfvp7DXyL7jOXToob0mCK4ndKRzMMoQ9kf7MZ2cKdQflRBhVKpf2iYDOSx0ko6GtddFzPbqWAzeWhlkhEyvl5NoLG1VmO-UucXKbm2_I311BvxnDxsnxM23CXE6mQ1M62wiLinzPcGTqFUmmYV1VTLDaHDeOkDjywH71XPhpgGf8LspTR0ID9-9hwMxG6uE0",
    returnRate: "64%",
    maxPrize: "260U",
    price: "10.0 USDT",
  },
  {
    id: "abyss-riches",
    name: "Abyss Riches",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBAwI0Vo7wlymU_SuFqZT5ZCvLWG1sJ1DAlhFQl2RuSubCQXciH4bv3Ya_tV0G-AJ1N2AXsCGLh4gKjw8X0xUNVWoydEbwnuDYxDxf0Y4xhwqX7p1U6hcnLdKg643yYAwOn6t1SQ7aEFaY1cEri0mD0kTuQpLfbYVudhwyVAqmfhLXG2Tzsqwx2AtunP6N9e_WMK3qk6ehvjoN52jlrjICv5bxGC-JjrAc4G0Ix5Iw7xA4dZFoV6wUnEyIdtC4cgECJjeiznA5-eW7_",
    returnRate: "88%",
    maxPrize: "24U",
    price: "1.00 USDT",
  },
];

const CommunityPoolCard = ({ id, name, image, returnRate, maxPrize, price }: CommunityPoolData) => (
  <div className="bg-ns-surface-container-low group relative rounded-lg overflow-hidden border border-white/5 hover:border-ns-secondary/20 transition-all">
    <div className="aspect-[3/4] overflow-hidden relative">
      <img
        alt={`Community Pool '${name}'`}
        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 saturate-50"
        src={image}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ns-surface-container-low via-transparent to-transparent" />
      <div className="absolute top-4 right-4 bg-ns-surface-container-high px-3 py-1 text-ns-secondary font-label text-[10px] font-black uppercase">
        POOL FEATURES
      </div>
    </div>
    <div className="p-6">
      <h3 className="font-headline font-bold text-xl text-ns-on-surface mb-1 uppercase">{name}</h3>
      <div className="flex justify-between items-center mb-6">
        <span className="text-ns-on-surface-variant text-sm font-body">{returnRate} RTP</span>
        <span className="text-ns-primary font-headline font-bold">Max {maxPrize}</span>
      </div>
      <Link
        href={`/purchase/${id}`}
        className="block w-full rounded-sm border border-ns-secondary/20 bg-ns-surface-container-high py-3 text-center font-headline font-bold uppercase tracking-widest text-ns-on-surface transition-all group-hover:bg-ns-secondary group-hover:text-white"
      >
        Purchase ({price})
      </Link>
    </div>
  </div>
);

export const CommunityPoolsSection = () => {
  return (
    <section id="community-pools" className="max-w-7xl mx-auto px-8 py-32 border-t border-ns-outline-variant/10">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="font-headline font-black text-4xl uppercase tracking-tight text-ns-on-surface mb-2">
            Community Pools
          </h2>
          <p className="text-ns-on-surface-variant font-body">
            Explore community-created scratch pools with diverse themes and rewards.
          </p>
        </div>
        <Link
          href="/store"
          className="text-ns-secondary font-label uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all"
        >
          View Community Pools <span className="material-symbols-outlined">trending_flat</span>
        </Link>
      </div>

      {/* Pool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {communityPools.map(pool => (
          <CommunityPoolCard key={pool.name} {...pool} />
        ))}
      </div>
    </section>
  );
};
