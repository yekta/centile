import {
  componentRequiresNewLine,
  isDev,
} from "@/app/[username]/_lib/constants";
import { getCards, getDashboard, getUser } from "@/app/[username]/_lib/helpers";
import { TValuesEntry } from "@/app/[username]/_lib/types";
import BananoTotalCard, {
  bananoCmcId,
} from "@/components/cards/banano-total-card";
import CryptoCard from "@/components/cards/crypto-card";
import CryptoTableCard from "@/components/cards/crypto-table-card";
import EthereumGasCard from "@/components/cards/ethereum-gas-card";
import FearGreedIndexCard from "@/components/cards/fear-greed-index-card";
import FiatCurrencyCard from "@/components/cards/fiat-currency-card";
import MiniCryptoCard from "@/components/cards/mini-crypto-card";
import NanoBananoCard from "@/components/cards/nano-banano-card";
import OhlcvChartCard, {
  TOhlcvChartConfig,
} from "@/components/cards/ohlcv-chart-card";
import OrderBookCard, {
  TOrderBookConfig,
} from "@/components/cards/order-book-card";
import UniswapPoolsTableCard from "@/components/cards/uniswap-pools-table-card";
import UniswapPositionCard from "@/components/cards/uniswap-position-card";
import WBanSummaryCard from "@/components/cards/wban-summary-card";
import DashboardWrapper from "@/components/dashboard-wrapper";
import CmcCryptoInfosProvider from "@/components/providers/cmc/cmc-crypto-infos-provider";
import CmcGlobalMetricsProvider from "@/components/providers/cmc/cmc-global-metrics-provider";
import CurrencyPreferenceProvider, {
  TCurrencyPreference,
} from "@/components/providers/currency-preference-provider";
import FiatCurrencyRateProvider from "@/components/providers/fiat-currency-rates-provider";
import NanoBananoBalancesProvider, {
  TNanoBananoAccountFull,
} from "@/components/providers/nano-banano-balance-provider";
import { Button } from "@/components/ui/button";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { siteTitle } from "@/lib/constants";
import { TEthereumNetwork } from "@/trpc/api/routers/ethereum/types";
import { TAvailableExchange } from "@/trpc/api/routers/exchange/types";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReactNode } from "react";

type Props = {
  params: Promise<{ dashboard_slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dashboard_slug } = await params;

  const { userId: userIdRaw } = await auth();
  if (!userIdRaw)
    return { title: `Not Found | ${siteTitle}`, description: "Not found." };

  let userId = userIdRaw;
  if (isDev) {
    const uids = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.devId, userId));
    userId = uids[0].id;
  }

  const dashboardObject = await getDashboard({
    userId,
    dashboardSlug: dashboard_slug,
  });

  if (dashboardObject === null)
    return { title: `Not Found | ${siteTitle}`, description: "Not found." };

  return {
    title: `${dashboardObject.dashboard.title} | ${dashboardObject.user.username} | ${siteTitle}`,
    description: dashboardObject.dashboard.title,
  };
}

export default async function Page({ params }: Props) {
  const start = Date.now();
  let current = Date.now();
  const { userId: userIdRaw } = await auth();
  if (!userIdRaw) return notFound();

  console.log(`[dashboard_slug] | Auth | ${Date.now() - current}ms`);
  current = Date.now();

  let userId = userIdRaw;
  if (isDev) {
    const uids = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.devId, userId));
    userId = uids[0].id;
  }

  console.log(`[dashboard_slug] | isDev | ${Date.now() - current}ms`);
  current = Date.now();

  const { dashboard_slug } = await params;
  const [cards, dashboard] = await Promise.all([
    getCards({ userId, dashboardSlug: dashboard_slug }),
    getDashboard({ userId, dashboardSlug: dashboard_slug }),
  ]);

  console.log(
    `[dashboard_slug] | getCards and getDashboard | ${Date.now() - current}ms`
  );
  current = Date.now();

  if (!dashboard) {
    const user = await getUser({ userId });
    console.log(`[dashboard_slug] | getUser | ${Date.now() - current}ms`);

    if (user === null) return notFound();
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-5 pb-[calc(5vh+1.5rem)] text-center break-words">
        <h1 className="font-bold text-8xl max-w-full">404</h1>
        <h1 className="text-muted-foreground text-xl max-w-full">
          This dashboard doesn't exist.
        </h1>
        <Button asChild>
          <Link href={`/${user.username}/main`} className="mt-8 max-w-full">
            Return Home
          </Link>
        </Button>
      </div>
    );
  }

  const cryptoCurrencyIds = cards
    .filter(
      (c) => c.card_type.id === "crypto" || c.card_type.id === "mini_crypto"
    )
    .map((c) => {
      const values = c.card.values as TValuesEntry[];
      if (!values) return undefined;
      return values.find((v) => v.id === "coin_id")?.value;
    })
    .filter((v) => v !== undefined)
    .map((v) => Number(v));

  const fiatCurrencyTickers = cards
    .filter((c) => c.card_type.id === "fiat_currency")
    .map((c) => {
      const values = c.card.values as TValuesEntry[];
      if (!values) return undefined;
      const base = values.find((v) => v.id === "ticker_base")?.value;
      const quote = values.find((v) => v.id === "ticker_quote")?.value;
      if (!base || !quote) return undefined;
      return `${base}/${quote}`;
    })
    .filter((v) => v !== undefined)
    .map((v) => v as string);

  const nanoBananoAccounts: TNanoBananoAccountFull[] = cards
    .filter(
      (c) =>
        c.card_type.id === "nano_balance" || c.card_type.id === "banano_balance"
    )
    .map((c) => {
      const values = c.card.values as TValuesEntry[];
      if (!values) return undefined;
      const address = values.find((v) => v.id === "address")?.value;
      const isOwner = values.find((v) => v.id === "is_owner")?.value;
      if (!address || !isOwner) return undefined;
      return {
        address,
        isOwner: isOwner === "true",
      };
    })
    .filter((v) => v !== undefined);

  let cardObjectsAndDividers: ((typeof cards)[number] | "divider")[] = [];

  cards.forEach((card, index) => {
    const requiresNewLine = componentRequiresNewLine.includes(
      card.card_type.id
    );
    const differentThanPrevious =
      index !== 0 && cards[index - 1].card_type.id !== card.card_type.id;
    if (requiresNewLine && differentThanPrevious) {
      cardObjectsAndDividers.push("divider");
    }
    cardObjectsAndDividers.push(card);
  });

  if (cards.length === 0) {
    return <DashboardWrapper>Add a Card</DashboardWrapper>;
  }

  const cardObject = cards[0];
  const currencyPreference: TCurrencyPreference = {
    primary: cardObject.primary_currency,
    secondary: cardObject.secondary_currency,
    tertiary: cardObject.tertiary_currency,
  };

  console.log("[dashboard_slug] | Total:", Date.now() - start);

  return (
    <DashboardWrapper>
      <Providers
        cardTypeIds={cards.map((c) => c.card.cardTypeId)}
        nanoBananoAccounts={nanoBananoAccounts}
        cryptoCurrencyIds={cryptoCurrencyIds}
        fiatCurrencyTickers={fiatCurrencyTickers}
        currencyPreference={currencyPreference}
      >
        {cardObjectsAndDividers.map((cardObjectOrDivider, index) => {
          if (cardObjectOrDivider === "divider") {
            return <div key={`divider-${index}`} className="w-full" />;
          }
          const cardObject = cardObjectOrDivider;
          if (cardObject.card.cardTypeId === "fear_greed_index") {
            return <FearGreedIndexCard key={cardObject.card.id} />;
          }
          if (cardObject.card.cardTypeId === "wban_summary") {
            return <WBanSummaryCard key={cardObject.card.id} />;
          }
          if (cardObject.card.cardTypeId === "orderbook") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const exchange = values.find((v) => v.id === "exchange")?.value;
            const tickerBase = values.find((v) => v.id === "ticker_base")
              ?.value;
            const tickerQuote = values.find((v) => v.id === "ticker_quote")
              ?.value;
            if (!exchange || !tickerBase || !tickerQuote) return null;
            const config: TOrderBookConfig = {
              exchange: exchange as TAvailableExchange,
              limit: 10,
              ticker: `${tickerBase}/${tickerQuote}`,
            };
            return <OrderBookCard key={cardObject.card.id} config={config} />;
          }

          if (cardObject.card.cardTypeId === "ohlcv_chart") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const exchange = values.find((v) => v.id === "exchange")?.value;
            const tickerBase = values.find((v) => v.id === "ticker_base")
              ?.value;
            const tickerQuote = values.find((v) => v.id === "ticker_quote")
              ?.value;
            if (!exchange || !tickerBase || !tickerQuote) return null;
            const config: TOhlcvChartConfig = {
              exchange: exchange as TAvailableExchange,
              ticker: `${tickerBase}/${tickerQuote}`,
            };
            return <OhlcvChartCard key={cardObject.card.id} config={config} />;
          }

          if (cardObject.card.cardTypeId === "uniswap_position") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const network = values.find((v) => v.id === "network")?.value;
            const positionId = values.find((v) => v.id === "position_id")
              ?.value;
            if (!network || !positionId) return null;
            return (
              <UniswapPositionCard
                key={cardObject.card.id}
                id={Number(positionId)}
                network={network as TEthereumNetwork}
              />
            );
          }

          if (cardObject.card.cardTypeId === "mini_crypto") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const coinId = values.find((v) => v.id === "coin_id")?.value;
            if (!coinId) return null;
            return (
              <MiniCryptoCard key={cardObject.card.id} id={Number(coinId)} />
            );
          }

          if (cardObject.card.cardTypeId === "crypto") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const coinId = values.find((v) => v.id === "coin_id")?.value;
            if (!coinId) return null;
            return (
              <CryptoCard
                key={cardObject.card.id}
                config={{ id: Number(coinId) }}
              />
            );
          }

          if (cardObject.card.cardTypeId === "fiat_currency") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const base = values.find((v) => v.id === "ticker_base")?.value;
            const quote = values.find((v) => v.id === "ticker_quote")?.value;
            if (!base || !quote) return null;
            return (
              <FiatCurrencyCard
                key={cardObject.card.id}
                ticker={`${base}/${quote}`}
              />
            );
          }

          if (cardObject.card.cardTypeId === "uniswap_pools_table") {
            return <UniswapPoolsTableCard key={cardObject.card.id} />;
          }

          if (cardObject.card.cardTypeId === "crypto_table") {
            return <CryptoTableCard key={cardObject.card.id} />;
          }

          if (
            cardObject.card.cardTypeId === "nano_balance" ||
            cardObject.card.cardTypeId === "banano_balance"
          ) {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const address = values.find((v) => v.id === "address")?.value;
            if (!address) return null;
            return (
              <NanoBananoCard
                key={cardObject.card.id}
                account={{ address: address }}
              />
            );
          }

          if (cardObject.card.cardTypeId === "gas_tracker") {
            const values = cardObject.card.values as TValuesEntry[];
            if (!values) return null;
            const network = values.find((v) => v.id === "network")?.value;
            if (!network) return null;
            return (
              <EthereumGasCard
                key={cardObject.card.id}
                network={network as TEthereumNetwork}
              />
            );
          }

          if (cardObject.card.cardTypeId === "banano_total") {
            return <BananoTotalCard key={cardObject.card.id} />;
          }

          return null;
        })}
      </Providers>
    </DashboardWrapper>
  );
}

function Providers({
  cardTypeIds,
  cryptoCurrencyIds,
  fiatCurrencyTickers,
  children,
  nanoBananoAccounts,
  currencyPreference,
}: {
  cardTypeIds: string[];
  cryptoCurrencyIds: number[];
  fiatCurrencyTickers: string[];
  children: ReactNode;
  nanoBananoAccounts: TNanoBananoAccountFull[];
  currencyPreference: TCurrencyPreference;
}) {
  let wrappedChildren = children;
  if (
    cardTypeIds.includes("fiat_currency") ||
    cardTypeIds.includes("banano_total_balance")
  ) {
    wrappedChildren = (
      <FiatCurrencyRateProvider tickers={fiatCurrencyTickers}>
        {wrappedChildren}
      </FiatCurrencyRateProvider>
    );
  }
  if (cardTypeIds.includes("fear_greed_index")) {
    wrappedChildren = (
      <CmcGlobalMetricsProvider>{wrappedChildren}</CmcGlobalMetricsProvider>
    );
  }

  if (cryptoCurrencyIds.length > 0) {
    let extraIds = [];
    if (cardTypeIds.includes("banano_total")) {
      extraIds.push(bananoCmcId);
    }
    let idsWithExtras = cryptoCurrencyIds;
    extraIds.forEach(
      (id) => !idsWithExtras.includes(id) && idsWithExtras.push(id)
    );
    wrappedChildren = (
      <CmcCryptoInfosProvider cryptos={idsWithExtras.map((c) => ({ id: c }))}>
        {wrappedChildren}
      </CmcCryptoInfosProvider>
    );
  }
  if (
    cardTypeIds.includes("nano_balance") ||
    cardTypeIds.includes("banano_balance") ||
    cardTypeIds.includes("banano_total_balance")
  ) {
    wrappedChildren = (
      <NanoBananoBalancesProvider accounts={nanoBananoAccounts}>
        {wrappedChildren}
      </NanoBananoBalancesProvider>
    );
  }

  // General wrappers
  wrappedChildren = (
    <CurrencyPreferenceProvider currencyPreference={currencyPreference}>
      {wrappedChildren}
    </CurrencyPreferenceProvider>
  );
  return wrappedChildren;
}
