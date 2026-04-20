import { use } from "react";
import type { NextPage } from "next";
import { PoolDetailPage } from "~~/components/pool-detail/PoolDetailPage";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const PoolDetailRoute: NextPage<PageProps> = ({ params }) => {
  const { id } = use(params);
  return <PoolDetailPage poolId={id} />;
};

export default PoolDetailRoute;
