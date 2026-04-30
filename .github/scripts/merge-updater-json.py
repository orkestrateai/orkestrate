import json
import sys
from pathlib import Path

merged = {"version": "", "notes": "", "pub_date": "", "platforms": {}}

for dir_path in sorted(Path.cwd().glob("updater-json-*")):
    json_file = dir_path / "latest.json"
    if json_file.exists():
        plat = json.loads(json_file.read_text())
        merged["version"] = plat.get("version", merged["version"])
        merged["notes"] = plat.get("notes", merged["notes"])
        merged["pub_date"] = plat.get("pub_date", merged["pub_date"])
        merged["platforms"].update(plat.get("platforms", {}))

output = Path(sys.argv[1])
output.write_text(json.dumps(merged, indent=2))
print("Merged platforms:", list(merged["platforms"].keys()))
