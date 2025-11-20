import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export default async function DebugPage() {
  const session = await auth()

  const workspaces = await prisma.workspace.findMany({
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Debug Info</h1>

        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold">Current Session:</h2>
          <pre className="bg-muted p-2 rounded text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="border rounded-lg p-4 space-y-2 mt-4">
          <h2 className="font-semibold">All Workspaces:</h2>
          <pre className="bg-muted p-2 rounded text-xs overflow-auto">
            {JSON.stringify(workspaces, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
