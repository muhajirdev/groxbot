import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/enterprise')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/enterprise"!</div>
}
