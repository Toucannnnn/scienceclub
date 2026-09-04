import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      // /book used to be the guest-only slot list; the calendar replaced it
      // and is now public for everyone. Cancellation emails already sent to
      // guests link to /book, so keep it pointed somewhere useful.
      { source: "/book", destination: "/calendar", permanent: true },
    ];
  },
};

export default nextConfig;
