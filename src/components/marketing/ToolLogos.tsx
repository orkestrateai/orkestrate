import { Marquee } from "@/components/ui/marquee"
import { cn } from "@/lib/utils"
import { Antigravity, ClaudeCode, OpenCode, OpenClaw, Codex } from "@lobehub/icons"

const logos = {
  githubcopilot: "https://cdn.simpleicons.org/githubcopilot/white",
  cursor: "https://cdn.simpleicons.org/cursor/white",
  zed: "https://cdn.simpleicons.org/zedindustries/white",
}

const aiTools = [
  { name: "Codex", icon: <Codex size={20} /> },
  { name: "Claude Code", icon: <ClaudeCode size={20} /> },
  { name: "OpenCode", icon: <OpenCode size={20} /> },
  { name: "Zed", logo: logos.zed },
  { name: "Antigravity", icon: <Antigravity size={20} /> },
  { name: "Cursor", logo: logos.cursor },
  { name: "GitHub Copilot", logo: logos.githubcopilot },
  { name: "OpenClaw", icon: <OpenClaw size={20} /> },
]

export function Logos() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-14">
      <div className="mb-8 text-center">
        <p className="text-[10px] tracking-[0.2rem] text-white/30 uppercase">
          Supported Tools
        </p>
      </div>
      <Marquee pauseOnHover className="[--duration:40s] [--gap:5rem]">
        {aiTools.map((tool) => (
          <div
            key={tool.name}
            className={cn(
              "relative flex items-center justify-center gap-3 px-4 opacity-40 transition-all duration-300 hover:opacity-100 grayscale hover:grayscale-0"
            )}
          >
            {tool.logo ? (
              <img
                src={tool.logo}
                alt={tool.name}
                className="size-5 object-contain"
              />
            ) : (
              tool.icon
            )}
            <span className="text-[13px] font-bold tracking-tight text-white/90 whitespace-nowrap">
              {tool.name}
            </span>
          </div>
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-[#030303] to-transparent"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-[#030303] to-transparent"></div>
    </div>
  )
}