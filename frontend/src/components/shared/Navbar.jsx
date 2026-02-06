import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { clearUser } from '@/redux/slice/user.slice'
import { 
  Navbar as ResizableNavbar, 
  NavBody, 
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarButton
} from '@/components/ui/resizable-navbar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const { isAuthenticated, currentUser } = useSelector((state) => state.user)
  console.log(isAuthenticated, currentUser);
  
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const navItems = [
    { name: 'Home', link: '/' },
    {name: 'Dashboard', link: isAuthenticated ? (currentUser?.role === 'agent' ? '/agent/dashboard' : '/customer/dashboard') : '/login' },
    { name: 'Manage Call', link: isAuthenticated ? (currentUser?.role === 'customer' ? '/customer/call' : '/agent/call') : '/login' },
    // { name: 'Chat with an agent', link: '/chat' }
  ]

  const handleNavClick = () => {
    setIsOpen(false)
  }

  const handleLogout = () => {
    dispatch(clearUser())
    navigate('/login')
    setIsOpen(false)
  }

  return (
    <ResizableNavbar>
      {/* Desktop Navbar */}
      <NavBody>
        {/* Logo */}
        <Link
          to="/"
          className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
        >
          <img
            src="/logo-white.png"
            alt="logo"
            width={100}
            height={100}
          />
        </Link>

        {/* Nav Links */}
        <NavItems items={navItems} />

        {/* Buttons */}
        <div className="relative z-20 flex items-center space-x-2">
          {isAuthenticated ? (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="cursor-pointer">
                  <Avatar>
                    <AvatarFallback>
                      {currentUser?.fullName?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverHeader>
                  <PopoverTitle>User Profile</PopoverTitle>
                  <PopoverDescription>
                    Welcome, {currentUser?.fullName || 'User'}
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-4 pt-4">
                  <Button onClick={handleLogout} variant="destructive" size="sm">
                    Logout
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <>
              <NavbarButton to="/login" variant="secondary">
                Login
              </NavbarButton>
              <NavbarButton to="/register" variant="primary">
                Get started
              </NavbarButton>
            </>
          )}
        </div>
      </NavBody>

      {/* Mobile Navbar */}
      <MobileNav>
        <MobileNavHeader>
          {/* Logo */}
          <Link
            to="/"
            className="relative z-20 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
          >
            <img
              src="/logo-white.png"
              alt="logo"
              width={40}
              height={40}
            />
            <span className="font-medium text-black dark:text-white">Clarity</span>
          </Link>

          {/* Toggle Button */}
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>

        {/* Mobile Menu */}
        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          {navItems.map((item, idx) => (
            <Link
              key={`mobile-link-${idx}`}
              to={item.link}
              onClick={handleNavClick}
              className="w-full text-neutral-600 dark:text-neutral-300"
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-4 flex w-full flex-col space-y-2">
            {isAuthenticated ? (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center justify-center gap-2 cursor-pointer">
                    <Avatar>
                      <AvatarFallback>
                        {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span>Profile</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center">
                  <PopoverHeader>
                    <PopoverTitle>User Profile</PopoverTitle>
                    <PopoverDescription>
                      Welcome, {currentUser?.name || 'User'}
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="flex flex-col gap-4 pt-4">
                    <Button onClick={handleLogout} variant="destructive" size="sm">
                      Logout
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <>
                <NavbarButton to="/login" variant="secondary" className="w-full">
                  Login
                </NavbarButton>
                <NavbarButton to="/register" variant="primary" className="w-full">
                  Get started
                </NavbarButton>
              </>
            )}
          </div>
        </MobileNavMenu>
      </MobileNav>
    </ResizableNavbar>
  )
}

export default Navbar