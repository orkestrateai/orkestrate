import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { authenticateRequestUser } from "@/lib/auth-user-request";

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Optional: add auth if needed
    // const user = await authenticateRequestUser(req);

    // Using git show to get the content of the file from the HEAD commit
    // This is safer as it respects the git state
    const { stdout } = await execAsync(`git show HEAD:"${path}"`);

    return NextResponse.json({ 
        content: stdout,
        path: path
    }, { 
        headers: { "Cache-Control": "no-store" } 
    });
  } catch (error) {
    console.error("Git file read error:", error);
    return NextResponse.json({ 
        error: "File not found or error reading file", 
        detail: error instanceof Error ? error.message : String(error) 
    }, { status: 404 });
  }
}
