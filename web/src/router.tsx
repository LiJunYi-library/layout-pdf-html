import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { RootLayout } from './components/RootLayout'
import { DocumentsPage } from './pages/DocumentsPage'
import { FileTestPage } from './pages/FileTestPage'
import { GridDemoPage } from './pages/GridDemo/GridDemoPage'
import { LayoutPage } from './pages/LayoutPage'
import { MovePage } from './pages/MovePage'

const rootRoute = createRootRoute({ component: RootLayout })

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DocumentsPage,
})

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/layout',
  validateSearch: (search: Record<string, unknown>): { documentId?: number } => {
    const documentId = Number(search.documentId)
    return Number.isInteger(documentId) && documentId > 0 ? { documentId } : {}
  },
  component: LayoutPage,
})

const fileTestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/file-test',
  component: FileTestPage,
})

const moveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/move',
  component: MovePage,
})

const gridDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grid-demo',
  component: GridDemoPage,
})

const routeTree = rootRoute.addChildren([documentsRoute, layoutRoute, fileTestRoute, moveRoute, gridDemoRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
