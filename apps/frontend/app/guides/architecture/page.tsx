import Link from "next/link"
import GuidePanel from "../../../components/guides/GuidePanel"
import IndentedFlowTree from "../../../components/guides/IndentedFlowTree"
import {
  architectureFlow,
  backendFlowTree,
  backendStructure,
  codeChanges,
  deploymentStack,
  frontendFlowTree,
  frontendStructure,
  validationStandards,
} from "../../../lib/architectureGuideContent"
import { REPOSITORY_URL } from "../../../lib/projectMeta"

export default function ArchitectureGuidePage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl scroll-smooth px-4 py-6 sm:px-6 lg:px-8">
      <header className="ui-panel ui-panel-soft p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] ui-muted">Architecture View</p>
            <h1 className="ui-section-title mt-1 text-2xl text-slate-900 dark:text-slate-100">
              Frontend + Backend Indented Artifact
            </h1>
            <p className="mt-2 text-sm ui-muted">
              Standardized flow for UI, backend, scheduling pipeline, validation, and deployment in one page (Singapore region).
            </p>
          </div>
          <Link href="/" className="ui-ghost-button px-3 py-2 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <GuidePanel className="mt-5" title="End-to-End Flow">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {architectureFlow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </GuidePanel>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <GuidePanel title="Frontend Indented Flow" description="UI request creation, validation, and API communication path.">
          <IndentedFlowTree nodes={frontendFlowTree} />
        </GuidePanel>

        <GuidePanel title="Backend Indented Flow" description="Controller-to-service scheduling and secure execution path.">
          <IndentedFlowTree nodes={backendFlowTree} />
        </GuidePanel>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <GuidePanel title="Frontend File Structure">
          <pre className="ui-list-item overflow-x-auto p-3 text-xs text-slate-700 dark:text-slate-200">
            <code>{frontendStructure}</code>
          </pre>
        </GuidePanel>

        <GuidePanel title="Backend File Structure">
          <pre className="ui-list-item overflow-x-auto p-3 text-xs text-slate-700 dark:text-slate-200">
            <code>{backendStructure}</code>
          </pre>
        </GuidePanel>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <GuidePanel title="Validation and Cron Standards">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
            {validationStandards.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GuidePanel>

        <GuidePanel title="Deployment Stack">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
            {deploymentStack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GuidePanel>
      </section>

      <GuidePanel className="mt-5" title="Code Changes Summary">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {codeChanges.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </GuidePanel>

      <GuidePanel className="mt-5" title="GitHub Repository">
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex break-all text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          {REPOSITORY_URL}
        </a>
      </GuidePanel>

      <GuidePanel
        className="mt-5"
        title="Production Architecture Diagram"
        description="Clean short diagram for quick review in UI."
      >
        <div className="flex flex-wrap gap-2">
          <a
            href="/architecture-quick.svg"
            target="_blank"
            rel="noreferrer"
            className="ui-ghost-button px-3 py-2 text-sm"
          >
            Open Full SVG
          </a>
          <a href="/architecture-quick.svg" download className="ui-ghost-button px-3 py-2 text-sm">
            Download SVG
          </a>
        </div>
        <div className="ui-list-item mt-3 overflow-hidden p-2">
          <img
            src="/architecture-quick.svg"
            alt="Compact App Runner architecture flow for frontend, backend, EventBridge, Lambda, and S3"
            className="h-auto w-full bg-white"
          />
        </div>
      </GuidePanel>
    </div>
  )
}
