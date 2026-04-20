"use client";

import { Suspense, use } from "react";
import type { NextPage } from "next";
import { ScratchPage } from "~~/components/scratch/ScratchPage";

type PageProps = {
  params: Promise<{ poolId: string }>;
};

const ScratchRoute: NextPage<PageProps> = ({ params }) => {
  const { poolId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c1323]" />}>
      <ScratchPage poolId={poolId} />
    </Suspense>
  );
};

export default ScratchRoute;
