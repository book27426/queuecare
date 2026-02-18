/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // เราจะเอาคำว่า /api ออกจาก destination แล้วไปใส่ใน fetch แทนเพื่อความชัวร์
        source: '/api-proxy/:path*',
        destination: 'https://queuecare-beige.vercel.app/:path*', 
      },
    ];
  },
};

export default nextConfig;