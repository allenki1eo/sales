import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      signature_path?: string;
    };
  }
  interface User {
    role: string;
    signature_path?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    signature_path?: string;
  }
}
