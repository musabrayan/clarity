import { Separator } from '@/components/ui/separator'

const PageHeader = ({ title, description, actions }) => {
  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      <Separator className="mt-4" />
    </div>
  )
}

export default PageHeader
