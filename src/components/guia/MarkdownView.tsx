"use client"

/** Visor de Markdown compartido (manual y editor) con tipografía legible. */
import { renderMarkdown } from "@/lib/markdown"
import { cn } from "@/lib/utils"

export function MarkdownView({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  const html = renderMarkdown(markdown)

  return (
    <div
      className={cn("text-sm leading-relaxed text-foreground", className)}
      // El HTML se genera escapando el texto de entrada (ver src/lib/markdown.ts).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
