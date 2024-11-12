"use client";

import AsyncDataTable, {
  TAsyncDataTableColumnDef,
  TAsyncDataTablePage,
} from "@/components/ui/async-data-table";
import { defaultQueryOptions } from "@/lib/constants";
import { formatNumberTBMK } from "@/lib/number-formatters";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { RowData } from "@tanstack/react-table";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const convertCurrency = {
  ticker: "USD",
  symbol: "$",
};

type TData = {
  id: number;
  rank: number;
  name: string;
  slug: string;
  ticker: string;
  price: number;
  percentChange24h: number;
  percentChange7d: number;
  marketCap: number;
  volume: number;
};

const dataFallback: TData[] = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  rank: i + 1,
  name: "Bitcoin",
  slug: "bitcoin",
  ticker: "BTC",
  price: 1234,
  percentChange24h: 12,
  percentChange7d: 12,
  marketCap: 123456,
  volume: 123456,
}));

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    width: string;
  }
}

export default function CoinTableCard({ className }: { className?: string }) {
  const [page, setPage] = useState<TAsyncDataTablePage>({
    min: 1,
    max: 5,
    current: 1,
  });

  const { data, isLoadingError, isPending, isError, isRefetching } =
    api.cmc.getCoinList.useQuery(
      { convert: convertCurrency.ticker, page: page.current },
      defaultQueryOptions.slow
    );

  const dataOrFallback: TData[] = useMemo(() => {
    if (!data) return dataFallback;
    return data.coin_list.map((item) => ({
      id: item.id,
      rank: item.cmc_rank,
      name: item.name,
      slug: item.slug,
      ticker: item.symbol,
      price: item.quote[convertCurrency.ticker].price,
      percentChange24h: item.quote[convertCurrency.ticker].percent_change_24h,
      percentChange7d: item.quote[convertCurrency.ticker].percent_change_7d,
      marketCap: item.quote[convertCurrency.ticker].market_cap,
      volume: item.quote[convertCurrency.ticker].volume_24h,
    }));
  }, [data]);

  const columnDefs = useMemo<TAsyncDataTableColumnDef<TData>[]>(() => {
    return [
      {
        accessorKey: "name",
        isPinnedLeft: true,
        sortDescFirst: false,
        headerVariant: "regular",
        header: ({ header }) => "Name",
        headerAlignment: "start",
        cellVariant: "custom",
        cell: ({ row }) => (
          <NameColumn
            id={dataOrFallback[row.index].id}
            value={row.getValue("name")}
            ticker={dataOrFallback[row.index].ticker}
            rank={dataOrFallback[row.index].rank}
            slug={dataOrFallback[row.index].slug}
            isPending={isPending}
            hasData={!isLoadingError && data !== undefined}
          />
        ),
        sortingFn: (rowA, rowB, _columnId) => {
          const a = rowA.original.name;
          const b = rowB.original.name;
          if (a === undefined || b === undefined) return 0;
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "price",
        sortDescFirst: true,
        header: ({ header }) => "Price",
        cell: ({ row }) =>
          `${convertCurrency.symbol}${formatNumberTBMK(row.getValue("price"))}`,
      },
      {
        accessorKey: "percentChange24h",
        sortDescFirst: true,
        header: ({ header }) => "24H",
        cellVariant: "change",
        cell: ({ row }) => row.getValue("percentChange24h"),
        sortingFn: (rowA, rowB, _columnId) => {
          const a = rowA.original.percentChange24h;
          const b = rowB.original.percentChange24h;
          if (a === undefined || b === undefined) return 0;
          return a - b;
        },
      },
      {
        accessorKey: "percentChange7d",
        sortDescFirst: true,
        header: ({ header }) => "7D",
        sortingFn: (rowA, rowB, _columnId) => {
          const a = rowA.original.percentChange7d;
          const b = rowB.original.percentChange7d;
          if (a === undefined || b === undefined) return 0;
          return a - b;
        },
        cellVariant: "change",
        cell: ({ row }) => row.getValue("percentChange7d"),
      },
      {
        accessorKey: "marketCap",
        sortDescFirst: true,
        header: ({ header }) => "MC",
        cell: ({ row }) =>
          `${convertCurrency.symbol}${formatNumberTBMK(
            row.getValue("marketCap")
          )}`,
      },
      {
        accessorKey: "volume",
        sortDescFirst: true,
        header: ({ header }) => "Vol",
        cell: ({ row }) =>
          `${convertCurrency.symbol}${formatNumberTBMK(
            row.getValue("volume")
          )}`,
      },
    ];
  }, [data, isPending, isError, isLoadingError]);

  return (
    <div className={cn("flex flex-col p-1 group/card w-full", className)}>
      <AsyncDataTable
        className="h-167 max-h-[calc((100svh-3rem)*0.75)]"
        columnDefs={columnDefs}
        data={dataOrFallback}
        isError={isError}
        isPending={isPending}
        isLoadingError={isLoadingError}
        isRefetching={isRefetching}
        page={page}
        setPage={setPage}
      />
    </div>
  );
}

function NameColumn({
  hasData,
  isPending,
  slug,
  id,
  rank,
  value,
  ticker,
}: {
  hasData: boolean;
  isPending: boolean;
  slug: string;
  id: number;
  rank: number;
  value: string;
  ticker: string;
}) {
  const Comp = hasData ? Link : "div";
  const pendingClassesMuted = "";
  const pendingClasses =
    "group-data-[is-pending]/table:text-transparent group-data-[is-pending]/table:bg-foreground group-data-[is-pending]/table:rounded-sm group-data-[is-pending]/table:animate-skeleton";
  const paddingRight = "pr-2 md:pr-4";

  return (
    <Comp
      target="_blank"
      href={
        isPending
          ? "#"
          : hasData
            ? `https://coinmarketcap.com/currencies/${slug}`
            : "#"
      }
      className={cn(
        `pl-4 md:pl-5 ${paddingRight} group/link py-3.5 flex flex-row items-center gap-3.5 overflow-hidden`
      )}
    >
      <div className="flex flex-col items-center justify-center gap-1.5">
        {isPending ? (
          <div className="size-4.5 rounded-full shrink-0 bg-foreground animate-skeleton" />
        ) : hasData ? (
          <img
            src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`}
            className="size-4.5 shrink-0 rounded-full bg-foreground p-px"
          />
        ) : (
          <div className="size-4.5 rounded-full shrink-0 bg-destructive" />
        )}
        <div className={`w-6 overflow-hidden flex items-center justify-center`}>
          <p
            className={`${pendingClassesMuted} max-w-full overflow-hidden overflow-ellipsis text-xs leading-none font-medium text-muted-foreground text-center group-data-[is-loading-error]/table:text-destructive`}
          >
            {isPending ? "#" : hasData ? rank : "E"}
          </p>
        </div>
      </div>
      <div
        className={`flex-1 w-20 md:w-40 min-w-0 flex flex-col justify-center items-start gap-1.5 overflow-hidden`}
      >
        <div className="max-w-full flex items-center justify-start gap-1 md:gap-1.5">
          <p
            className={`${pendingClasses} shrink min-w-0 font-semibold text-xs md:text-sm md:leading-none leading-none whitespace-nowrap overflow-hidden overflow-ellipsis group-data-[is-loading-error]/table:text-destructive`}
          >
            {isPending ? "Loading" : hasData ? value : "Error"}
          </p>
          <ExternalLinkIcon
            className="opacity-0 shrink-0 origin-bottom-left scale-0 pointer-events-none size-3 md:size-4 -my-1 transition duration-100
              not-touch:group-data-[has-data]/table:group-hover/link:opacity-100 not-touch:group-data-[has-data]/table:group-hover/link:scale-100"
          />
        </div>
        <p
          className={`${pendingClassesMuted} max-w-full whitespace-nowrap overflow-hidden overflow-ellipsis text-muted-foreground leading-none text-xs group-data-[is-loading-error]/table:text-destructive`}
        >
          {isPending ? "Loading" : hasData ? ticker : "Error"}
        </p>
      </div>
    </Comp>
  );
}
