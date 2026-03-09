export async function withTimer(handler) {
  const start = performance.now();

  try {
    const response = await handler();
    const end = performance.now();
    const time = (end - start).toFixed(2);

    const body = await response.json();
    const newBody = {
      ...body,
      execution_time_ms: time
    };

    const headers = new Headers(response.headers);
    
    headers.set("content-type", "application/json");

    return new Response(JSON.stringify(newBody), {
      status: response.status,
      headers: headers // Use the Headers object, NOT a plain object
    });

  } catch (err) {
    const end = performance.now();

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal error",
        execution_time_ms: (end - start).toFixed(2)
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
}