import { type ComponentPropsWithoutRef, type ReactNode } from "react"
import { ArrowRightIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className: string
  background: ReactNode
  Icon: React.ElementType
  description: string
  href: string
  cta: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[20rem] grid-cols-1 md:grid-cols-3 gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30",
      "shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none",
      className
    )}
    {...props}
  >
    <div className="relative flex-1 overflow-hidden">{background}</div>
    <div className="relative z-10 p-5 pt-3 bg-gradient-to-t from-card via-card/95 to-transparent">
      <div className="pointer-events-none flex transform-gpu flex-col gap-1.5 transition-all duration-300 lg:group-hover:-translate-y-8">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/70 text-primary mb-1">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {name}
        </h3>
        <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="pointer-events-none mt-2 flex w-full flex-row items-center lg:hidden">
        <Button
          variant="link"
          size="sm"
          className="pointer-events-auto h-auto p-0 text-xs text-primary"
          render={<a href={href} />}
          nativeButton={false}
        >
          {cta}
          <ArrowRightIcon className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180" />
        </Button>
      </div>
    </div>

    <div className="pointer-events-none absolute bottom-0 z-20 hidden w-full translate-y-8 transform-gpu flex-row items-center px-5 pb-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
      <Button
        variant="link"
        size="sm"
        className="pointer-events-auto h-auto p-0 text-xs text-primary"
        render={<a href={href} />}
        nativeButton={false}
      >
        {cta}
        <ArrowRightIcon className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180" />
      </Button>
    </div>
  </div>
)

export { BentoCard, BentoGrid }
