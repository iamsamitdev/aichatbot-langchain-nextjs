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
        "not-prose flex w-full flex-col overflow-clip border my-4",
        "border-border bg-zinc-950 text-zinc-100 rounded-xl shadow-lg",
        "dark:bg-zinc-900 dark:border-zinc-800",
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
    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {title && (
          <span className="text-sm text-zinc-400 ml-2">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {language && (
          <span className="text-xs text-zinc-500 uppercase font-mono">
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
  theme = "github-dark-dimmed",
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

      const html = await codeToHtml(code, { 
        lang: language, 
        theme,
        transformers: showLineNumbers ? [{
          pre(node) {
            node.properties.style = `${node.properties.style || ''}; counter-reset: line;`
          },
          line(node) {
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
        }] : []
      })
      setHighlightedHtml(html)
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
    "relative w-full overflow-x-auto text-[13px] bg-zinc-950",
    "[&>pre]:px-4 [&>pre]:py-4 [&>pre]:bg-transparent",
    "[&>pre>code]:bg-transparent [&>pre>code]:p-0",
    showLineNumbers && "[&>pre>code]:grid [&>pre>code]:gap-0",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return (
    <div className="relative group">
      {/* Action buttons */}
      {(allowCopy || allowDownload) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <div className="flex items-center gap-1">
            {allowCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100"
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
                className="h-8 w-8 p-0 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100"
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
          <pre className="px-4 py-4">
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