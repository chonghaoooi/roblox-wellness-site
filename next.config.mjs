export default {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async rewrites() {
    return [{ source: "/doomsday", destination: "/doomsday/index.html" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "Link", value: '</llms.txt>; rel="describedby"; type="text/plain"' }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
};
