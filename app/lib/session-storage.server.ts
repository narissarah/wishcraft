import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "~/lib/db.server";

export const sessionStorage = new PrismaSessionStorage(db);