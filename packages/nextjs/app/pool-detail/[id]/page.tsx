import type { NextPage } from "next";
import { PoolDetailPage } from "~~/components/pool-detail/PoolDetailPage";

type PageProps = {
  params: {
    id: string;
  };
};

const PoolDetailRoute: NextPage<PageProps> = ({ params }) => {
  return <PoolDetailPage poolId={params.id} />;
};

export default PoolDetailRoute;
