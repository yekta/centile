import { z } from "zod";

import { cmcApiUrl } from "@/server/trpc/api/routers/cmc/constants";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import {
  TCmcGetCryptosResult,
  TCmcGetCryptosResultEdited,
} from "@/server/trpc/api/routers/cmc/types";
import { cmcFetchOptions } from "@/server/trpc/api/routers/cmc/secrets";

export const cmcRouter = createTRPCRouter({
  getCryptoInfos: publicProcedure
    .input(
      z.object({
        ids: z.array(z.number()),
        convert: z.array(z.string()).optional().default(["USD"]),
      })
    )
    .query(async ({ input: { ids, convert } }) => {
      const idsStr = ids.join(",");
      const urls = convert.map(
        (c) =>
          `${cmcApiUrl}/v2/cryptocurrency/quotes/latest?id=${idsStr}&convert=${c}`
      );
      const responses = await Promise.all(
        urls.map((url) => fetch(url, cmcFetchOptions))
      );

      const results: TCmcGetCryptosResult[] = await Promise.all(
        responses.map((r) => r.json())
      );

      results.forEach((r) => {
        if (!r.data) {
          console.log(r);
          throw new Error("Failed to fetch CMC crypto infos");
        }
      });

      let editedResult: TCmcGetCryptosResultEdited = {};
      const firstResult = results[0];
      for (const key in firstResult.data) {
        const quoteObj: TCmcGetCryptosResultEdited[number]["quote"] = {};
        for (const result of results) {
          const quote = result.data[key].quote;
          for (const currency in quote) {
            quoteObj[currency] = quote[currency];
          }
        }
        editedResult[key] = {
          ...firstResult.data[key],
          quote: quoteObj,
        };
      }
      return editedResult;
    }),
  getGlobalMetrics: publicProcedure
    .input(
      z.object({
        convert: z.string().optional().default("USD"),
      })
    )
    .query(async ({ input: { convert } }) => {
      const fearAndGreedUrl = `${cmcApiUrl}/v3/fear-and-greed/latest`;
      const metricsUrl = `${cmcApiUrl}/v1/global-metrics/quotes/latest?convert=${convert}`;

      const fearGreedIndexPromise = fetch(fearAndGreedUrl, cmcFetchOptions);
      const metricsPromise = fetch(metricsUrl, cmcFetchOptions);

      const [fearGreedIndexResponse, metricsResponse] = await Promise.all([
        fearGreedIndexPromise,
        metricsPromise,
      ]);

      if (!fearGreedIndexResponse.ok) {
        throw new Error(
          `${fearGreedIndexResponse.status}: Failed to fetch CMC Fear and Greed Index`
        );
      }
      if (!metricsResponse.ok) {
        throw new Error(
          `${metricsResponse.status}: Failed to fetch CMC Global Metrics`
        );
      }

      const [fearGreedIndexData, metricsData]: [
        TCmcFearGreedIndexResult,
        TCmcGlobalMetricsResult,
      ] = await Promise.all([
        fearGreedIndexResponse.json(),
        metricsResponse.json(),
      ]);

      return {
        fear_greed_index: fearGreedIndexData.data,
        btc_dominance: metricsData.data.btc_dominance,
        eth_dominance: metricsData.data.eth_dominance,
        ...metricsData.data.quote[convert],
      };
    }),
  getCoinList: publicProcedure
    .input(
      z.object({
        convert: z.string().optional().default("USD"),
        page: z.number().int().positive().default(0),
      })
    )
    .query(async ({ input: { convert, page } }) => {
      const limit = 100;
      const start = ((page || 1) - 1) * limit + 1;
      const coinListUrl = `${cmcApiUrl}/v1/cryptocurrency/listings/latest?convert=${convert}&limit=100&start=${start}`;
      const coinListPromise = fetch(coinListUrl, cmcFetchOptions);
      const [coinListResponse] = await Promise.all([coinListPromise]);

      const [coinListJson]: [TCmcCoinListResult] = await Promise.all([
        coinListResponse.json(),
      ]);

      if (!coinListResponse.ok) {
        throw new Error(
          `${coinListResponse.status}: Failed to fetch CMC coin list`
        );
      }

      return {
        coin_list: coinListJson.data,
      };
    }),
});

type TCmcFearGreedIndexResult = {
  data: {
    value: number;
    value_classification: string;
    timestamp: string;
  };
};

type TCmcGlobalMetricsResult = {
  data: {
    btc_dominance: number;
    eth_dominance: number;
    quote: {
      [key: string]: {
        total_market_cap: number;
        total_volume_24h: number;
        last_updated: string;
        total_market_cap_yesterday: number;
        total_market_cap_yesterday_percentage_change: number;
      };
    };
  };
};

type TCmcCoinListResult = {
  data: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    num_market_pairs: number;
    date_added: string;
    tags: string[];
    max_supply: number;
    circulating_supply: number;
    total_supply: number;
    platform: string | null;
    cmc_rank: number;
    last_updated: string;
    quote: {
      [key: string]: {
        price: number;
        volume_24h: number;
        percent_change_1h: number;
        percent_change_24h: number;
        percent_change_7d: number;
        market_cap: number;
        last_updated: string;
      };
    };
  }[];
};
