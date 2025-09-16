import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { CodeBlock, CodeBlockCode } from "./code-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

// Convert AI supplied LaTeX delimiters \( ... \) and \[ ... \] to
// remark-math compatible $...$ and $$...$$ while skipping code fences.
function normalizeLatexDelimiters(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```)/g)
  return segments
    .map((segment) => {
      if (segment.startsWith("```")) return segment // skip code blocks
      return segment
        .replace(/\\\[((?:.|\n)+?)\\\]/g, (_, expr: string) => `\n\n$$${expr.trim()}$$\n\n`)
        .replace(/\\\((.+?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`)
    })
    .join("")
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  table: function TableComponent({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <Table>
          {children}
        </Table>
      </div>
    )
  },
  thead: function TableHeaderComponent({ children }) {
    return <TableHeader>{children}</TableHeader>
  },
  tbody: function TableBodyComponent({ children }) {
    return <TableBody>{children}</TableBody>
  },
  tr: function TableRowComponent({ children }) {
    return <TableRow>{children}</TableRow>
  },
  th: function TableHeadComponent({ children }) {
    return <TableHead>{children}</TableHead>
  },
  td: function TableCellComponent({ children }) {
    return <TableCell>{children}</TableCell>
  },
  ol: function OrderedListComponent({ children }) {
    return <ol className="list-decimal list-outside space-y-1 my-4 ml-6">{children}</ol>
  },
  ul: function UnorderedListComponent({ children }) {
    return <ul className="list-disc list-outside space-y-1 my-4 ml-6">{children}</ul>
  },
  li: function ListItemComponent({ children }) {
    return <li className="pl-2">{children}</li>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
  rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const normalized = useMemo(() => normalizeLatexDelimiters(children), [children])
  const blocks = useMemo(() => parseMarkdownIntoBlocks(normalized), [normalized])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }