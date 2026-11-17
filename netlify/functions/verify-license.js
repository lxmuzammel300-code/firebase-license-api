
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "License API is running",
      status: "READY"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
};

export const config = {
  path: "/api/verify-license"
};
  
