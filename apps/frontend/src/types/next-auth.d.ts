import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      role: "ADMIN" | "USER";
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    tenantId?: string | null;
    role?: "ADMIN" | "USER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string | null;
    role?: "ADMIN" | "USER";
  }
}
