"use client";

import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  Navbar as NavbarContainer,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarLogo,
  NavbarButton,
} from "@/components/ui/resizable-navbar";
import ThemeToggleButton from "@/components/ui/theme-toggle-button";
import { useAuth } from "@/hooks/useAuth";
import { clearAuth } from "@/redux/authSlice";
import { logout as logoutApi } from "@/actions/auth.api";
import { toast } from "sonner";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const initialRedirectDone = useRef(false);

  // ✅ Role-based redirect ONLY on initial mount
  useEffect(() => {
    if (initialRedirectDone.current) return; // Skip if already redirected
    if (!isAuthenticated || !role) return;

    // Only redirect if user is on home page
    if (location.pathname === "/") {
      initialRedirectDone.current = true;
      if (role === "USER") {
        navigate("/user/dashboard", { replace: true });
      } else if (role === "AGENT") {
        navigate("/agent/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, role, location.pathname, navigate]);

  const handleLogout = () => {
    dispatch(clearAuth());
    toast.success("Logged out successfully");
    navigate("/", { replace: true });

    logoutApi().catch(() => {
      // silent fail
    });
  };

  const handleNavigation = (path: string) => {
    if (path === "dashboard") {
      // Route dashboard based on role
      if (role === "USER") {
        navigate("/user/dashboard");
      } else if (role === "AGENT") {
        navigate("/agent/dashboard");
      } else {
        navigate("/"); // Default if not authenticated
      }
    } else {
      navigate(path);
    }
  };

  const navItems = [
    { name: "Home", link: "/" },
    { name: "Dashboard", link: "dashboard" },
    { name: "Chat", link: "/chat" },
  ];

  return (
    <NavbarContainer>
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} onNavigate={handleNavigation} />
        <div className="flex items-center gap-2">
          <ThemeToggleButton variant="circle-blur" start="top-right" />
          {isAuthenticated ? (
            <NavbarButton onClick={handleLogout} variant="dark">
              Logout
            </NavbarButton>
          ) : (
            <>
              <NavbarButton onClick={() => navigate("/login")} variant="secondary">
                Login
              </NavbarButton>
              <NavbarButton onClick={() => navigate("/register")} variant="dark">
                Get Started
              </NavbarButton>
            </>
          )}
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <div className="flex items-center gap-2">
            <ThemeToggleButton variant="circle-blur" start="top-right" />
            <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
          </div>
        </MobileNavHeader>

        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          {navItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                handleNavigation(item.link);
                setIsOpen(false);
              }}
              className="w-full text-left text-neutral-600 dark:text-neutral-300"
            >
              {item.name}
            </button>
          ))}

          <div className="flex w-full flex-col gap-2 pt-4">
            {isAuthenticated ? (
              <NavbarButton
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                variant="dark"
                className="w-full"
              >
                Logout
              </NavbarButton>
            ) : (
              <>
                <NavbarButton
                  onClick={() => {
                    navigate("/login");
                    setIsOpen(false);
                  }}
                  variant="secondary"
                  className="w-full"
                >
                  Login
                </NavbarButton>
                <NavbarButton
                  onClick={() => {
                    navigate("/register");
                    setIsOpen(false);
                  }}
                  variant="dark"
                  className="w-full"
                >
                  Get Started
                </NavbarButton>
              </>
            )}
          </div>
        </MobileNavMenu>
      </MobileNav>
    </NavbarContainer>
  );
};

export default Navbar;
