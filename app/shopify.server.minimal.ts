import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

// Minimal configuration - let Shopify handle everything
const prisma = new PrismaClient();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  isEmbeddedApp: true,
});

export default shopify;
export const authenticate = shopify.authenticate;
export const login = shopify.login;
export const unauthenticated = shopify.unauthenticated;