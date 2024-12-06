import "server-only";
import crypto from "crypto";

import { env } from "@/lib/env";
import { db } from "@/server/db/db";
import {
  accountsTable,
  authenticatorsTable,
  sessionsTable,
  usersTable,
  verificationTokensTable,
} from "@/server/db/schema";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { DefaultSession } from "next-auth";
import type { Provider as AuthProvider } from "next-auth/providers";
import CredentialsProvider from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import { cache } from "react";
import { SiweMessage } from "siwe";
import { createUser, getUser } from "@/server/db/repo/user";
import { encode as defaultEncode } from "next-auth/jwt";
import { cookies, headers } from "next/headers";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

let authProviders: AuthProvider[] = [];
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  authProviders.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
  authProviders.push(Discord({}));
}

authProviders.push(
  CredentialsProvider({
    name: "Ethereum",
    credentials: {
      message: {
        label: "Message",
        type: "text",
        placeholder: "0x0",
      },
      signature: {
        label: "Signature",
        type: "text",
        placeholder: "0x0",
      },
    },
    async authorize(credentials) {
      try {
        console.log("[AUTHORIZE]: before cookies");
        const cookiesObj = await cookies();
        console.log("[AUTHORIZE]: after cookies");

        const csrf = cookiesObj.get("authjs.csrf-token");
        const csrfTokenRaw = csrf ? decodeURI(csrf.value) : null;
        console.log("[AUTHORIZE]: before CSRF");
        if (!csrfTokenRaw) return null;
        const csrfArr = csrfTokenRaw?.split("|");
        if (!csrfArr || csrfArr.length < 1) return null;
        const csrfToken = csrfArr[0];
        if (!csrfToken) return null;

        console.log("[AUTHORIZE]: after CSRF");

        const siwe = new SiweMessage(
          JSON.parse((credentials?.message as string) || "{}")
        );
        const nextAuthUrl = new URL(env.AUTH_URL);

        console.log("[AUTHORIZE]: before SIWE");

        const result = await siwe.verify({
          signature: (credentials?.signature as string) || "",
          domain: nextAuthUrl.host,
          nonce: csrfToken,
        });

        if (!result.success) {
          return null;
        }

        console.log("[AUTHORIZE]: before ethereumAddressToUUID");

        const id = ethereumAddressToUUID(siwe.address);

        console.log("[AUTHORIZE]: after ethereumAddressToUUID");
        let user = await getUser({ userId: id });

        if (!user) {
          await createUser({
            userId: id,
            name: siwe.address,
            ethereumAddress: siwe.address,
          });
          user = await getUser({ userId: id });
        }

        if (!user) {
          return null;
        }

        return user;
      } catch (e) {
        return null;
      }
    },
  })
);

const adapter = DrizzleAdapter(db, {
  usersTable: usersTable,
  accountsTable: accountsTable,
  authenticatorsTable: authenticatorsTable,
  sessionsTable: sessionsTable,
  verificationTokensTable: verificationTokensTable,
});

const {
  auth: uncachedAuth,
  handlers,
  signIn,
  signOut,
} = NextAuth({
  providers: authProviders,
  adapter,
  callbacks: {
    session: ({ session, user }) => {
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      };
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
  },
  jwt: {
    encode: async function (params) {
      if (params.token?.credentials) {
        const sessionToken = crypto.randomUUID();

        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }

        const createdSession = await adapter?.createSession?.({
          sessionToken: sessionToken,
          userId: params.token.sub,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        if (!createdSession) {
          throw new Error("Failed to create session");
        }

        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
  },
});

export const authProviderMap = authProviders
  .map((provider) => {
    if (typeof provider === "function") {
      const providerData = provider();
      return { id: providerData.id, name: providerData.name };
    } else {
      return { id: provider.id, name: provider.name };
    }
  })
  .filter((provider) => provider.id !== "credentials");

const auth = cache(uncachedAuth);

function ethereumAddressToUUID(ethAddress: string): string {
  // Normalize the Ethereum address to lowercase to handle case-insensitivity
  const normalizedAddress = ethAddress.toLowerCase();

  // Hash the normalized address using SHA-256
  const hash = crypto.createHash("sha256").update(normalizedAddress).digest();

  // Construct a UUID v4 from the hash
  const uuid = [
    // First 8 hex characters
    hash.toString("hex").substring(0, 8),
    // Next 4 hex characters
    hash.toString("hex").substring(8, 12),
    // Next 4 hex characters, ensuring the version is 4
    (
      (parseInt(hash.toString("hex").substring(12, 16), 16) & 0x0fff) |
      0x4000
    ).toString(16),
    // Next 4 hex characters, ensuring the variant is 0b10xx
    (
      (parseInt(hash.toString("hex").substring(16, 18), 16) & 0x3f) |
      0x80
    ).toString(16) + hash.toString("hex").substring(18, 20),
    // Final 12 hex characters
    hash.toString("hex").substring(20, 32),
  ].join("-");

  return uuid;
}

export { auth, handlers, signIn, signOut };
