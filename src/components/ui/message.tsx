import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"

export type MessageProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, isAssistant = false, bubbleStyle = false, ...props }: MessageProps) => {
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง, ไม่ต้องใช้ flex-col
      return (
        <div 
          className={cn(
            "group w-full",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    } else {
      // User messages: แบบ bubble ด้านขวา
      return (
        <div 
          className={cn(
            "group flex flex-col items-end",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    }
  }
  
  return (
    <div className={cn("flex gap-3", className)} {...props}>
      {children}
    </div>
  )
}

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  markdown = false,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageContentProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง
      classNames = cn(
        "w-full px-4 py-3 mb-1 dark:bg-transparent text-gray-800 dark:text-gray-100",
        "[&_ul]:space-y-0 [&_ol]:space-y-0 [&_li]:my-0 [&_li]:py-0.5",
        "prose prose-li:my-0 prose-ul:my-2 prose-ol:my-2 prose-p:my-2",
        "dark:prose-invert dark:prose-headings:text-gray-100 dark:prose-p:text-gray-100 dark:prose-li:text-gray-100",
        className
      )
    } else {
      // User messages: แบบ bubble
      classNames = cn(
        "user-message bg-[#e5f3ff] text-primary max-w-[75%] rounded-3xl px-5 py-2.5 break-words whitespace-pre-wrap",
        className
      )
    }
  } else {
    classNames = cn(
      "rounded-lg p-2 text-foreground bg-secondary prose break-words whitespace-normal",
      className
    )
  }

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageActionsProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: ชิดซ้าย
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-start ml-2 relative z-10",
        className
      )
    } else {
      // User messages: ชิดขวา
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-end mr-2 relative z-10",
        className
      )
    }
  } else {
    classNames = cn("text-muted-foreground flex items-center gap-2 relative z-10", className)
  }
  
  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Tooltip>

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  bubbleStyle = false,
  ...props
}: MessageActionProps) => {
  const buttonClassName = bubbleStyle 
    ? "h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
    : ""

  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>
          <div className={cn(buttonClassName, className)}>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }