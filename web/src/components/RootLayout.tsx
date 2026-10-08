import { Link, Outlet } from '@tanstack/react-router'

export function RootLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF 布局 Agent</h1>
        <nav className="app-nav">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'nav-active' }}>文档</Link>
          <Link to="/layout" activeProps={{ className: 'nav-active' }}>布局预览</Link>
          <Link to="/file-test" activeProps={{ className: 'nav-active' }}>文件测试</Link>
          <Link to="/grid-demo" activeProps={{ className: 'nav-active' }}>Grid Demo</Link>
          <Link to="/data-dashboard" activeProps={{ className: 'nav-active' }}>数据看板</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
