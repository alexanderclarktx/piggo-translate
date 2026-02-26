const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
}

export const httpJson = (data: unknown) => Response.json(data, {
  status: 200,
  headers: corsHeaders
})

export const httpText = (text: string, status = 200) => new Response(text, {
  status,
  headers: corsHeaders
})
