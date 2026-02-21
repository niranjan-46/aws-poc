import { FlowNode } from "../../lib/architectureGuideContent"

type IndentedFlowTreeProps = {
  nodes: FlowNode[]
}

type FlowTreeItemProps = {
  node: FlowNode
}

function FlowTreeItem({ node }: FlowTreeItemProps) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600/50 dark:bg-[#101418]">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{node.title}</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{node.detail}</p>
      </div>
      {node.children && node.children.length > 0 ? (
        <div className="ml-4 space-y-2 border-l border-slate-300 pl-3 dark:border-slate-600/60">
          {node.children.map((child) => (
            <FlowTreeItem key={`${node.title}-${child.title}`} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function IndentedFlowTree({ nodes }: IndentedFlowTreeProps) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <FlowTreeItem key={node.title} node={node} />
      ))}
    </div>
  )
}

