import { z } from "zod";

import {
  createCard,
  deleteCards,
  getCards,
  getMaximumCardXOrder,
  reorderCards,
} from "@/server/db/repo/card";
import { getCardTypes } from "@/server/db/repo/card_types";
import { createCardValues } from "@/server/db/repo/card_values";
import { getCurrencies } from "@/server/db/repo/currencies";
import {
  createDashboard,
  getDashboard,
  getDashboards,
  getMaximumDashboardXOrder,
  isDashboardSlugAvailable,
  renameDashboard,
} from "@/server/db/repo/dashboard";
import { getUser } from "@/server/db/repo/user";
import { CardValueForAddCardsSchema } from "@/server/trpc/api/ui/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { Session } from "next-auth";
import { cleanAndSortArray } from "@/server/redis/cache-utils";

function getIsOwner({
  session,
  username,
}: {
  session: Session | null;
  username: string;
}) {
  return session ? session.user.username === username : false;
}

export const uiRouter = createTRPCRouter({
  getDashboard: publicProcedure
    .input(
      z.object({
        username: z.string(),
        dashboardSlug: z.string(),
      })
    )
    .query(async function ({
      input: { username, dashboardSlug },
      ctx: { session },
    }) {
      const isOwner = getIsOwner({ session, username });

      const result = await getDashboard({
        isOwner,
        username,
        dashboardSlug,
      });

      return result;
    }),
  getDashboards: publicProcedure
    .input(
      z.object({
        username: z.string(),
      })
    )
    .query(async function ({ input: { username }, ctx: { session } }) {
      const isOwner = getIsOwner({ session, username });

      const result = await getDashboards({
        isOwner,
        username,
      });

      return {
        dashboards: result,
        isOwner,
      };
    }),
  getCards: publicProcedure
    .input(
      z.object({
        username: z.string(),
        dashboardSlug: z.string(),
      })
    )
    .query(async function ({
      input: { username, dashboardSlug },
      ctx: { session },
    }) {
      const isOwner = getIsOwner({ session, username });

      const [result, dashboard] = await Promise.all([
        getCards({
          isOwner,
          username,
          dashboardSlug,
        }),
        getDashboard({
          isOwner,
          username,
          dashboardSlug,
        }),
      ]);

      let currencyIdsForFetch: string[] = [];
      result.forEach((cardObj, index) => {
        if (cardObj.cardType.id === "calculator") {
          const values = cardObj.values;
          if (!values) return;
          values.forEach((v) => {
            if (v.cardTypeInputId !== "calculator_currency_id") return;
            currencyIdsForFetch.push(v.value);
          });
        }
        if (cardObj.cardType.id === "currency") {
          const values = cardObj.values;
          if (!values) return;
          values.forEach((v) => {
            if (
              v.cardTypeInputId !== "currency_currency_id_base" &&
              v.cardTypeInputId !== "currency_currency_id_quote"
            )
              return;
            currencyIdsForFetch.push(v.value);
          });
        }
      });

      const currencyIdsForFetchFinal = cleanAndSortArray(currencyIdsForFetch);
      const currencies = await getCurrencies({
        ids: currencyIdsForFetchFinal,
      });

      return {
        cards: result,
        currencies,
        dashboard,
      };
    }),
  getCurrencies: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
      })
    )
    .query(async function ({ input: { ids } }) {
      const res = await getCurrencies({
        ids: ids ? cleanAndSortArray(ids) : undefined,
      });
      return res;
    }),
  getCardTypes: publicProcedure
    .input(z.object({}))
    .query(async function ({ input: {} }) {
      const res = await getCardTypes();
      return res;
    }),
  createCard: publicProcedure
    .input(
      z.object({
        cardTypeId: z.string(),
        dashboardSlug: z.string(),
        xOrder: z.number().optional(),
        xOrderPreference: z.enum(["first", "last"]).optional(),
        values: z.array(CardValueForAddCardsSchema),
      })
    )
    .mutation(async function ({
      input: { cardTypeId, dashboardSlug, xOrder, values, xOrderPreference },
      ctx: { session },
    }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      // Get the dashboard
      const dashboard = await getDashboard({
        isOwner: true,
        username: session.user.username,
        dashboardSlug,
      });

      if (!dashboard) {
        throw new TRPCError({
          message: "Dashboard not found",
          code: "NOT_FOUND",
        });
      }

      let xOrderSelected = xOrder;
      if (xOrder === undefined && xOrderPreference === "first") {
        xOrderSelected = 0;
      } else if (xOrder === undefined) {
        const maximumXOrder = await getMaximumCardXOrder({
          dashboardId: dashboard.data.dashboard.id,
        });
        xOrderSelected = maximumXOrder + 1;
      }

      if (xOrderSelected === undefined) {
        throw new TRPCError({
          message: "Invalid xOrder",
          code: "BAD_REQUEST",
        });
      }

      // Create card
      const cardId = await createCard({
        cardTypeId,
        dashboardId: dashboard.data.dashboard.id,
        xOrder: xOrderSelected,
      });

      if (values.length > 0) {
        // Create card values
        await createCardValues({
          values: values.map((v) => ({
            ...v,
            cardId,
          })),
        });
      }

      return {
        cardId,
        cardTypeId,
      };
    }),
  deleteCards: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
      })
    )
    .mutation(async function ({ input: { ids }, ctx: { session } }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      await deleteCards({ userId: session.user.id, ids });
      return true;
    }),
  reorderCards: publicProcedure
    .input(
      z.object({
        orderObjects: z.array(z.object({ id: z.string(), xOrder: z.number() })),
      })
    )
    .mutation(async function ({ input: { orderObjects }, ctx: { session } }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      await reorderCards({ userId: session.user.id, orderObjects });
      return true;
    }),
  createDashboard: publicProcedure
    .input(
      z.object({
        title: z
          .string()
          .min(2, {
            message: "Dashboard name should be at least 2 characters.",
          })
          .max(32, {
            message: "Dashboard name should be at most 32 characters.",
          }),
        icon: z.string().optional(),
        xOrder: z.number().optional(),
      })
    )
    .mutation(async function ({
      input: { title, icon, xOrder },
      ctx: { session },
    }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      let slug = slugify(title);
      const [isAvailable, maximumXOrder] = await Promise.all([
        isDashboardSlugAvailable({
          slug,
          userId: session.user.id,
        }),
        getMaximumDashboardXOrder({ userId: session.user.id }),
      ]);

      if (!isAvailable) {
        slug = addRandomStringToSlug(slug);
      }

      const dashboardId = await createDashboard({
        userId: session.user.id,
        slug,
        title,
        icon,
        xOrder: xOrder !== undefined ? xOrder : maximumXOrder + 1,
      });

      return {
        dashboardId,
        slug,
        title,
      };
    }),
  renameDashboard: publicProcedure
    .input(
      z.object({
        title: z
          .string()
          .max(32)
          .min(2, {
            message: "Dashboard name should be at least 2 characters.",
          })
          .max(32, {
            message: "Dashboard name should be at most 32 characters.",
          }),
        dashboardSlug: z.string(),
      })
    )
    .mutation(async function ({
      input: { title, dashboardSlug },
      ctx: { session },
    }) {
      if (!session || session.user.id === undefined) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      const result = await renameDashboard({
        title: title,
        slug: dashboardSlug,
        userId: session.user.id,
      });
      return result;
    }),
  getUser: publicProcedure.query(async function ({ ctx: { session } }) {
    if (!session || session.user.id === undefined) {
      throw new TRPCError({
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }
    const user = await getUser({ userId: session.user.id });
    return user;
  }),
});

function slugify(str: string) {
  return (
    str
      .toLowerCase()
      .trim()
      // First remove anything that isn't alphanumeric or spaces
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      // Replace multiple spaces with single space
      .replace(/\s+/g, " ")
      // Then replace spaces with hyphens
      .replace(/ /g, "-")
  );
}

function addRandomStringToSlug(slug: string) {
  const uuid = crypto.randomUUID();
  return `${slug}-${uuid.slice(0, 4)}`;
}