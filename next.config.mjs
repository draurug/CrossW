/** @type {import('next').NextConfig} */
const nextConfig = {
  // Сайт полностью статический: ни сервера, ни базы. `next build` кладёт готовые
  // файлы в out/, их можно отдать откуда угодно.
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  // Со статическим экспортом ссылки должны вести на каталоги: /krossvord/mim-1/
  trailingSlash: true,
}

export default nextConfig
