import type { NextApiRequest, NextApiResponse } from "next";
import workspacesHandler from "./workspaces";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    return workspacesHandler(req, res);
}
