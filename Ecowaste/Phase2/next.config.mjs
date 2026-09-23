/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    experimental: {
        // Tree-shake lucide-react: only bundle icons actually used, not all 1000+
        optimizePackageImports: ['lucide-react'],
    },
};

export default nextConfig;