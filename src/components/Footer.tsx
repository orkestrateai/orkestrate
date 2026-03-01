export function Footer() {
    return (
        <footer className="relative z-10 border-t border-white/[0.06]">
            <div className="max-w-6xl mx-auto px-6 md:px-12">

                {/* Main footer content */}
                <div className="py-16 grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">

                    {/* Brand column */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2.5 mb-4">
                            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="shrink-0">
                                <path d="M8 13 C8 10.5, 10 9, 13 9 L17 9 C19.5 9, 21 10.5, 21 13 L21 16 C21 18.5, 19.5 19.5, 17 19.5 L14.5 19.5 L12 22 L12.5 19.5 L11 19.5 C9.5 19.5, 8 18.5, 8 16 Z" fill="#34d399" opacity="0.9" />
                                <path d="M12 14 C12 11.8, 13.8 10.5, 16 10.5 L20 10.5 C22.5 10.5, 24 11.8, 24 14 L24 17 C24 19, 22.5 20, 20 20 L19.5 20 L20 22.5 L17.5 20 L16 20 C13.8 20, 12 19, 12 17 Z" fill="currentColor" stroke="#34d399" strokeWidth="1.2" className="text-background" />
                                <circle cx="16.5" cy="15.5" r="1.2" fill="#34d399" />
                                <circle cx="19" cy="15.5" r="1.2" fill="#34d399" />
                                <circle cx="21.5" cy="15.5" r="1.2" fill="#34d399" />
                            </svg>
                            <span className="text-sm font-semibold tracking-widest uppercase">Orkestrate</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            Connect multiple AI coding agents to a shared workspace in real-time. Built on the MCP protocol.
                        </p>
                    </div>

                    {/* Product column */}
                    <div>
                        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">Product</h4>
                        <ul className="space-y-3">
                            <li><a href="#setup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Setup</a></li>
                            <li><a href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                            <li><a href="/changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Changelog</a></li>
                        </ul>
                    </div>

                    {/* Resources column */}
                    <div>
                        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">Resources</h4>
                        <ul className="space-y-3">
                            <li><a href="https://spec.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">MCP Specification</a></li>
                            <li><a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Claude Code</a></li>
                            <li><a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">OpenCode</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="py-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {["Next.js", "Supabase", "MCP", "OAuth 2.1"].map((tag) => (
                            <span key={tag} className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground/50 px-2 py-1 rounded border border-white/[0.04] bg-white/[0.02]">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground/50">
                        © {new Date().getFullYear()} Orkestrate
                    </p>
                </div>
            </div>
        </footer>
    );
}

