import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext({
  isCollapsed: true,
  toggleSidebar: () => {},
  setIsCollapsed: () => {},
});

export const SidebarProvider = ({ children }) => {
  // Starts minimized/collapsed by default on every page open as requested
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleSidebar = () => setIsCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
export default SidebarContext;

