module.exports = {};
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "YOUR_BUCKET.s3.ca-central-1.amazonaws.com",
        pathname: "/**",
      },

      // If your URLs look like: https://s3.ca-central-1.amazonaws.com/YOUR_BUCKET/...
      // uncomment this instead (or in addition)
      // {
      //   protocol: "https",
      //   hostname: "s3.ca-central-1.amazonaws.com",
      //   pathname: "/YOUR_BUCKET/**",
      // },
    ],
  },
};

module.exports = nextConfig;
