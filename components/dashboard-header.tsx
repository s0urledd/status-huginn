import { Github } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <a href="https://huginn.tech" className="flex items-center gap-2.5">
          <img
            src="https://huginn.tech/logos/huginn-logo.png"
            alt=""
            className="size-7 rounded-md"
          />
          <span className="text-sm font-semibold tracking-tight">Huginn</span>
          <span className="text-sm text-muted-foreground">Status</span>
        </a>

        <nav className="flex items-center gap-1">
          <a
            href="https://monval.huginn.tech/dashboard"
            className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Monval
          </a>
          <a
            href="https://github.com/Huginn-tech"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Github className="size-4" />
          </a>
        </nav>
      </div>
    </header>
  )
}
