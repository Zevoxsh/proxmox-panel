declare global {
  var __consoleSessions: Map<
    string,
    {
      proxmoxWsUrl: string;
      proxmoxAuthCookie: string;
      sslVerify: boolean;
      expiresAt: number;
    }
  >;
}

export {};
