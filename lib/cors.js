const allowedOrigins = [
  "http://localhost:3000",
  "https://queuecare-beige.vercel.app",
  "https://queuecareapp.vercel.app",
];

export function getCorsHeaders(origin) {
  if (allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
  }
  return {};
}

export function withCors(response, origin) {
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}