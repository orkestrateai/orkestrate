import { statSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const objectsDir = ".git/objects";
let files: { path: string, size: number, hash: string }[] = [];

function walk(dir: string) {
    if (dir.includes("pack") || dir.includes("info")) return; // skip packs
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.length !== 38) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else {
            const size = statSync(fullPath).size;
            const hash = dir.slice(-2) + entry.name;
            files.push({ path: fullPath, size, hash });
        }
    }
}

walk(objectsDir);
files.sort((a, b) => b.size - a.size);
console.log("Largest loose objects:");

const topFiles = files.slice(0, 5);
const hashes = topFiles.map(f => f.hash);

const revListOutput = execSync("git rev-list --objects --all").toString().split("\n");

for (let i = 0; i < topFiles.length; i++) {
    const file = topFiles[i];
    const match = revListOutput.find(line => line.startsWith(file.hash));
    const name = match ? match.split(" ")[1] || "(root/tree)" : "unknown";
    console.log(`${file.hash} - ${(file.size / 1024 / 1024).toFixed(2)} MB - ${name}`);
}
