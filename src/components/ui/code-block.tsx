"use client"

import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"
import { Copy, Check, Download } from "lucide-react"
import { Button } from "./button"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
  title?: string
  language?: string
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ 
  children, 
  className, 
  title, 
  language, 
  filename,
  ...props 
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip my-6 rounded-lg",
        "bg-background",
        className
      )}
      {...props}
    >
      {(title || filename || language) && (
        <CodeBlockHeader 
          title={title || filename} 
          language={language}
        />
      )}
      {children}
    </div>
  )
}

type CodeBlockHeaderProps = {
  title?: string
  language?: string
}

function CodeBlockHeader({ title, language }: CodeBlockHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
      <div className="flex items-center gap-2">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {title && (
          <span className="text-sm text-muted-foreground ml-2">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {language && (
          <span className="text-xs text-muted-foreground uppercase font-mono">
            {language}
          </span>
        )}
      </div>
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme,
  className,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  filename,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      try {
        // List of commonly supported languages
        const supportedLanguages = [
          'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'c', 'cpp',
          'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
          'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'toml',
          'markdown', 'sql', 'bash', 'shell', 'powershell', 'dockerfile', 'nginx',
          'apache', 'lua', 'perl', 'r', 'julia', 'matlab', 'octave', 'fortran',
          'cobol', 'ada', 'pascal', 'delphi', 'vb', 'vbnet', 'fsharp', 'ocaml',
          'haskell', 'elm', 'clojure', 'erlang', 'elixir', 'dart', 'groovy',
          'makefile', 'cmake', 'gradle', 'ant', 'maven', 'sbt', 'bazel',
          'terraform', 'hcl', 'graphql', 'proto', 'thrift', 'avro'
        ]

        // Use the language if supported, otherwise fall back to 'text'
        const safeLanguage = supportedLanguages.includes(language.toLowerCase()) 
          ? language 
          : 'text'

        // Auto detect theme based on system preference if not provided
        const autoTheme = theme || (
          typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'github-dark-dimmed'
            : 'github-light'
        )

        const html = await codeToHtml(code, { 
          lang: safeLanguage, 
          theme: autoTheme,
          transformers: [
            // Always remove background from pre tag
            {
              pre(node) {
                // Remove background style but keep other styles, remove padding override
                const existingStyle = (node.properties.style || '') as string
                node.properties.style = existingStyle.replace(/background[^;]*;?/gi, '').replace(/padding[^;]*;?/gi, '') + ' background: transparent !important;'
                if (showLineNumbers) {
                  node.properties.style += ' counter-reset: line;'
                }
              }
            },
            // Add line numbers if needed
            ...(showLineNumbers ? [{
              line(node: { children: unknown[] }) {
                node.children.unshift({
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['line-number'],
                    style: 'counter-increment: line; display: inline-block; width: 1rem; margin-right: 1rem; color: #6b7280; text-align: right;'
                  },
                  children: []
                })
              }
            }] : [])
          ]
        })
        setHighlightedHtml(html)
      } catch (error) {
        console.warn(`Language '${language}' not supported, falling back to plain text:`, error)
        // Fallback to plain text if language is not supported
        const fallbackHtml = `<pre style="background: transparent; color: inherit; padding: 2.5rem; margin: 0; border-radius: 0.5rem; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, monospace;"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
        setHighlightedHtml(fallbackHtml)
      }
    }
    highlight()
  }, [code, language, theme, showLineNumbers])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `code.${language}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const classNames = cn(
    "relative w-full overflow-x-auto text-sm leading-relaxed",
    "bg-muted/30 text-foreground rounded-lg",
    "dark:bg-slate-900/80 dark:text-slate-100",
    "[&>pre]:px-6 [&>pre]:py-6 [&>pre]:bg-transparent [&>pre]:m-0",
    "[&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:font-mono",
    showLineNumbers && "[&>pre>code]:grid [&>pre>code]:gap-0",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return (
    <div className="relative code-block-container group/code">
      {/* Language label */}
      {language && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground font-mono uppercase bg-muted/50 px-2 py-1 rounded">
            {language}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {(allowCopy || allowDownload) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity duration-200 z-10">
          <div className="flex items-center gap-1">
            {allowCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 bg-background/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/50"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {allowDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0 bg-background/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/50"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {highlightedHtml ? (
        <div
          className={classNames}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          {...props}
        />
      ) : (
        <div className={classNames} {...props}>
          <pre className="px-6 py-6 font-mono">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// Convenience wrapper for common use case
export type SimpleCodeBlockProps = {
  code: string
  language?: string
  title?: string
  filename?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  className?: string
}

function SimpleCodeBlock({
  code,
  language = "tsx",
  title,
  filename,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  className
}: SimpleCodeBlockProps) {
  return (
    <CodeBlock 
      className={className} 
      title={title} 
      filename={filename} 
      language={language}
    >
      <CodeBlockCode
        code={code}
        language={language}
        showLineNumbers={showLineNumbers}
        allowCopy={allowCopy}
        allowDownload={allowDownload}
        filename={filename}
      />
    </CodeBlock>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock, SimpleCodeBlock }