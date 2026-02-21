import { ReactNode } from "react"

type GuidePanelProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export default function GuidePanel({ title, description, children, className }: GuidePanelProps) {
  const resolvedClassName = className ? `ui-panel ui-panel-soft p-5 ${className}` : "ui-panel ui-panel-soft p-5"

  return (
    <section className={resolvedClassName}>
      <h2 className="ui-section-title text-lg text-slate-900 dark:text-slate-100">{title}</h2>
      {description ? <p className="mt-2 text-sm ui-muted">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

