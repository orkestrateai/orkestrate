import type { NextApiRequest, NextApiResponse } from "next";
import { baseUrl, json } from "@/lib/http";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method Not Allowed" });
  }

  const base = baseUrl(req);
  return json(res, 200, {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    resource_documentation: `${base}/`,
  });
}
