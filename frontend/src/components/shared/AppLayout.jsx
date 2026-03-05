import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom'
import { clearUser, selectCurrentUser, selectUserRole } from '@/redux/slice/user.slice'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { ThemeToggle } from '@/components/shared/ThemeProvider'
import { CustomerCallProvider, useCustomerCall } from '@/components/shared/CustomerCallContext'
import { AgentCallProvider, useAgentCall } from '@/components/shared/AgentCallContext'
import {
  LayoutDashboard,
  Headphones,
  Phone,
  LogOut,
  ChevronsUpDown,
  ClipboardList,
  Bug,
} from 'lucide-react'

const getNavItems = (role) => {
  if (role === 'agent') {
    return [
      {
        title: 'Dashboard',
        url: '/agent/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Call Panel',
        url: '/agent/call',
        icon: Headphones,
      },
      {
        title: 'Issues',
        url: '/agent/issues',
        icon: Bug,
      },
    ]
  }
  return [
    {
      title: 'Dashboard',
      url: '/customer/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'My Issues',
      url: '/customer/issues',
      icon: ClipboardList,
    },
    {
      title: 'Call Support',
      url: '/customer/call',
      icon: Phone,
    },
  ]
}

const getPageTitle = (pathname) => {
  const titles = {
    '/agent/dashboard': 'Dashboard',
    '/agent/call': 'Call Panel',
    '/agent/issues': 'Issues',
    '/customer/dashboard': 'Dashboard',
    '/customer/issues': 'My Issues',
    '/customer/call': 'Call Support',
  }
  return titles[pathname] || 'Page'
}

function AppSidebar() {
  const currentUser = useSelector(selectCurrentUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = getNavItems(currentUser?.role)

  const handleLogout = () => {
    dispatch(clearUser())
    navigate('/login')
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Sidebar Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-[#171717]">
                  <img src="/clarity.png" alt="Clarity Logo" className="size-8 object-contain mix-blend-screen" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Clarity</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Call Support
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Sidebar Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer — User Menu */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {currentUser?.fullName || 'User'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {currentUser?.email || ''}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {currentUser?.fullName || 'User'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {currentUser?.role || 'user'}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function ActiveCallBanner() {
  const role = useSelector(selectUserRole)

  if (role === 'customer') return <CustomerCallBanner />
  if (role === 'agent') return <AgentCallBanner />
  return null
}

function CustomerCallBanner() {
  const { isCallActive } = useCustomerCall()
  const navigate = useNavigate()

  if (!isCallActive) return null

  return (
    <Badge
      variant="default"
      className="cursor-pointer animate-pulse"
      onClick={() => navigate('/customer/call')}
    >
      <Phone className="mr-1 h-3 w-3" />
      Call Active
    </Badge>
  )
}

function AgentCallBanner() {
  const { status, isOnline } = useAgentCall()
  const navigate = useNavigate()

  if (!isOnline) return null

  const inCall = status === 'in-call'

  return (
    <Badge
      variant={inCall ? 'default' : 'secondary'}
      className={`cursor-pointer ${inCall ? 'animate-pulse' : ''}`}
      onClick={() => navigate('/agent/call')}
    >
      <Phone className="mr-1 h-3 w-3" />
      {inCall ? 'In Call' : 'Online'}
    </Badge>
  )
}

export default function AppLayout() {
  const role = useSelector(selectUserRole)
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  const Provider = role === 'agent' ? AgentCallProvider : CustomerCallProvider

  return (
    <Provider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Top Bar */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <ActiveCallBanner />
              <ThemeToggle />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </Provider>
  )
}
