"use client";

import { use } from "react";
import type { NextPage } from "next";
import { PurchasePage } from "~~/components/purchase/PurchasePage";

type PageProps = {
  params: Promise<{ poolId: string }>;
};

const PurchaseRoute: NextPage<PageProps> = ({ params }) => {
  const { poolId } = use(params);
  return <PurchasePage poolId={poolId} />;
};

export default PurchaseRoute;
