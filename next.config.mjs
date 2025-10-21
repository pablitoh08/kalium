/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: true },
  async redirects() {
    return [{ source: '/', destination: '/incidencias', permanent: false }];
  },
};
export default nextConfig;
